begin;

alter table public.companies
  add column business_number text,
  add column pension_status smallint check (pension_status in (1, 2)),
  add column data_month date,
  add column snapshot_present boolean not null default true,
  add column industry_code text,
  add column industry_group text,
  add column employee_count integer check (employee_count >= 0),
  add column updated_at timestamptz not null default now();

create index companies_region on public.companies (region);
create index companies_city on public.companies (city) where city is not null;
create index companies_business_number on public.companies (business_number)
  where business_number ~ '^[0-9]{10}$';

create table public.pension_snapshot (
  singleton boolean primary key default true check (singleton),
  data_month date not null,
  region_scope text not null,
  imported_at timestamptz not null default now(),
  workplace_count integer not null check (workplace_count > 0)
);
alter table public.pension_snapshot enable row level security;
revoke all on public.pension_snapshot from anon, authenticated;
grant select on public.pension_snapshot to anon, authenticated;
create policy "Read current pension snapshot" on public.pension_snapshot
  for select to anon, authenticated using (true);

create table public.company_keywords (
  company_id text not null references public.companies(id) on delete cascade,
  keyword text not null check (length(btrim(keyword)) between 1 and 80),
  source_url text not null check (source_url ~ '^https?://'),
  verified_on date,
  primary key (company_id, keyword)
);
alter table public.company_keywords enable row level security;
revoke all on public.company_keywords from anon, authenticated;
grant select on public.company_keywords to anon, authenticated;
create policy "Read verified company keywords" on public.company_keywords
  for select to anon, authenticated using (verified_on is not null);

alter table public.saved_companies
  add column stage text check (stage in ('미접촉','접촉 중','상담 진행','제안·협의','계약 완료','종료')),
  add column contact_name text check (length(contact_name) <= 120),
  add column contact_phone text check (length(contact_phone) <= 120),
  add column next_contact_on date;

create table public.lead_contact_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  company_id text not null,
  contacted_at timestamptz not null default now(),
  note text not null check (length(btrim(note)) between 1 and 2000),
  foreign key (user_id, company_id) references public.saved_companies(user_id, company_id) on delete cascade
);
create index lead_contact_history_owner on public.lead_contact_history (user_id, company_id, contacted_at desc);
alter table public.lead_contact_history enable row level security;
revoke all on public.lead_contact_history from anon, authenticated;
grant select, insert, update, delete on public.lead_contact_history to authenticated;
create policy "Account owns contact history" on public.lead_contact_history
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create function public.search_companies(
  p_industry text default null,
  p_region text default null,
  p_query text default null,
  p_people_min integer default null,
  p_people_max integer default null,
  p_require_revenue boolean default false,
  p_after text default null,
  p_limit integer default 50
) returns setof public.companies
language sql stable security invoker set search_path = ''
as $$
  with result_page as materialized (
    select c as company
    from public.companies c
    where (c.data_month is null or (c.snapshot_present and c.pension_status = 1))
    and (nullif(p_industry, '') is null or p_industry in (c.industry, c.industry_group, c.industry_code))
    and (nullif(p_region, '') is null or p_region in (c.region, c.city))
    and (p_people_min is null or c.employee_count >= p_people_min)
    and (p_people_max is null or c.employee_count <= p_people_max)
    and not coalesce(p_require_revenue, false)
    and (p_after is null or c.id > p_after)
    and not exists (
      select 1
      from regexp_split_to_table(btrim(left(coalesce(p_query, ''), 160)), '[[:space:]]+') as term(value)
      where term.value <> ''
        and strpos(lower(concat_ws(' ', c.name, c.industry, c.industry_group, c.industry_code, c.region, c.city)), lower(term.value)) = 0
        and not exists (
          select 1 from public.company_keywords k
          where k.company_id = c.id and k.verified_on is not null
            and strpos(lower(k.keyword), lower(term.value)) > 0
        )
    )
    order by c.id
    limit least(101, greatest(1, coalesce(p_limit, 50)))
  )
  select (case when (company).data_month is null then company
    else jsonb_populate_record(company, jsonb_build_object(
      'data_month', (select data_month from public.pension_snapshot)
    ))
  end).*
  from result_page
  order by (company).id;
$$;
revoke all on function public.search_companies(text,text,text,integer,integer,boolean,text,integer) from public;
grant execute on function public.search_companies(text,text,text,integer,integer,boolean,text,integer) to anon, authenticated;

commit;
