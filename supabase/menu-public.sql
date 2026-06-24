-- ===========================================================================
--  二维码菜单：让顾客（未登录）也能扫码查看菜单
--  Supabase → SQL Editor → Run（可重复跑）
--  说明：菜单是要公开给顾客看的，所以 menu_items 对 anon 开放只读；
--        商家名通过一个最小视图暴露（只露 slug + name，不露 owner/enabled）。
-- ===========================================================================

-- 1) menu_items 对未登录用户开放只读
grant select on public.menu_items to anon;
drop policy if exists menu_items_public_read on public.menu_items;
create policy menu_items_public_read on public.menu_items
  for select to anon using (true);

-- 2) 仅暴露店名的最小视图（绕过 tenants 的 RLS，只给 slug + name）
drop view if exists public.storefront;
create view public.storefront with (security_invoker = false) as
  select slug, name from public.tenants;
grant select on public.storefront to anon, authenticated;

-- ===========================================================================
--  Done. 现在 /menu/<slug> 公开页可被任何人访问。
-- ===========================================================================
