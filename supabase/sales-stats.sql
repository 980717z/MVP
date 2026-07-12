-- ───────────────────────────────────────────────────────────────────────────
--  Sales statistics (销售统计) + tip recording — Supabase → SQL Editor → Run.
--  Re-runnable.
--
--  Tips are captured at checkout (per bill, and per share when 分单) and stored as
--  a SEPARATE line — never folded into sales or tax. table_sessions.tip is the
--  table-level total; per-share tips live inside the existing `splits` jsonb.
-- ───────────────────────────────────────────────────────────────────────────

-- 1) Tip on the checkout record (pass-through to staff; 0 when none entered).
alter table public.table_sessions add column if not exists tip numeric(10,2) not null default 0;

-- 2) Turn on the 销售统计 tab for fulai (idempotent jsonb append). Other tenants
--    enable it themselves from 增减功能.
update public.tenants
  set enabled = (
    select jsonb_agg(distinct e)
    from jsonb_array_elements(enabled || '["sales-stats"]'::jsonb) e
  )
  where slug = 'fulai';

-- 验证：select slug, enabled from tenants where slug='fulai';
