-- ===========================================================================
--  Customer bill printing — Supabase → SQL Editor → Run（可重复跑）
--  A second print document: the priced 账单 (items + GST + PST + 合计), printed
--  when staff taps 标记完成 or 打印账单. The kitchen ticket uses printed_at; the
--  bill uses its own pair so both can print for the same order at different times.
--    bill_at          — set when a bill is requested (queues it for the printer)
--    bill_printed_at  — set when the printer has printed it (null while pending)
--  The Epson poll serves kitchen tickets first, then any pending bill.
-- ===========================================================================

alter table public.orders add column if not exists bill_at timestamptz;
alter table public.orders add column if not exists bill_printed_at timestamptz;

-- Pending-bill lookup for the printer poll: requested but not yet printed.
create index if not exists orders_bill_pending_idx
  on public.orders (tenant_slug, bill_at)
  where bill_at is not null and bill_printed_at is null;

-- The anon-insert policy pins new rows to specific values; these new columns
-- default null and anon never sets them, so no policy change is needed. Staff
-- (authenticated tenant members) set bill_at via the existing member-update policy.

-- Verify:
--   select id, status, bill_at, bill_printed_at from orders order by created_at desc limit 5;
