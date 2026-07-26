-- ===========================================================================
--  二维码菜单：让顾客（未登录）也能扫码查看菜单
--  Supabase → SQL Editor → Run（可重复跑）
--  说明：菜单是要公开给顾客看的，所以 menu_items 对 anon 开放只读；
--        商家名通过一个最小视图暴露（只露 slug + name，不露 owner/enabled）。
-- ===========================================================================

-- 1) menu_items 公开只读。菜单本就是给顾客看的公开数据,所以对 anon 与
--    authenticated 都开放读 —— 否则一个登录中的商家(或落地页内嵌菜单的
--    登录访客)去看别家的公开菜单时,会走到「只看自己店」的策略而看到空菜单。
grant select on public.menu_items to anon, authenticated;
drop policy if exists menu_items_public_read on public.menu_items;
create policy menu_items_public_read on public.menu_items
  for select to anon, authenticated using (true);

-- 2) 仅暴露店名的最小视图（绕过 tenants 的 RLS，只给 slug + name）
drop view if exists public.storefront;
create view public.storefront with (security_invoker = false) as
  select slug, name from public.tenants;
grant select on public.storefront to anon, authenticated;

-- ===========================================================================
--  Done. 现在 /menu/<slug> 公开页可被任何人访问。
-- ===========================================================================
