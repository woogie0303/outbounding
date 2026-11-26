begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table public.sales_preferences (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  regions text[] not null default '{}', industries text[] not null default '{}',
  keywords text[] not null default '{}' check(cardinality(keywords)<=3)
);
alter table public.sales_preferences enable row level security;
revoke all on public.sales_preferences from anon, authenticated;
grant select,insert,update on public.sales_preferences to authenticated;
create policy own_preferences on public.sales_preferences for all to authenticated
using(user_id=auth.uid() and auth.jwt()->>'is_anonymous'='false')
with check(user_id=auth.uid() and auth.jwt()->>'is_anonymous'='false');

create table private.keyword_requests (
 user_id uuid references auth.users on delete cascade, region text, industry text, keyword text,
 week_of date, requested_at timestamptz not null default now(),
 primary key(user_id,region,industry,keyword,week_of)
);
alter table private.keyword_requests enable row level security;
create function private.collect_keyword_requests() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into private.keyword_requests(user_id,region,industry,keyword,week_of)
 select distinct new.user_id,r,i,lower(trim(k)),date_trunc('week',now() at time zone 'Asia/Seoul')::date
 from unnest(new.regions) r cross join unnest(new.industries) i cross join unnest(new.keywords) k where trim(k)<>''
 on conflict(user_id,region,industry,keyword,week_of) do update set requested_at=now();
 return new;
end $$;
create trigger collect_requests after insert or update on public.sales_preferences for each row execute function private.collect_keyword_requests();
create view private.weekly_keyword_demand as
select r.region,r.industry,r.keyword,count(distinct r.user_id) as requesting_users,
(select count(distinct c.id) from public.company_keywords k join public.companies c on c.id=k.company_id
 where k.verified_on is not null and lower(k.keyword)=r.keyword and r.region in(c.city,c.region)
 and strpos(c.industry,r.industry)>0 and (c.data_month is null or(c.snapshot_present and c.pension_status=1))) as matching_companies
from private.keyword_requests r where requested_at>=now()-interval '7 days' group by r.region,r.industry,r.keyword;
create function public.recommended_companies() returns table(company jsonb,matched text[]) language sql stable security invoker set search_path='' as $$
select to_jsonb(c),m.tags from public.sales_preferences p join public.companies c on
(c.region=any(p.regions) or c.city=any(p.regions)) and exists(select from unnest(p.industries) i where strpos(c.industry,i)>0)
cross join lateral(select array(select k.keyword from public.company_keywords k where k.company_id=c.id and k.verified_on is not null
 and exists(select from unnest(p.keywords) t where lower(t)=lower(k.keyword))) tags)m
where p.user_id=auth.uid() and (c.data_month is null or(c.snapshot_present and c.pension_status=1))
and not exists(select from public.saved_companies s where s.company_id=c.id and s.user_id=p.user_id)
order by cardinality(m.tags) desc,c.id limit 5
$$;
alter table public.lead_contact_history add column contact_name text;
create function public.record_contact(p_company text,p_name text,p_time timestamptz,p_note text,p_next date)
returns void language plpgsql security invoker set search_path='' as $$
begin
 update public.saved_companies set next_contact_on=p_next where user_id=auth.uid() and company_id=p_company;
 if not found then raise exception 'Saved company required'; end if;
 insert into public.lead_contact_history(company_id,contact_name,contacted_at,note) values(p_company,nullif(trim(p_name),''),p_time,p_note);
end $$;
commit;
