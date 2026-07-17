-- ===========================================================================
--  平台管理后台 (platform admin) — 给 BentoOS 团队看的跨商家汇总视图。
--  和商家自己的 /app 后台不同：/app 只能看自己店（tenant RLS 隔离），
--  这里是运营方看全平台流水汇总 + 导出，不动商家原有的隔离策略。
--  Supabase → SQL Editor → Run（可重复跑）
-- ===========================================================================

-- ── 1. 平台管理员名单 ────────────────────────────────────────────────────
-- 不是 tenants.owner_id，也不是 members —— 这是 BentoOS 自己人。
-- 谁能看全平台数据由这张表决定，先手动插入自己的 auth.users id。
create table if not exists public.platform_admins (
  user_id     uuid        primary key references auth.users (id) on delete cascade,
  note        text        not null default '',
  created_at  timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

-- 只有已经是 admin 的人能看名单（避免任何登录用户探测谁是 admin）
drop policy if exists platform_admins_select on public.platform_admins;
create policy platform_admins_select on public.platform_admins
  for select using (exists (
    select 1 from public.platform_admins pa where pa.user_id = auth.uid()
  ));

grant select on public.platform_admins to authenticated;

-- ── 2. Helper: 当前用户是不是平台管理员？──────────────────────────────────
create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.platform_admins where user_id = auth.uid()
  );
$$;

-- ── 3. 给管理员开一扇"看全部"的窗 ──────────────────────────────────────────
-- 现有 tenants_select / orders_member_select 已经用 can_access_tenant()
-- 把人锁在自己店里；这里叠加一条 is_platform_admin() 的策略，
-- 不改动、不删除商家原本的隔离策略（多条 select 策略是 OR 关系）。

drop policy if exists platform_admin_tenants_select on public.tenants;
create policy platform_admin_tenants_select on public.tenants
  for select using (public.is_platform_admin());

drop policy if exists platform_admin_orders_select on public.orders;
create policy platform_admin_orders_select on public.orders
  for select using (public.is_platform_admin());

-- ── 4. 跨店流水汇总视图（商家会计的"总表"）─────────────────────────────────
-- 按店 × 天聚合营业额/单量，/admin 页面直接查这张视图渲染表格，
-- 前端加个"导出 CSV"按钮就是"销售/日结 CSV 导出"要的东西，
-- 不用另外建导出表或后端任务。
create or replace view public.admin_daily_sales as
select
  o.tenant_slug,
  t.name ->> 'zh'                    as tenant_name,
  date_trunc('day', o.created_at)    as business_day,
  count(*)                            as order_count,
  sum(o.total)                        as gross_sales
from public.orders o
join public.tenants t on t.slug = o.tenant_slug
where o.status <> 'cancelled'
group by o.tenant_slug, t.name, date_trunc('day', o.created_at);

-- 视图本身没有开关，但它读 orders/tenants 会走这两张表各自的 RLS，
-- 所以只有平台管理员（或本店成员，只查得到自己那几行）能查出数据。
grant select on public.admin_daily_sales to authenticated;

-- ===========================================================================
--  完成。下一步：
--   1) Supabase → Authentication → Users 找到自己的 uid，然后：
--      insert into public.platform_admins (user_id, note) values ('<你的uid>', 'me');
--   2) 建 app/admin/page.tsx：Supabase 客户端查 admin_daily_sales + tenants，
--      按天/按店渲染表格；导出按钮直接把查询结果 join 成 CSV 字符串下载，
--      不需要额外 SQL 或后端接口。
-- ===========================================================================
