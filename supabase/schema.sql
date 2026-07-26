-- ===========================================================================
--  BentoOS — database schema + multi-tenant Row Level Security
--  Run this in Supabase Studio → SQL Editor → New query → Run.
--  Safe to re-run (idempotent): drops & recreates policies.
-- ===========================================================================

-- ── 1. Tables ──────────────────────────────────────────────────────────────

-- One row per merchant (master account). owner_id = the auth user who created it.
create table if not exists public.tenants (
  slug        text primary key,
  name        jsonb       not null default '{}'::jsonb,   -- { zh, en }
  industry    text        not null default 'restaurant',
  address     text        not null default '',
  enabled     jsonb       not null default '[]'::jsonb,    -- string[] of module ids
  owner_id    uuid        not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- Staff sub-accounts under a tenant. member_id links to an auth user (nullable
-- until that staff member actually signs up / is invited).
create table if not exists public.members (
  id           uuid        primary key default gen_random_uuid(),
  tenant_slug  text        not null references public.tenants (slug) on delete cascade,
  member_id    uuid        references auth.users (id) on delete set null,
  name         text        not null,
  role         text        not null default 'staff',      -- owner | manager | staff
  access       jsonb       not null default '[]'::jsonb,   -- module ids; [] = all enabled
  created_at   timestamptz not null default now()
);

-- All module data lives here. `data` is the form payload (jsonb) so new modules
-- need no schema change.
create table if not exists public.records (
  id           uuid        primary key default gen_random_uuid(),
  tenant_slug  text        not null references public.tenants (slug) on delete cascade,
  module_id    text        not null,
  data         jsonb       not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists records_tenant_module_idx
  on public.records (tenant_slug, module_id, created_at desc);
create index if not exists members_tenant_idx
  on public.members (tenant_slug);

-- ── 2. Helper: which tenants can the current user see? ──────────────────────
-- A user can access a tenant if they own it OR they are a linked member of it.
create or replace function public.can_access_tenant(t_slug text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.tenants
    where slug = t_slug and owner_id = auth.uid()
  ) or exists (
    select 1 from public.members
    where tenant_slug = t_slug and member_id = auth.uid()
  );
$$;

-- ── 3. Enable RLS ───────────────────────────────────────────────────────────
alter table public.tenants enable row level security;
alter table public.members enable row level security;
alter table public.records enable row level security;

-- ── 3b. Table grants for the Data API role ──────────────────────────────────
-- RLS decides WHICH ROWS; these grants decide WHICH ROLES may touch the table
-- at all.  We grant only to `authenticated` (logged-in users) — `anon`
-- (not logged in) gets nothing, so unauthenticated requests are denied.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.tenants to authenticated;
grant select, insert, update, delete on public.members to authenticated;
grant select, insert, update, delete on public.records to authenticated;

-- ── 4. Policies ─────────────────────────────────────────────────────────────

-- tenants ----------------------------------------------------------------
drop policy if exists tenants_select on public.tenants;
create policy tenants_select on public.tenants
  for select using (public.can_access_tenant(slug));

drop policy if exists tenants_insert on public.tenants;
create policy tenants_insert on public.tenants
  for insert with check (owner_id = auth.uid());

drop policy if exists tenants_update on public.tenants;
create policy tenants_update on public.tenants
  for update using (owner_id = auth.uid());

drop policy if exists tenants_delete on public.tenants;
create policy tenants_delete on public.tenants
  for delete using (owner_id = auth.uid());

-- members ----------------------------------------------------------------
-- Readable by anyone on the tenant; only the owner can change the roster.
drop policy if exists members_select on public.members;
create policy members_select on public.members
  for select using (public.can_access_tenant(tenant_slug));

drop policy if exists members_write on public.members;
create policy members_write on public.members
  for all
  using (exists (select 1 from public.tenants where slug = tenant_slug and owner_id = auth.uid()))
  with check (exists (select 1 from public.tenants where slug = tenant_slug and owner_id = auth.uid()));

-- records ----------------------------------------------------------------
-- Any member of the tenant can read & write records.
drop policy if exists records_select on public.records;
create policy records_select on public.records
  for select using (public.can_access_tenant(tenant_slug));

drop policy if exists records_write on public.records;
create policy records_write on public.records
  for all
  using (public.can_access_tenant(tenant_slug))
  with check (public.can_access_tenant(tenant_slug));

-- ===========================================================================
--  Done. Next: create an account in the app, then (optionally) seed demo data
--  with supabase/seed.sql after replacing <YOUR_AUTH_UID>.
-- ===========================================================================
