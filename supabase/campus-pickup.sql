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

-- 4) Consumer pickup-tracking read (RPC, NOT a bare view) -------------------
--  The tracking screen is anonymous. A bare anon-SELECT view would let anyone
--  drop the WHERE and dump every order. Instead: a SECURITY DEFINER function
--  gated by (order_id, tracking_token) that returns PUBLIC fields ONLY — never
--  phone/address/email. Token is the server-generated capability (Slice 2 route).
create or replace function public.get_order_tracking(p_order_id uuid, p_token text)
returns table (
  status       text,
  ready_at     timestamptz,
  picked_up_at timestamptz,
  eta_minutes  int,
  pickup_code  text,
  created_at   timestamptz,
  items        jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select o.status, o.ready_at, o.picked_up_at, o.eta_minutes, o.pickup_code, o.created_at,
    (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name_zh', it->>'name_zh', 'name_en', it->>'name_en', 'qty', it->'qty'
      )), '[]'::jsonb)
      from jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) it
      where coalesce((it->>'cancelled')::boolean, false) = false
    ) as items
  from public.orders o
  where o.id = p_order_id
    and o.tracking_token is not null
    and o.tracking_token = p_token   -- constant-time enough at 1 row; token is high-entropy
    and o.order_type = 'pickup'
$$;
-- Only the token-gated function is callable by anon; no table/view grant.
revoke all on function public.get_order_tracking(uuid, text) from public;
grant execute on function public.get_order_tracking(uuid, text) to anon, authenticated;
