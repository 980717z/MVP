-- ===========================================================================
--  Anonymous traction events — powers the /admin funnel (campus page views →
--  directory views → menu views → orders placed). Deliberately PII-free:
--  no user ids, no phone/email, session_hash is a random per-browser-session
--  token (not derived from anything personal).
--
--  Writes ONLY via /api/track (service role, rate-limited, name-allowlisted).
--  Reads ONLY via /api/admin/stats (service role, admin-email gated).
--  RLS is enabled with NO policies = anon/authed clients can neither read nor
--  write this table directly; the service role bypasses RLS by design.
--
--  Supabase → SQL Editor → Run.
-- ===========================================================================

create table if not exists public.events (
  id           bigint generated always as identity primary key,
  ts           timestamptz not null default now(),
  name         text not null,             -- allowlisted in /api/track
  tenant_slug  text not null default '',  -- '' for non-tenant events (campus page view)
  path         text not null default '',  -- location.pathname at fire time
  src          text not null default '',  -- qr | pickup | togo | directory | embed | direct
  session_hash text not null default '',  -- random per-session token (sessionStorage)
  meta         jsonb not null default '{}'::jsonb
);

-- Funnel reads are always name+window or tenant+window.
create index if not exists events_name_ts   on public.events (name, ts desc);
create index if not exists events_tenant_ts on public.events (tenant_slug, ts desc);

alter table public.events enable row level security;
-- (no policies on purpose — deny-all for anon/authenticated)

-- Retention (optional, run occasionally or wire to pg_cron later):
-- delete from public.events where ts < now() - interval '180 days';
