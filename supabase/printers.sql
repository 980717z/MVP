-- ===========================================================================
--  云打印机配置：每家商家绑一台芯烨云打印机（按 SN），新订单自动出单。
--  开发者账号 (user / UserKEY) 是我们全局的，放后端环境变量，不进数据库。
--  这里只存「这家店打到哪台机器」以及开关 / 联数。
--  Supabase → SQL Editor → Run（可重复跑）
-- ===========================================================================

-- 打印机序列号：机器标签上的 SN，空串=未绑定打印机（不出单）
alter table public.tenants add column if not exists printer_sn text not null default '';

-- 总开关：商家可临时停掉自动出单（如打印机缺纸时）
alter table public.tenants add column if not exists print_enabled boolean not null default true;

-- 打印联数（后厨+前台各一联时设 2），默认 1
alter table public.tenants add column if not exists print_copies int not null default 1;

-- 说明：printer_sn / print_enabled 受现有 tenants RLS 保护——只有店主/成员能读写，
-- 匿名顾客读不到（扫码页用的是 storefront 视图，不含这些列）。后端出单走 service-role，
-- 绕过 RLS 读取，不受影响。

-- ===========================================================================
--  Done.
-- ===========================================================================
