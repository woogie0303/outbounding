begin;
create table public.companies (
  id text primary key check (length(id) between 1 and 100),
  name text not null,
  industry text not null,
  region text not null,
  city text,
  address text,
  phone text,
  email text,
  website text check (website ~ '^https?://'),
  source_url text not null check (source_url ~ '^https?://'),
  verified_on date not null,
  evidence text not null,
  direct_delivery boolean not null default false
);
create index companies_industry_region on public.companies (industry, region);
create index companies_industry_city on public.companies (industry, city);
alter table public.companies enable row level security;
revoke all on public.companies from anon, authenticated;
grant select on public.companies to anon, authenticated;
create policy "Public company directory" on public.companies for select to anon, authenticated using (true);

create table public.saved_companies (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company_id text not null references public.companies(id) on delete cascade,
  note text not null default '' check (length(note) <= 2000),
  primary key (user_id, company_id)
);
alter table public.saved_companies enable row level security;
revoke all on public.saved_companies from anon, authenticated;
grant select, insert, update, delete on public.saved_companies to authenticated;
create policy "Account owns saved companies"
  on public.saved_companies for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
commit;
