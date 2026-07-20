-- ===========================================================================
--  二维码菜单模式显隐 tenants.qr_hidden_modes
--  三种点单码模式:tables(每桌一码/堂食)、togo(外卖自取)、single(整店一码)。
--  本列只控制「后台二维码菜单页」显示哪几个模式 tab —— 不影响任何已生成/已印的
--  二维码 URL(永久 QR 合约不变)。餐车等无堂食的商家可隐藏 tables。
--  值为被隐藏模式的数组;默认空 = 三个都显示。Supabase → SQL Editor → Run(可重复跑)。
-- ===========================================================================

alter table public.tenants
  add column if not exists qr_hidden_modes text[] not null default '{}';

-- 示例(可选):Pita Express 是餐车,没有堂食桌码 → 隐藏 tables
--   update public.tenants set qr_hidden_modes = array['tables'] where slug = 'pita-express';

select slug, qr_hidden_modes from public.tenants where slug = 'pita-express';
-- ===========================================================================
--  Done.
-- ===========================================================================
