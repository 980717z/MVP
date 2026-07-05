-- ===========================================================================
--  沽清（售罄）标记：临时缺货的菜可在后台一键标记，顾客菜单显示"沽清"、
--  不能下单；有货了取消标记即可。可重复跑。
--  menu_items 已对 anon 只读开放（menu-public.sql），加列即自动生效。
-- ===========================================================================

alter table public.menu_items
  add column if not exists sold_out boolean not null default false;

-- 验证：select name_zh, sold_out from menu_items where tenant_slug='fulai' and sold_out;
