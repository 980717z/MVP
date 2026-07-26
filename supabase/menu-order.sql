-- ===========================================================================
--  菜单分类顺序：商家可自定义分类排序（如「火锅」排第一）
--  Supabase → SQL Editor → Run（可重复跑）
-- ===========================================================================

-- 在 tenants 上存一个分类顺序数组
alter table public.tenants add column if not exists cat_order jsonb not null default '[]'::jsonb;

-- 公开视图带上 cat_order，让扫码菜单页（anon）也能按自定义顺序展示
drop view if exists public.storefront;
create view public.storefront with (security_invoker = false) as
  select slug, name, cat_order from public.tenants;
grant select on public.storefront to anon, authenticated;

-- ===========================================================================
--  Done.
-- ===========================================================================
