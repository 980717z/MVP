-- 空电话兜底:允许 phone = 'N/A' 作为"无号码"哨兵值。
-- 场景:无电话入口(如某些堂食下单)不再因 orders_phone_chk 失败。
-- 前端 createOrder 会把空电话规整为 'N/A';小票/后台显示 N/A。
alter table public.orders drop constraint if exists orders_phone_chk;
alter table public.orders add constraint orders_phone_chk
  check (phone ~ '^[0-9]{10}$' or phone ~ '^\+[0-9]{8,15}$' or phone = 'N/A') not valid;
