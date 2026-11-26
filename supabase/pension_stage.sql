begin;
select pg_advisory_xact_lock(15083277);
select set_config('outbounding.region_scope', :'region_scope', true);
create temp table import_baseline on commit drop as
select pg_database_size(current_database()) - pg_total_relation_size('public.companies') as other_bytes;

create temp table pension_stage (
  id text not null,
  name text not null,
  business_number text,
  pension_status smallint not null check (pension_status in (1, 2)),
  data_month date not null,
  industry_code text,
  industry text not null,
  industry_group text,
  region text not null,
  city text,
  address text,
  employee_count integer
) on commit drop;
copy pension_stage from stdin with (
  format csv, force_null (business_number, industry_code, industry_group, city, address, employee_count)
);
