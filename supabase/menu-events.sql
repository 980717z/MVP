-- ===========================================================================
--  扫码菜单转化漏斗埋点 (menu_events) — 自建版流量分析，不依赖 Plausible/PostHog。
--  顾客（未登录）浏览菜单时，前端直接写入这张表：
--    menu_view → menu_item_added → checkout_opened → order_placed
--  跟 orders 表一样靠 anon insert + RLS 做安全边界。
--  Supabase → SQL Editor → Run（可重复跑）
-- ===========================================================================

create table if not exists public.menu_events (
  id           uuid        primary key default gen_random_uuid(),
  tenant_slug  text        not null references public.tenants (slug) on delete cascade,
  session_id   text        not null,               -- 浏览器 sessionStorage 生成的匿名会话 id
  event        text        not null,                -- menu_view | menu_item_added | checkout_opened | order_placed
  meta         jsonb       not null default '{}'::jsonb,  -- 例如 { order_type: 'pickup' }
  created_at   timestamptz not null default now()
);

create index if not exists menu_events_tenant_idx
  on public.menu_events (tenant_slug, created_at desc);

alter table public.menu_events enable row level security;

-- 顾客（未登录）可以为任意已存在的店写入事件（FK 保证店存在）
drop policy if exists menu_events_public_insert on public.menu_events;
create policy menu_events_public_insert on public.menu_events
  for insert to anon, authenticated with check (true);

-- 商家成员只能看自己店的埋点
drop policy if exists menu_events_select on public.menu_events;
create policy menu_events_select on public.menu_events
  for select using (public.can_access_tenant(tenant_slug));

-- 平台管理员看全部（依赖 supabase/platform-admin.sql 里的 is_platform_admin()；
-- 若还没跑那个文件，这条策略会创建失败 —— 先跑 platform-admin.sql 再跑这个）
drop policy if exists platform_admin_menu_events_select on public.menu_events;
create policy platform_admin_menu_events_select on public.menu_events
  for select using (public.is_platform_admin());

grant insert on public.menu_events to anon;
grant select, insert on public.menu_events to authenticated;

-- ===========================================================================
--  完成。漏斗读数（按会话去重，而不是按事件条数——一次浏览可能触发多条
--  menu_item_added，但漏斗关心的是"有多少人做到了这一步"）：
--
--  select event, count(distinct session_id)
--  from menu_events
--  where tenant_slug = 'fulai' and created_at >= now() - interval '7 days'
--  group by event;
-- ===========================================================================
