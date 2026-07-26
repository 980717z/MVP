-- ===========================================================================
--  Pickup orders are SERVER-ROUTE-ONLY (eng review T1 / codex finding #1).
--
--  Why: diners insert orders directly with the public anon key (orders.sql:
--  `grant insert on public.orders to anon` + orders_public_insert). That is fine
--  for dine-in — the QR menu writes the row itself. But the campus PICKUP flow
--  added business rules that live in /api/pickup/create:
--
--    • the truck-hours gate (can't order from a closed truck)
--    • server-minted tracking_token + pickup_code
--    • server-side re-pricing from menu_items (client prices are ignored)
--
--  The previous guard (campus-pickup.sql / pickup-time.sql) only forced the
--  server-written COLUMNS to null on anon insert. It did not stop an anon client
--  from creating an order_type='pickup' row outright — so anyone with devtools
--  could bypass the route entirely: no hours check, no valid pickup code, but
--  still a printable kitchen ticket. The gate looked enforced in code review
--  while not actually being load-bearing.
--
--  This replaces that guard with one that also forbids the TYPE. Pickup can now
--  only be created by the service role (the server route), which bypasses RLS.
--
--  Scope check before you run this:
--    • `to anon` only — staff/back-office run as `authenticated` and are not
--      affected (NewOrderModal's togo/delivery orders keep working).
--    • The only client that creates pickup orders is lib/pickup.ts →
--      POST /api/pickup/create (service role). Verified: no client-side insert
--      path sets order_type='pickup'; lib/orders.ts createOrder defaults to
--      'dine_in' and is used for dine_in/togo/delivery.
--
--  PREREQUISITE: run supabase/pickup-time.sql FIRST. This policy references
--  requested_pickup_at, so it errors ("column does not exist") until that
--  migration has added the column.
--
--  Reversible: re-run the policy body from pickup-time.sql to drop the
--  order_type condition.
--  Supabase → SQL Editor → Run (idempotent).
-- ===========================================================================

drop policy if exists orders_anon_insert_pickup_guard on public.orders;
create policy orders_anon_insert_pickup_guard on public.orders
  as restrictive for insert to anon
  with check (
    -- Pickup must go through /api/pickup/create (service role bypasses RLS).
    order_type <> 'pickup'
    -- Server-written pickup columns stay null on any anon insert.
    and ready_at is null and picked_up_at is null
    and pickup_code is null and tracking_token is null
    and requested_pickup_at is null
  );

-- ── Verify ────────────────────────────────────────────────────────────────
--  As anon this must FAIL (new row violates row-level security policy):
--    insert into public.orders (tenant_slug, items, total, table_no, phone, order_type)
--    values ('pita-express', '[]'::jsonb, 0, '', 'N/A', 'pickup');
--  ...and a normal dine-in insert must still succeed.
-- ===========================================================================
