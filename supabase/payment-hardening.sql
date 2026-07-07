-- ===========================================================================
--  Payment hardening (eng-review 2026-07-07) — Supabase → SQL Editor → Run
--  Adds the 'reconcile_pending' payment state: a charge whose outcome is
--  UNKNOWN (network timeout / 5xx) and MAY have landed at Clover. The charge
--  route parks the order here instead of resetting to 'unpaid' (which would let
--  the diner blind-retry and double-charge). The reconcile job (app/api/pay/
--  reconcile) then asks Clover whether the charge landed and resolves it to
--  'paid' or 'unpaid'. Idempotent / re-runnable.
--  Plan: ~/.gstack/projects/MVP/allen-main-payment-hardening-20260707.md
-- ===========================================================================

alter table public.orders drop constraint if exists orders_payment_status_chk;
alter table public.orders add constraint orders_payment_status_chk
  check (payment_status in ('unpaid','pending','paid','expired','refunded','reconcile_pending'));

-- Reconcile sweep target: orders stuck awaiting a charge-outcome confirmation.
create index if not exists orders_reconcile_idx
  on public.orders (tenant_slug, payment_status, created_at)
  where payment_status = 'reconcile_pending';

-- The payment gate already blocks any non-'paid' togo/delivery order from the
-- kitchen, so 'reconcile_pending' is correctly held back with no further change.
-- The anon-insert policy pins new rows to 'unpaid', so anon can never author a
-- 'reconcile_pending' or 'pending' row — those are server (service-role) writes.

-- Verify:
--   select payment_status, count(*) from orders group by 1;
