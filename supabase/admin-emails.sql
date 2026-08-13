-- ===========================================================================
--  is_admin() — DB-level admin check (Campus lockdown Task 1).
--
--  Mirrors the platform-operator gate that already exists in lib/adminAuth.ts
--  (Vercel env ADMIN_EMAILS) so RLS policies can recognize a team account
--  without going through a service-role API route. Source of truth is still
--  Vercel's ADMIN_EMAILS — this table is a manual mirror of it. If the
--  Vercel list changes, this table must be updated too (see seed block below).
--
--  ⚠️ NEVER add a merchant/vendor email here — same rule as ADMIN_EMAILS.
--  This is cross-tenant: is_admin() = true lets RLS treat that user as owner
--  of EVERY tenant, not just their own.
--
--  Supabase → SQL Editor → Run. Idempotent.
-- ===========================================================================

-- ── 1. Table ────────────────────────────────────────────────────────────────
create table if not exists public.admin_emails (
  email text primary key
);

-- RLS on with NO policies granted to authenticated/anon: nobody can read or
-- write this table through PostgREST/the app. Only editable via the Supabase
-- SQL Editor (or a future migration), same trust level as ADMIN_EMAILS itself.
alter table public.admin_emails enable row level security;

-- ── 2. is_admin() ───────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.admin_emails
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon;

-- ── 3. Seed — paste the CURRENT Vercel ADMIN_EMAILS list here ───────────────
-- Re-confirmed (2026-08-12): Vercel's ADMIN_EMAILS contains exactly one
-- address, allen.zhang@bentoos.io — which is also pita-express's owner_id.
-- (This value was reported three different ways earlier in this thread; if
-- more team members are added to ADMIN_EMAILS later, add their rows here too
-- and re-run — see the note at the top of this file on manual maintenance.)
insert into public.admin_emails (email) values
  ('allen.zhang@bentoos.io')
on conflict (email) do nothing;

-- ── Verify (run logged in as each kind of account) ──────────────────────────
--   As a team/admin account:  select is_admin();  -- expect true
--   As a merchant account:    select is_admin();  -- expect false
-- ===========================================================================
