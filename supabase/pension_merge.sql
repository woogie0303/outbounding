analyze pension_stage;

do $$
declare
  incoming_month date;
  current_snapshot public.pension_snapshot%rowtype;
begin
  select min(data_month) into incoming_month from pension_stage;
  if incoming_month is null or exists (select 1 from pension_stage where data_month <> incoming_month) then
    raise exception 'Expected one nonempty monthly snapshot';
  end if;
  select * into current_snapshot from public.pension_snapshot;
  if found and incoming_month < current_snapshot.data_month then
    raise exception 'Cannot replace a newer pension snapshot';
  end if;
  if found and current_snapshot.region_scope <> current_setting('outbounding.region_scope') then
    raise exception 'Region scope differs from the existing snapshot';
  end if;
end
$$;

-- Resolve exact workplace-key duplicates deterministically, preferring registered records.
create temp table pension_workplaces on commit drop as
select distinct on (id) *
from pension_stage
order by id, pension_status, employee_count desc nulls last,
         industry_code nulls last, industry, industry_group nulls last, region, city nulls last;
drop table pension_stage;
alter table pension_workplaces add primary key (id);
analyze pension_workplaces;

insert into public.companies as c (
  id, name, business_number, pension_status, data_month, industry_code,
  industry, industry_group, region, city, address, employee_count,
  source_url, verified_on, evidence
)
select id, name, business_number, pension_status, data_month, industry_code,
       industry, industry_group, region, city, address, employee_count,
       'https://www.data.go.kr/data/15083277/fileData.do', current_date, '국민연금 가입 사업장 내역'
from pension_workplaces
on conflict (id) do update set
  name = excluded.name,
  business_number = excluded.business_number,
  pension_status = excluded.pension_status,
  data_month = excluded.data_month,
  industry_code = excluded.industry_code,
  industry = excluded.industry,
  industry_group = coalesce(excluded.industry_group,
    case when c.industry_code is not distinct from excluded.industry_code then c.industry_group end),
  region = excluded.region,
  city = excluded.city,
  address = excluded.address,
  employee_count = excluded.employee_count,
  snapshot_present = true,
  updated_at = now()
-- The snapshot records the current month, so unchanged workplaces need no heap rewrite.
where (c.name, c.business_number, c.pension_status, c.industry_code,
       c.industry, c.industry_group, c.region, c.city, c.address, c.employee_count, c.snapshot_present)
  is distinct from
      (excluded.name, excluded.business_number, excluded.pension_status, excluded.industry_code,
       excluded.industry, coalesce(excluded.industry_group,
         case when c.industry_code is not distinct from excluded.industry_code then c.industry_group end), excluded.region,
       excluded.city, excluded.address, excluded.employee_count, true);

-- Keep missing records addressable by existing CRM references and preserve sourced enrichment.
update public.companies c set snapshot_present = false, updated_at = now(),
  data_month = coalesce((select data_month from public.pension_snapshot), c.data_month)
where c.data_month is not null and c.snapshot_present
  and not exists (select 1 from pension_workplaces w where w.id = c.id);

insert into public.pension_snapshot (singleton, data_month, region_scope, workplace_count)
select true, min(data_month), current_setting('outbounding.region_scope'), count(*)
from pension_workplaces
on conflict (singleton) do update set data_month = excluded.data_month,
  region_scope = excluded.region_scope, workplace_count = excluded.workplace_count, imported_at = now();

do $$
begin
  if (select other_bytes from import_baseline) + pg_total_relation_size('public.companies') > 475 * 1000000 then
    raise exception 'Directory would exceed the configured 475 MB database budget';
  end if;
end
$$;

commit;
analyze public.companies;
select data_month, region_scope, workplace_count,
       pg_size_pretty(pg_database_size(current_database())) as database_size
from public.pension_snapshot;
