-- ===========================================================================
--  Scheduled pickup time — student picks WHEN they'll pick up, at order time.
--  (Order at 11:40 from the lecture hall, pick up at 12:15 at the truck.)
--
--  requested_pickup_at is SERVER-written only (/api/pickup/create validates a
--  sane window); like the other pickup columns it is forced null on the anon
--  direct-insert path. NULL = ASAP (the pre-existing behaviour, staff set an
--  ETA on accept).
--
--  Also recreates get_order_tracking to expose the field to the anonymous
--  tracking screen. Postgres cannot ALTER a function's return type, so the
--  function is dropped and recreated (same body + one column), then re-granted.
--
--  Run AFTER campus-pickup.sql. Idempotent. Supabase → SQL Editor → Run.
-- ===========================================================================

alter table public.orders add column if not exists requested_pickup_at timestamptz;

-- Anon direct inserts must not set it (server route uses the service role).
drop policy if exists orders_anon_insert_pickup_guard on public.orders;
create policy orders_anon_insert_pickup_guard on public.orders
  as restrictive for insert to anon
  with check (
    ready_at is null and picked_up_at is null
    and pickup_code is null and tracking_token is null
    and requested_pickup_at is null
  );

-- Tracking RPC: same contract + requested_pickup_at (public, non-PII).
drop function if exists public.get_order_tracking(uuid, text);
create function public.get_order_tracking(p_order_id uuid, p_token text)
returns table (
  status              text,
  ready_at            timestamptz,
  picked_up_at        timestamptz,
  eta_minutes         int,
  pickup_code         text,
  created_at          timestamptz,
  requested_pickup_at timestamptz,
  items               jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select o.status, o.ready_at, o.picked_up_at, o.eta_minutes, o.pickup_code, o.created_at,
    o.requested_pickup_at,
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
    and o.tracking_token = p_token
    and o.order_type = 'pickup'
$$;
revoke all on function public.get_order_tracking(uuid, text) from public;
grant execute on function public.get_order_tracking(uuid, text) to anon, authenticated;
