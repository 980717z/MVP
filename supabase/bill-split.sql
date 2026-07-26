-- ───────────────────────────────────────────────────────────────────────────
--  Bill splitting (分单) — Supabase → SQL Editor → Run. Re-runnable.
--
--  A split is a PRESENTATION + RECORD layer on ONE atomic table settle. The
--  checkout still claims every unpaid dine-in order in a single UPDATE (the
--  exactly-once anchor); the split only records HOW the settle was divided and
--  queues one receipt per share + a full bill for the Epson to print.
-- ───────────────────────────────────────────────────────────────────────────

-- 1) Record the split on the checkout row (single bill → splits '[]').
alter table public.table_sessions add column if not exists splits    jsonb not null default '[]'::jsonb;
alter table public.table_sessions add column if not exists split_mode text  not null default 'single'; -- 'single' | 'even' | 'item'

-- 2) Print-job queue. The Epson pulls ONE document per poll; N sub-bills + a full
--    bill means N+1 queued jobs, drained FIFO. Server-only: the checkout route
--    enqueues and the /api/epson poll drains, both via the service role. anon and
--    authenticated get nothing (RLS on, no policies → deny; service_role bypasses).
create table if not exists public.print_jobs (
  id           uuid primary key default gen_random_uuid(),
  tenant_slug  text not null references public.tenants(slug) on delete cascade,
  table_no     text not null,
  kind         text not null,                        -- 'share' | 'full'
  seq          int  not null default 0,              -- print order within a checkout
  payload      jsonb not null,                       -- rendered receipt spec (label, method, lines, totals…)
  session_id   uuid references public.table_sessions(id) on delete set null,
  created_at   timestamptz not null default now(),
  printed_at   timestamptz                           -- CAS claim on Epson poll
);

-- pending-jobs probe, oldest first (FIFO within a checkout by seq)
create index if not exists print_jobs_pending
  on public.print_jobs (tenant_slug, created_at, seq)
  where printed_at is null;

alter table public.print_jobs enable row level security;
-- No policies on purpose: only the server (service role) touches this table.
grant all on public.print_jobs to service_role;

-- 验证：select id, kind, seq, printed_at from print_jobs order by created_at desc limit 10;
