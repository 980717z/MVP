-- ─────────────────────────────────────────────────────────────────────────
--  富来 (fulai) — 清空打印队列 / flush the whole print queue.
--
--  Run in Supabase Studio → SQL Editor. Non-destructive: it only STAMPS the
--  "already printed" timestamps, so queued documents stop being served to the
--  printer. No order, bill or sales figure is deleted or changed.
--  Idempotent, fulai-only.
--
--  /api/epson serves THREE queues per poll, in this order:
--    1. orders.printed_at IS NULL                          → 厨房单 kitchen tickets
--    2. print_jobs.printed_at IS NULL                      → 分单 split sub-bills
--    3. orders.bill_at NOT NULL AND bill_printed_at IS NULL → 账单 customer bills
--  A stuck queue can live in any of them, so flush all three.
-- ─────────────────────────────────────────────────────────────────────────

-- ── 0) KILL SWITCH — stop the printer draining while you work ────────────
update public.tenants set print_enabled = false where slug = 'fulai';


-- ── 1) PREVIEW — what is actually queued right now ───────────────────────
select '1_kitchen_tickets' as queue, count(*) as pending
from public.orders
where tenant_slug = 'fulai' and printed_at is null and status <> 'cancelled'
union all
select '2_split_jobs', count(*)
from public.print_jobs
where tenant_slug = 'fulai' and printed_at is null
union all
select '3_customer_bills', count(*)
from public.orders
where tenant_slug = 'fulai' and bill_at is not null
  and bill_printed_at is null and status <> 'cancelled';

-- Detail of the kitchen-ticket queue (oldest first = print order):
select id, order_no, order_type, table_no, status, created_at, requested_pickup_at
from public.orders
where tenant_slug = 'fulai' and printed_at is null and status <> 'cancelled'
order by created_at
limit 50;


-- ── 2) FLUSH ─────────────────────────────────────────────────────────────
-- 2a) kitchen tickets
update public.orders
set printed_at = now()
where tenant_slug = 'fulai' and printed_at is null;

-- 2b) split-bill jobs (分单)
update public.print_jobs
set printed_at = now()
where tenant_slug = 'fulai' and printed_at is null;

-- 2c) customer bills (账单)
update public.orders
set bill_printed_at = now()
where tenant_slug = 'fulai' and bill_at is not null and bill_printed_at is null;


-- ── 3) VERIFY — all three counts must be 0 ───────────────────────────────
select '1_kitchen_tickets' as queue, count(*) as pending
from public.orders
where tenant_slug = 'fulai' and printed_at is null and status <> 'cancelled'
union all
select '2_split_jobs', count(*)
from public.print_jobs
where tenant_slug = 'fulai' and printed_at is null
union all
select '3_customer_bills', count(*)
from public.orders
where tenant_slug = 'fulai' and bill_at is not null
  and bill_printed_at is null and status <> 'cancelled';


-- ── 4) RE-ARM printing ───────────────────────────────────────────────────
-- Do this only AFTER step 3 shows zeros and the printer has been power-cycled
-- (its own buffer holds the job it is currently chewing on — the DB can't clear
-- that; see the note below).
update public.tenants set print_enabled = true where slug = 'fulai';


-- ─────────────────────────────────────────────────────────────────────────
--  Optional: keep TODAY's real orders printable, flush only the backlog.
--  Use this INSTEAD of 2a if the shop is mid-service and you only want to drop
--  yesterday-and-older tickets (business day starts 7am Toronto for fulai).
--
--    update public.orders
--    set printed_at = now()
--    where tenant_slug = 'fulai'
--      and printed_at is null
--      and created_at < (((now() at time zone 'America/Toronto')::date + time '07:00')
--                        at time zone 'America/Toronto');
--
--  Re-print anything flushed by mistake: 重打 on the order card in the back
--  office (it nulls printed_at → prints on the next poll).
-- ─────────────────────────────────────────────────────────────────────────
