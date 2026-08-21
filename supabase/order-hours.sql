-- ===========================================================================
--  接单时间 order_hours —— 自提(pickup)/配送(delivery)各自的每周营业时段,
--  顾客下单时的「现在 / 预约时段」按这个截止。沿用 campus_vendors.hours 的结构:
--    { "pickup":   { "mon": [["11:00","21:00"]], "tue": [], ... },
--      "delivery": { "mon": [["11:00","20:00"]], ... } }
--  某天空数组 = 当天该渠道不接单;整体空/缺失 = 未配置(视为不限时,不拦单)。
--  时间为 America/Toronto 本地。Supabase → SQL Editor → Run(可重复跑)。
-- ===========================================================================
alter table public.tenants add column if not exists order_hours jsonb;

-- 暴露到匿名可读的 storefront 视图,顾客菜单据此算可预约时段。
-- (列清单沿用 order-modes.sql 的最新版本,追加 order_hours。)
create or replace view public.storefront with (security_invoker = false) as
  select slug, name, cat_order, delivery_fsas, tables, menu_langs, order_modes, order_hours
  from public.tenants;
grant select on public.storefront to anon, authenticated;

-- 预约并入自提/配送:fulai 不再单独用校园 order-ahead(order_type 'pickup'),
-- 后台的 Order-ahead 页由 order_modes 控制 → 去掉 'pickup' 即可隐藏该 tab。
-- 自提/配送的预约时间改由 requested_pickup_at 承载。校园租户不受影响。
update public.tenants set order_modes = array_remove(order_modes, 'pickup') where slug = 'fulai';

-- 放行匿名顾客写 requested_pickup_at(自提/配送预约时间)。仍然挡住能力字段
-- (pickup_code / tracking_token / ready_at / picked_up_at 只能服务端写),所以
-- 顾客只能"请求"一个时间,不能伪造取餐凭证或把单标记为已好/已取。
drop policy if exists orders_anon_insert_pickup_guard on public.orders;
create policy orders_anon_insert_pickup_guard on public.orders
  as restrictive for insert to anon
  with check (
    ready_at is null and picked_up_at is null
    and pickup_code is null and tracking_token is null
  );

-- 验证: select slug, order_hours, order_modes from storefront where slug='fulai';
-- ===========================================================================
--  Done.
-- ===========================================================================
