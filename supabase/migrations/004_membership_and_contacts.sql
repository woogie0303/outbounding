begin;

create table public.lead_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  company_id text not null,
  name text not null check (length(btrim(name)) between 1 and 120),
  phone text not null default '' check (length(phone) <= 120),
  foreign key (user_id, company_id) references public.saved_companies(user_id, company_id) on delete cascade
);
create index lead_contacts_owner on public.lead_contacts (user_id, company_id);
alter table public.lead_contacts enable row level security;
revoke all on public.lead_contacts from public, anon, authenticated;
grant select, insert, delete on public.lead_contacts to authenticated;
grant update (name, phone) on public.lead_contacts to authenticated;
create policy "Account owns lead contacts" on public.lead_contacts for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

insert into public.lead_contacts (user_id, company_id, name, phone)
select user_id, company_id, coalesce(nullif(btrim(contact_name), ''), '이름 미등록'), coalesce(contact_phone, '')
from public.saved_companies
where nullif(btrim(contact_name), '') is not null or nullif(btrim(contact_phone), '') is not null;
alter table public.saved_companies drop column contact_name, drop column contact_phone;

create schema if not exists private;
create table private.trial_searches (
  user_id uuid primary key references auth.users(id) on delete cascade,
  attempts integer not null default 0,
  last_request uuid,
  last_filters jsonb
);
alter table private.trial_searches enable row level security;
revoke all on private.trial_searches from public, anon, authenticated;

alter function public.search_companies(text,text,text,integer,integer,boolean,text,integer)
  set schema private;
revoke all on function private.search_companies(text,text,text,integer,integer,boolean,text,integer)
  from public, anon, authenticated;

drop policy "Public company directory" on public.companies;
create policy "Read saved companies and member directory" on public.companies
  for select to authenticated using (
    (select auth.jwt()->>'is_anonymous') = 'false'
    or exists (select 1 from public.saved_companies s
               where s.company_id = companies.id and s.user_id = (select auth.uid()))
  );

create table public.company_locations (
  company_id text primary key references public.companies(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  source_url text not null check (source_url ~ '^https?://')
);
create index company_locations_latitude on public.company_locations (latitude);
alter table public.company_locations enable row level security;
revoke all on public.company_locations from public, anon, authenticated;
grant select on public.company_locations to authenticated;
create policy "Members read company locations" on public.company_locations
  for select to authenticated using ((select auth.jwt()->>'is_anonymous') = 'false');

create function public.search_companies(
  p_request uuid,
  p_industry text default null,
  p_region text default null,
  p_query text default null,
  p_people_min integer default null,
  p_people_max integer default null,
  p_require_revenue boolean default false,
  p_after text default null,
  p_limit integer default 50
) returns setof public.companies
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  trial private.trial_searches%rowtype;
  filters jsonb := jsonb_build_array(p_industry, p_region, p_query, p_people_min, p_people_max, p_require_revenue);
begin
  if actor is null or p_request is null then
    raise exception using errcode = 'P0001', message = 'SEARCH_SESSION_REQUIRED';
  end if;
  if coalesce(auth.jwt()->>'is_anonymous', 'true') <> 'false' then
    insert into private.trial_searches (user_id) values (actor) on conflict do nothing;
    select * into trial from private.trial_searches where user_id = actor for update;
    if p_after is null and trial.last_request is distinct from p_request then
      if trial.attempts >= 10 then
        raise exception using errcode = 'P0001', message = 'SIGNUP_SEARCH_LIMIT';
      end if;
      update private.trial_searches set attempts = attempts + 1,
        last_request = p_request, last_filters = filters where user_id = actor;
    elsif trial.last_request is distinct from p_request or trial.last_filters is distinct from filters then
      raise exception using errcode = 'P0001', message = 'SEARCH_PAGE_EXPIRED';
    end if;
  end if;
  return query select * from private.search_companies(
    p_industry,p_region,p_query,p_people_min,p_people_max,p_require_revenue,p_after,p_limit
  );
end;
$$;
revoke all on function public.search_companies(uuid,text,text,text,integer,integer,boolean,text,integer)
  from public, anon, authenticated;
grant execute on function public.search_companies(uuid,text,text,text,integer,integer,boolean,text,integer)
  to authenticated;

create function private.enforce_trial_saved_limit() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is distinct from new.user_id or (auth.jwt()->>'is_anonymous') = 'false' then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 5));
  if not exists (select 1 from public.saved_companies where user_id = new.user_id and company_id = new.company_id)
     and (select count(*) from public.saved_companies where user_id = new.user_id) >= 5 then
    raise exception using errcode = 'P0001', message = 'SIGNUP_SAVED_LIMIT';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_trial_saved_limit() from public, anon, authenticated;
create trigger enforce_trial_saved_limit before insert on public.saved_companies
  for each row execute function private.enforce_trial_saved_limit();

commit;
