-- ===========================================================================
--  在线点餐订单 orders
--  顾客在扫码菜单页选菜 → 提交 → 写入这张表；商家在后台查看。
--  每家商家靠 tenant_slug + RLS 完全隔离（只看得到自己的订单）。
--  Supabase → SQL Editor → Run（可重复跑）
-- ===========================================================================

create table if not exists public.orders (
  id           uuid        primary key default gen_random_uuid(),
  tenant_slug  text        not null references public.tenants (slug) on delete cascade,
  items        jsonb       not null default '[]'::jsonb,  -- [{id,name_zh,name_en,price,qty}]
  total        numeric     not null default 0,
  table_no     text        not null default '',
  phone        text        not null default '',
  note         text        not null default '',
  status       text        not null default 'new',        -- new | preparing | done | cancelled
  created_at   timestamptz not null default now()
);

-- 若表已存在，补上 phone 列（可重复跑）
alter table public.orders add column if not exists phone text not null default '';

create index if not exists orders_tenant_idx
  on public.orders (tenant_slug, created_at desc);

alter table public.orders enable row level security;

-- 顾客（未登录）可以提交订单到任意已存在的店（FK 保证店存在）
drop policy if exists orders_public_insert on public.orders;
create policy orders_public_insert on public.orders
  for insert to anon, authenticated with check (true);

-- 商家成员可以查看 / 更新 / 删除自己店的订单
drop policy if exists orders_member_select on public.orders;
create policy orders_member_select on public.orders
  for select using (public.can_access_tenant(tenant_slug));

drop policy if exists orders_member_update on public.orders;
create policy orders_member_update on public.orders
  for update using (public.can_access_tenant(tenant_slug))
  with check (public.can_access_tenant(tenant_slug));

drop policy if exists orders_member_delete on public.orders;
create policy orders_member_delete on public.orders
  for delete using (public.can_access_tenant(tenant_slug));

grant insert on public.orders to anon;
grant select, insert, update, delete on public.orders to authenticated;

-- ===========================================================================
--  Done.
-- ===========================================================================
