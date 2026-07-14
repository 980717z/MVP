-- ===========================================================================
--  Web Push 订阅表 push_subscriptions
--  商家登录后在订单页点「开启推送」→ 浏览器生成一个推送订阅 → 存到这里。
--  新订单入库时,后端 /api/push/send 读取该店的所有订阅并逐个推送。
--  一个浏览器/设备 = 一条订阅(endpoint 全局唯一);换店时同一 endpoint 会被
--  upsert 更新 tenant_slug,所以只会收到"最后开启的那家店"的订单。
--  Supabase → SQL Editor → Run(可重复跑)
-- ===========================================================================

create table if not exists public.push_subscriptions (
  id          uuid        primary key default gen_random_uuid(),
  tenant_slug text        not null references public.tenants (slug) on delete cascade,
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint    text        not null unique,
  p256dh      text        not null,   -- 客户端公钥(加密用)
  auth        text        not null,   -- 客户端 auth secret
  ua          text        not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists push_subs_tenant_idx
  on public.push_subscriptions (tenant_slug);

alter table public.push_subscriptions enable row level security;

-- 商家成员只能管理自己有权限的店、且属于自己的订阅。
-- 后端发送走 service-role(绕过 RLS),不受这些策略限制。
drop policy if exists push_subs_select on public.push_subscriptions;
create policy push_subs_select on public.push_subscriptions
  for select using (public.can_access_tenant(tenant_slug) and user_id = auth.uid());

drop policy if exists push_subs_insert on public.push_subscriptions;
create policy push_subs_insert on public.push_subscriptions
  for insert to authenticated
  with check (public.can_access_tenant(tenant_slug) and user_id = auth.uid());

drop policy if exists push_subs_update on public.push_subscriptions;
create policy push_subs_update on public.push_subscriptions
  for update using (public.can_access_tenant(tenant_slug) and user_id = auth.uid())
  with check (public.can_access_tenant(tenant_slug) and user_id = auth.uid());

drop policy if exists push_subs_delete on public.push_subscriptions;
create policy push_subs_delete on public.push_subscriptions
  for delete using (user_id = auth.uid());

grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- ===========================================================================
--  Done. 接下来:
--  1) 部署带 /api/push/send 的新版本
--  2) Supabase → Database → Webhooks → 新建:
--       表 public.orders, 事件 INSERT,
--       类型 HTTP Request, URL https://bentoos.io/api/push/send,
--       Header  x-webhook-secret: <PUSH_WEBHOOK_SECRET>
--  这样每来一单就会自动推送给该店所有已开启推送的设备。
-- ===========================================================================
