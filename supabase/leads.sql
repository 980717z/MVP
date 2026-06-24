-- ===========================================================================
--  BentoOS — lead capture table for the "Get started" form
--  Run this in Supabase Studio → SQL Editor → New query → Run. Safe to re-run.
-- ===========================================================================

create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  business_name text not null,
  business_type text,
  email         text not null,
  phone         text,
  locations     text,
  modules       text[],
  notes         text,
  lang          text
);

alter table public.leads enable row level security;

-- Public form: anyone (anon) may INSERT a lead, but nobody can read them via the
-- anon/auth API. Read leads from the Supabase dashboard or with the service role.
-- Both the table GRANT and the RLS policy are required for PostgREST inserts.
grant insert on table public.leads to anon, authenticated;

drop policy if exists "leads_insert_public" on public.leads;
create policy "leads_insert_public" on public.leads
  for insert to anon, authenticated
  with check (true);
