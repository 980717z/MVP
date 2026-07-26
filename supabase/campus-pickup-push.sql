-- ===========================================================================
--  Campus Food Pickup — Phase 1 · Slice 5: consumer "ready" push.
--  Idempotent: safe to re-run. Supabase → SQL Editor → Run.
--
--  The DINER (anonymous) opts in on the tracking screen to get an OS push when
--  their order flips to READY. This is the OPPOSITE direction from the merchant
--  push (public.push_subscriptions): keyed by ORDER, not tenant/uid.
--
--  Lockdown (eng-review, codex): NO raw anon insert — that's a spam / DoS /
--  existence-oracle vector. The table has RLS ON with NO policies, so neither
--  anon nor authenticated can read or write it. The only writers are the
--  service-role routes (/api/pickup/subscribe verifies the tracking_token
--  before inserting; /api/pickup/notify reads to send). unique(order_id,
--  endpoint_hash) dedupes; a per-order cap is enforced in the route.
-- ===========================================================================

create table if not exists public.order_push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  endpoint_hash text not null,           -- sha256(endpoint): dedupe key, cheap to index
  endpoint      text not null,
  p256dh        text not null,
  auth          text not null,
  created_at    timestamptz not null default now(),
  unique (order_id, endpoint_hash)
);

create index if not exists order_push_subscriptions_order_idx
  on public.order_push_subscriptions (order_id);

-- RLS ON + zero policies ⇒ no anon/authenticated access at all. The service
-- role (used by the subscribe/notify API routes) bypasses RLS by design.
alter table public.order_push_subscriptions enable row level security;
