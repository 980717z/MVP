-- ===========================================================================
--  配送范围：让扫码菜单页（anon）能读到商家的配送 FSA 白名单
--  Supabase → SQL Editor → Run（可重复跑）
--  依赖：orders-payment.sql 已加 tenants.delivery_fsas（已跑过）。
--  这里只把该字段加进公开的 storefront 视图，顾客端据此做邮编→区域校验。
-- ===========================================================================

drop view if exists public.storefront;
create view public.storefront with (security_invoker = false) as
  select slug, name, cat_order, delivery_fsas from public.tenants;
grant select on public.storefront to anon, authenticated;

-- ===========================================================================
--  Done. 验证：select slug, delivery_fsas from storefront where slug='fulai';
-- ===========================================================================
