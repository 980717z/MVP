-- ===========================================================================
--  Enforce order_modes at the DB edge (VT1 follow-up / eng review).
--
--  VT1 hides Tables/Delivery/Market in the UI for a pickup-only campus truck,
--  and the customer menu forces the pickup flow. But togo/delivery/dine-in
--  orders are still created by an ANON client insert (lib/orders.ts createOrder
--  → direct PostgREST insert, gated only by RLS). So today a crafted anon insert
--  can still drop a `togo` or `delivery` order onto a pickup-only truck — the UI
--  guard is not load-bearing. This closes that gap: an anon insert's order_type
--  must correspond to a mode the tenant actually offers.
--
--  PREREQUISITE: supabase/order-modes.sql (adds tenants.order_modes).
--
--  Why a SECURITY DEFINER function, not an inline subquery: an RLS WITH CHECK
--  expression runs as the INSERTING role (anon), and anon cannot SELECT
--  public.tenants (that's why the storefront view exists). An inline
--  `select from tenants` would therefore return no rows and block EVERY anon
--  insert. The function runs as its owner, reads order_modes, and is the only
--  tenants access anon gets — narrow and safe.
--
--  Reversible: drop the policy + function.
--  Supabase → SQL Editor → Run (idempotent).
-- ===========================================================================

-- Map an order_type to its order_mode and test it against the tenant's offered
-- modes. Unset order_modes ('{}') or an unknown tenant → allowed (back-compat;
-- other guards handle a bad tenant). Campus market price is a dish attribute,
-- not an order_type, so it isn't mapped here.
create or replace function public.order_mode_allowed(p_slug text, p_order_type text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select array_length(order_modes, 1) is null
          or array_length(order_modes, 1) = 0
          or (case p_order_type
                when 'dine_in'  then 'dine'
                when 'togo'     then 'togo'
                when 'delivery' then 'delivery'
                when 'pickup'   then 'pickup'
                else p_order_type
              end) = any (order_modes)
      from public.tenants
      where slug = p_slug
    ),
    true  -- unknown tenant: don't hard-block here
  );
$$;

revoke all on function public.order_mode_allowed(text, text) from public;
grant execute on function public.order_mode_allowed(text, text) to anon, authenticated;

-- Restrictive → ANDs with the existing pickup guard. An anon insert must be for
-- a mode the tenant offers. (Staff/back-office run as `authenticated` and are
-- not affected, matching the pickup guard's scope.)
drop policy if exists orders_anon_insert_mode_guard on public.orders;
create policy orders_anon_insert_mode_guard on public.orders
  as restrictive for insert to anon
  with check ( public.order_mode_allowed(tenant_slug, order_type) );

-- ── Verify ────────────────────────────────────────────────────────────────
--  Pita is pickup-only, so as anon this must FAIL (violates RLS):
--    insert into public.orders (tenant_slug, items, total, table_no, phone, order_type)
--    values ('pita-express', '[]'::jsonb, 0, '', '4165551234', 'togo');
--  A dine-in insert on a normal restaurant (order_modes unset) still succeeds.
-- ===========================================================================
