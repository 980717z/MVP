-- ─────────────────────────────────────────────────────────────────────────
--  Table-plan (floor plan) feature — simple model.
--
--  Operator sees only TWO table states, both DERIVED from orders (no ceremony):
--    • 空闲 empty     — no unpaid dine-in orders at the table
--    • 用餐中 has-order — ≥1 unpaid dine-in order  (checkout settles them)
--  There is NO check-in (入座) and NO "checking-out" limbo state — a table
--  lights up when an order arrives and clears when it's paid.
--
--  `table_sessions` is therefore just a CHECKOUT RECORD: exactly one row is
--  written when the waiter hits 结账, capturing how the table paid (method +
--  cash tendered + change) and the totals, for the day's books. It is NOT an
--  open/close lifecycle. Dine-in pays at the counter — this records the payment,
--  it is not an online charge.
--
--  Exactly-once sales posting is anchored per-order on orders.sales_posted_at
--  (CAS), because two of the three posting fns are not idempotent.
--
--  QR contract: NEVER touches tenants.tables (printed labels). Layout is
--  additive metadata keyed by the existing label strings.
-- ─────────────────────────────────────────────────────────────────────────

-- 1) Checkout record --------------------------------------------------------
create table if not exists public.table_sessions (
  id             uuid primary key default gen_random_uuid(),
  tenant_slug    text not null references public.tenants(slug) on delete cascade,
  table_no       text not null,                       -- a tenants.tables label
  closed_at      timestamptz not null default now(),  -- when 结账 happened
  closed_by      uuid,                                -- member who checked out
  payment_method text not null,                       -- 'cash' | 'card' | 'other'
  amount_tendered numeric(10,2),                       -- cash handed over (null for card/other)
  change_given   numeric(10,2),                        -- tendered − total (cash)
  subtotal       numeric(10,2) not null,
  gst            numeric(10,2) not null,
  pst            numeric(10,2) not null,
  total          numeric(10,2) not null,
  business_date  date not null,                        -- shop-tz day (reporting)
  note           text,
  -- cash checkout can't hand back more than was tendered vs total
  constraint table_sessions_cash_chk
    check (payment_method <> 'cash' or amount_tendered is null or amount_tendered >= total)
);

-- Table history + day-book reads.
create index if not exists table_sessions_lookup
  on public.table_sessions (tenant_slug, table_no, closed_at desc);
create index if not exists table_sessions_day
  on public.table_sessions (tenant_slug, business_date);

alter table public.table_sessions enable row level security;

-- Tenant members only; the anon QR customer never touches this table.
drop policy if exists table_sessions_select on public.table_sessions;
create policy table_sessions_select on public.table_sessions
  for select using (public.can_access_tenant(tenant_slug));
drop policy if exists table_sessions_write on public.table_sessions;
create policy table_sessions_write on public.table_sessions
  for all using (public.can_access_tenant(tenant_slug))
  with check (public.can_access_tenant(tenant_slug));

-- Supabase RLS sits ON TOP of table GRANTs — without this the policies never
-- get a chance to run and staff reads fail with "permission denied". anon gets
-- nothing (the QR customer never touches this table).
grant select, insert, update on public.table_sessions to authenticated;

-- 2) Order links ------------------------------------------------------------
--  table_session_id: stamped onto the orders a checkout settled (audit / "paid
--  history" per table). sales_posted_at: per-order exactly-once marker (dine-in
--  posts at checkout; togo/delivery post on payment).
alter table public.orders add column if not exists table_session_id uuid references public.table_sessions(id) on delete set null;
alter table public.orders add column if not exists sales_posted_at timestamptz;
create index if not exists orders_session_idx on public.orders (table_session_id);
-- occupancy probe: does a table have any unpaid dine-in order? (drives empty vs has-order)
create index if not exists orders_dinein_open_idx
  on public.orders (tenant_slug, table_no, created_at)
  where order_type = 'dine_in' and payment_status = 'unpaid';

-- 3) Floor-plan layout (additive metadata; NEVER the source of table identity)
alter table public.tenants add column if not exists table_layout jsonb not null default '[]'::jsonb;

-- Seed fulai's layout from the hand-drawn map. Coords are RELATIVE (0..1) so the
-- map scales on phone vs tablet. shape: 'square' | 'round'. Any label in
-- tenants.tables WITHOUT an entry here falls back to auto-grid in the UI.
update public.tenants set table_layout = '[
  {"label":"1","x":0.09,"y":0.14,"shape":"square"},
  {"label":"3","x":0.09,"y":0.35,"shape":"square"},
  {"label":"5","x":0.09,"y":0.56,"shape":"square"},
  {"label":"7","x":0.09,"y":0.76,"shape":"round"},
  {"label":"11","x":0.09,"y":0.90,"shape":"square"},
  {"label":"2","x":0.41,"y":0.07,"shape":"square"},
  {"label":"2A","x":0.59,"y":0.07,"shape":"square"},
  {"label":"4","x":0.50,"y":0.22,"shape":"round"},
  {"label":"6","x":0.50,"y":0.41,"shape":"round"},
  {"label":"8","x":0.50,"y":0.58,"shape":"round"},
  {"label":"8A","x":0.41,"y":0.72,"shape":"square"},
  {"label":"8B","x":0.59,"y":0.72,"shape":"square"},
  {"label":"10","x":0.50,"y":0.84,"shape":"round"},
  {"label":"12","x":0.50,"y":0.97,"shape":"round"}
]'::jsonb
where slug = 'fulai';
