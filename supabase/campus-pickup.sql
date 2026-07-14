-- ===========================================================================
--  Campus Food Pickup — Phase 1 schema (order-ahead pickup).
--  Idempotent: safe to re-run. Supabase → SQL Editor → Run.
--
--  Adds order-ahead PICKUP as a first-class fulfillment type, plus per-tenant
--  payment mode. Consumer fulfillment state is tracked with additive TIMESTAMPS
--  (ready_at / picked_up_at) — the status enum is deliberately NOT extended, so
--  the dine-in flow (OrdersPortal maps, Epson eligibility, sales-posting) is
--  untouched. `tracking_token` is a server-generated capability for the anon
--  pickup-tracking read (never the order UUID). See the campus-pickup design doc.
-- ===========================================================================

-- 1) New fulfillment type + per-tenant payment mode ------------------------
alter table public.orders drop constraint if exists orders_order_type_chk;
alter table public.orders
  add constraint orders_order_type_chk
  check (order_type in ('dine_in','togo','delivery','pickup'));

alter table public.tenants
  add column if not exists payment_mode text not null default 'order_only';
alter table public.tenants drop constraint if exists tenants_payment_mode_chk;
alter table public.tenants
  add constraint tenants_payment_mode_chk
  check (payment_mode in ('order_only','pay_first'));

-- 2) Pickup fulfillment state (additive timestamps) + tracking -------------
alter table public.orders add column if not exists ready_at       timestamptz;
alter table public.orders add column if not exists picked_up_at   timestamptz;
alter table public.orders add column if not exists pickup_code    text;
alter table public.orders add column if not exists tracking_token text;

-- Fast lookup by the capability token (tracking RPC in Slice 2).
create index if not exists orders_tracking_token_idx
  on public.orders (tracking_token) where tracking_token is not null;

-- 3) Lock down the new columns from anon inserts ---------------------------
--  Anon still inserts orders client-side (RLS pins status/payment). These
--  pickup columns are SERVER-written only (pickup order-create route, Slice 2):
--  a WITH CHECK that forces them null on anon insert. Server routes use the
--  service role and bypass RLS, so they can set them.
drop policy if exists orders_anon_insert_pickup_guard on public.orders;
create policy orders_anon_insert_pickup_guard on public.orders
  as restrictive for insert to anon
  with check (
    ready_at is null and picked_up_at is null
    and pickup_code is null and tracking_token is null
  );

-- NOTE: the existing pay-first trigger (orders-payment.sql) only gates
-- order_type in ('togo','delivery'); 'pickup' is naturally exempt, so unpaid
-- pickup orders can advance to the kitchen. Payment for pickup is enforced (or
-- not) per tenant via tenants.payment_mode at the Epson eligibility layer.
