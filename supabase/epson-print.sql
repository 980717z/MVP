-- ===========================================================================
--  Epson Server Direct Print — the printer pulls tickets, so we track which
--  orders have already printed. Supabase → SQL Editor → Run (可重复跑).
-- ===========================================================================

alter table public.orders add column if not exists printed_at timestamptz;

-- fast lookup of the next un-printed order per shop
create index if not exists orders_unprinted_idx
  on public.orders (tenant_slug, created_at)
  where printed_at is null;

-- (tenants.print_enabled already exists from supabase/printers.sql and is honored.)
-- ===========================================================================
--  Done.
-- ===========================================================================
