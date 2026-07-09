-- ===========================================================================
--  订单防篡改：关闭匿名直接写 orders 的口子
--  Supabase → SQL Editor → Run（可重复跑）
--
--  背景：orders_public_insert policy 之前是 `with check (true)`，等于匿名
--  能拿公开的 anon key 直接绕过前端，插入任意 total / items[].price（比如把
--  总价改成 0）。现在下单改走 /api/orders/create（服务端用 service-role key，
--  按当前菜单重新核价/算 total 后才插入），所以 anon 不再需要直接 INSERT 权限。
-- ===========================================================================

drop policy if exists orders_public_insert on public.orders;
revoke insert on public.orders from anon;

-- ===========================================================================
--  Done. 匿名顾客的下单请求现在必须经过 /api/orders/create；
--  直接对 REST API 发 INSERT 会被 RLS 拒绝（no policy = deny）。
-- ===========================================================================
