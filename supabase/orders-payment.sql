-- ===========================================================================
--  扫码配送 + Clover 支付 — Phase 1 schema
--  Plan: ~/.gstack/projects/980717z-MVP/ceo-plans/2026-07-03-qr-delivery-clover-payments.md
--  Supabase → SQL Editor → Run（可重复跑）
--
--  Order model (two orthogonal fields):
--    status          kitchen : new → preparing → [delivering] → done | cancelled
--    payment_status  money   : unpaid → pending → paid | expired | refunded
--  Gate: togo/delivery orders reach the kitchen ONLY at payment_status='paid'
--        (enforced by trigger below + /api/print refusal + UI filter).
-- ===========================================================================

-- ── 1. Order columns ────────────────────────────────────────────────────────
alter table public.orders add column if not exists order_type text not null default 'dine_in';
alter table public.orders add column if not exists payment_status text not null default 'unpaid';
alter table public.orders add column if not exists payment_method text not null default '';
alter table public.orders add column if not exists tip numeric not null default 0;
alter table public.orders add column if not exists subtotal numeric;          -- server-written at re-price
alter table public.orders add column if not exists gst numeric;               -- server-written
alter table public.orders add column if not exists pst numeric;               -- server-written
alter table public.orders add column if not exists customer_email text;       -- optional: receipts + notify
alter table public.orders add column if not exists address jsonb;             -- {street,unit,postal,note}
alter table public.orders add column if not exists eta_minutes int;           -- driver's manual ETA input
alter table public.orders add column if not exists clover_checkout_id text;   -- idempotency + reconcile
alter table public.orders add column if not exists paid_at timestamptz;

alter table public.orders drop constraint if exists orders_type_chk;
alter table public.orders add constraint orders_type_chk
  check (order_type in ('dine_in','togo','delivery'));

alter table public.orders drop constraint if exists orders_payment_status_chk;
alter table public.orders add constraint orders_payment_status_chk
  check (payment_status in ('unpaid','pending','paid','expired','refunded'));

-- status had NO check constraint before (values lived in a comment) — add it,
-- including the new 'delivering' stage for delivery orders. (eng-review E3)
alter table public.orders drop constraint if exists orders_status_chk;
alter table public.orders add constraint orders_status_chk
  check (status in ('new','preparing','delivering','done','cancelled'));

create index if not exists orders_pending_idx
  on public.orders (tenant_slug, payment_status, created_at)
  where payment_status = 'pending';

-- ── 2. SECURITY: anon can only ever insert a brand-new, unpaid row ──────────
-- (spec-review 1.1 + r2-2: without this, a diner could insert payment_status=
-- 'paid' with the public anon key and get free food printed to the kitchen.)
drop policy if exists orders_public_insert on public.orders;
create policy orders_public_insert on public.orders
  for insert to anon, authenticated
  with check (
    payment_status = 'unpaid'
    and paid_at is null
    and clover_checkout_id is null
    and payment_method = ''
    and status = 'new'
    and tip = 0
    and eta_minutes is null
    and subtotal is null and gst is null and pst is null
  );
-- Payment/money columns are written only by server routes (service role) or
-- authenticated staff routes that verify tenant membership then use the
-- service role. 标记已收款 shares the webhook's CAS (WHERE paid_at IS NULL).

-- ── 3. GATE IN DB: unpaid togo/delivery can never advance in the kitchen ────
-- (spec-review 2.2 + r2-3: cancellation is ALWAYS allowed — the refund runbook
-- cancels unpaid/expired/refunded orders.)
create or replace function public.enforce_payment_gate()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('preparing','delivering','done')
     and new.order_type in ('togo','delivery')
     and new.payment_status <> 'paid' then
    raise exception 'unpaid % order cannot advance to %', new.order_type, new.status;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_payment_gate on public.orders;
create trigger orders_payment_gate
  before insert or update on public.orders
  for each row execute function public.enforce_payment_gate();

-- ── 4. Tenant additions: named tables · delivery zone · hours ───────────────
-- 富来小厨's physical tables (each gets its own QR): 1,2,2A,3,4,5,6,7,8,8A,8B,10,11,12
alter table public.tenants add column if not exists tables jsonb not null default '[]'::jsonb;

-- Toronto-DT delivery zone as postal FSA whitelist (editable; zone UI is Phase 3).
-- Excluded on purpose: M5M/M5N/M5P/M5R (midtown), M5W (PO boxes). M5X = First
-- Canadian Place (offices — deliverable).
alter table public.tenants add column if not exists delivery_fsas jsonb not null default
  '["M4W","M4X","M4Y","M5A","M5B","M5C","M5E","M5G","M5H","M5J","M5K","M5L","M5S","M5T","M5V","M5X"]'::jsonb;

-- Ordering hours "HH:MM" 24h, checked server-side before checkout-session
-- creation; empty string = no limit.
alter table public.tenants add column if not exists order_open text not null default '';
alter table public.tenants add column if not exists order_close text not null default '';

-- Seed 富来小厨's table list
update public.tenants
  set tables = '["1","2","2A","3","4","5","6","7","8","8A","8B","10","11","12"]'::jsonb
  where slug = 'fulai';

-- ===========================================================================
--  Done. Verify:
--    select order_type, payment_status, count(*) from orders group by 1,2;
--    select slug, tables, delivery_fsas from tenants where slug='fulai';
-- ===========================================================================
