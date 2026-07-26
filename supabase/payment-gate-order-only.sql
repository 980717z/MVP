-- ===========================================================================
--  FIX: unpaid togo/delivery orders can't reach the kitchen in order_only shops
--
--  Symptom (reported from the floor): staff tap 开始备餐 on a phone/walk-in
--  takeout order and get
--      "状态更新失败,请重试: unpaid togo order cannot advance to preparing"
--  so the order can never be cooked through the system.
--
--  Cause: enforce_payment_gate() (orders-payment.sql) refuses to let a
--  togo/delivery order advance to preparing/delivering/done unless
--  payment_status='paid'. That rule was written for PAY-FIRST online ordering,
--  where letting an unpaid order reach the kitchen means giving away food.
--
--  But 富来's takeout orders are taken over the phone or at the counter and are
--  settled when the customer picks up — the same way dine-in is settled at
--  checkout. They are unpaid by design, so the gate blocks normal service.
--
--  The tenant already declares which model it runs: tenants.payment_mode
--  ('order_only' | 'pay_first', added in campus-pickup.sql). The Epson print
--  layer already respects it (app/api/epson/route.ts) — this trigger never did.
--  That inconsistency IS the bug: one layer thinks the shop is pay-at-pickup,
--  the other insists on pay-first.
--
--  Fix: scope the gate to pay_first tenants. order_only shops (the default,
--  incl. 富来 and every campus truck) let togo/delivery flow through the kitchen
--  unpaid and settle at handover, exactly like dine-in. A tenant that wires up
--  online payment flips payment_mode='pay_first' and gets the strict gate back,
--  so the free-food protection is preserved where it actually applies.
--
--  Cancellation stays always-allowed (unchanged): the refund runbook cancels
--  unpaid/expired/refunded orders. 'pickup' was never gated and still isn't.
--
--  Reversible: re-run the original function body from orders-payment.sql.
--  Supabase → SQL Editor → Run (idempotent).
-- ===========================================================================

create or replace function public.enforce_payment_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mode text;
begin
  if new.status in ('preparing','delivering','done')
     and new.order_type in ('togo','delivery')
     and new.payment_status <> 'paid' then

    -- Only pay-first tenants require payment before the kitchen. Missing row or
    -- NULL → treat as order_only (the column default), i.e. do not block service.
    select payment_mode into mode
      from public.tenants
     where slug = new.tenant_slug;

    if coalesce(mode, 'order_only') = 'pay_first' then
      raise exception 'unpaid % order cannot advance to % (tenant is pay_first)',
        new.order_type, new.status;
    end if;
  end if;
  return new;
end;
$$;

-- Trigger itself is unchanged; recreated so a fresh database gets it too.
drop trigger if exists orders_payment_gate on public.orders;
create trigger orders_payment_gate
  before insert or update on public.orders
  for each row execute function public.enforce_payment_gate();

-- ── Verify ────────────────────────────────────────────────────────────────
--  1) 富来 should be order_only (blank/NULL also counts as order_only):
--       select slug, payment_mode from public.tenants where slug = 'fulai';
--  2) An unpaid togo order should now advance:
--       update public.orders set status = 'preparing'
--        where tenant_slug = 'fulai' and order_type = 'togo'
--          and payment_status = 'unpaid' and status = 'new'
--        returning id, status;
--  3) A pay_first tenant must still be blocked (expect an exception).
-- ===========================================================================
