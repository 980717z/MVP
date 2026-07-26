-- ───────────────────────────────────────────────────────────────────────────
--  Payment-method tracking mode — Supabase → SQL Editor → Run. Re-runnable.
--
--  track_payments = true  → checkout lets staff choose 现金/EMT/刷卡; 销售统计
--                           shows the per-method breakdown.
--  track_payments = false → no method choice at checkout; everything is recorded
--                           as plain sales and the method stats are hidden.
--  Toggled from the top-right of 在线点餐订单. Default ON.
-- ───────────────────────────────────────────────────────────────────────────
alter table public.tenants add column if not exists track_payments boolean not null default true;

-- 验证：select slug, track_payments from tenants where slug='fulai';
