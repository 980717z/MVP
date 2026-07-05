-- ===========================================================================
--  QR 合约 Gates：印好的牌子永远不能被改坏
--  Supabase → SQL Editor → Run（可重复跑）
--  设计文档: docs/designs/qr-gates-tenant-templates.md（CEO+eng 双评审）
--
--  威胁模型：拿着 owner 权限（甚至 service-role）的 AI session / 员工。
--  锁定 (qr_locked_at 非空) 后：
--    · slug 不可改（印在每张牌子的 URL 里）
--    · tables 只能增，不能改/删（?t= 必须永远匹配某张牌子）
--    · 租户不可 DELETE（子表全是 ON DELETE CASCADE，一条删除=所有牌子报废）
--    · 解锁只能在 Supabase SQL 编辑器（current_user='postgres'）——
--      auth.uid() IS NULL 不够：service-role 请求的 uid 也是 NULL
--    · 解锁与修改必须分两条语句（同语句解锁+改动会被字段检查拦下）
--  锁定不影响日常运营：delivery_fsas / hours / name / enabled 照常可改。
-- ===========================================================================

-- ── 1. 锁字段 ───────────────────────────────────────────────────────────────
alter table public.tenants add column if not exists qr_locked_at timestamptz;

-- ── 2. slug 格式 + 保留字（新租户；NOT VALID 不追溯旧行）─────────────────────
--  保留字 = app/ 顶级路由目录（lib/qrContract.ts RESERVED_SLUGS 与此同步，
--  守卫测试断言两边一致）。
alter table public.tenants drop constraint if exists tenants_slug_format;
alter table public.tenants add constraint tenants_slug_format
  check (
    slug ~ '^[a-z0-9-]{3,30}$'
    and slug not in ('app','api','menu','demo','login','pricing','onboarding',
                     'get-started','how-it-works','admin','www','static','assets')
  ) not valid;

-- ── 3. 模版菜幂等键（eng E2: 全量唯一索引，非部分索引 ——
--      NULLS DISTINCT 天然放过手动菜；PostgREST 无法目标部分索引）──────────────
alter table public.menu_items add column if not exists template_key text;
create unique index if not exists menu_items_template_key_uniq
  on public.menu_items (tenant_slug, template_key);

-- ── 4. 审计表：谁、何时、改前、改后（eng Q1: SECURITY DEFINER + 钉死路径）────
create table if not exists public.tenants_audit (
  id          bigint generated always as identity primary key,
  tenant_slug text        not null,
  actor       text        not null,  -- auth.uid() 或 DB 角色名
  field       text        not null,
  old_value   jsonb,
  new_value   jsonb,
  at          timestamptz not null default now()
);
-- RLS 全拒（无任何 policy）：anon/authenticated/service_role 读写全部被拒，
-- 只有 postgres（SQL 编辑器）能查。触发器经 SECURITY DEFINER 写入。
alter table public.tenants_audit enable row level security;

create or replace function public.audit_tenants_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  who text := coalesce(auth.uid()::text, current_user);
begin
  if tg_op = 'DELETE' then
    insert into tenants_audit (tenant_slug, actor, field, old_value, new_value)
    values (old.slug, who, 'DELETE', to_jsonb(old.slug), null);
    return old;
  end if;
  if new.slug is distinct from old.slug then
    insert into tenants_audit (tenant_slug, actor, field, old_value, new_value)
    values (old.slug, who, 'slug', to_jsonb(old.slug), to_jsonb(new.slug));
  end if;
  if new.tables is distinct from old.tables then
    insert into tenants_audit (tenant_slug, actor, field, old_value, new_value)
    values (old.slug, who, 'tables', old.tables, new.tables);
  end if;
  if new.qr_locked_at is distinct from old.qr_locked_at then
    insert into tenants_audit (tenant_slug, actor, field, old_value, new_value)
    values (old.slug, who, 'qr_locked_at', to_jsonb(old.qr_locked_at), to_jsonb(new.qr_locked_at));
  end if;
  if new.delivery_fsas is distinct from old.delivery_fsas then
    insert into tenants_audit (tenant_slug, actor, field, old_value, new_value)
    values (old.slug, who, 'delivery_fsas', old.delivery_fsas, new.delivery_fsas);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_tenants on public.tenants;
create trigger trg_audit_tenants
  after update or delete on public.tenants
  for each row execute function public.audit_tenants_change();

-- ── 5. 保护触发器（eng E3: 白名单仅 slug + tables + DELETE，逐字段比较）──────
create or replace function public.protect_qr_contract()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 未锁定：一切照常（锁定动作本身也在这条路径放行）
  if old.qr_locked_at is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  -- 已锁定 ↓
  if tg_op = 'DELETE' then
    raise exception 'QR_LOCKED_DELETE: 牌子已锁定，租户不可删除。请先在 Supabase SQL 编辑器解锁。'
      using errcode = 'P0001';
  end if;

  if new.slug is distinct from old.slug then
    raise exception 'QR_LOCKED_SLUG: 牌子已锁定，店铺网址标识 (%) 不可修改。', old.slug
      using errcode = 'P0001';
  end if;

  -- 桌号只增不改删：旧列表必须完整包含于新列表（@> 对数组忽略顺序）
  if not (coalesce(new.tables, '[]'::jsonb) @> coalesce(old.tables, '[]'::jsonb)) then
    raise exception 'QR_LOCKED_TABLES: 牌子已锁定，桌号只能新增，不能修改或删除。'
      using errcode = 'P0001';
  end if;

  -- 解锁：仅限 SQL 编辑器（postgres 角色）。anon/authenticated/service_role
  -- 一律拒绝 —— service-role 的 auth.uid() 也是 NULL，所以查 DB 角色而非 JWT。
  if new.qr_locked_at is null and current_user <> 'postgres' then
    raise exception 'QR_LOCKED_UNLOCK: 解锁只能由店主本人在 Supabase SQL 编辑器操作。'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_qr_contract on public.tenants;
create trigger trg_protect_qr_contract
  before update or delete on public.tenants
  for each row execute function public.protect_qr_contract();

-- ── 6. 锁定 fulai（牌子已印，评审 9A：迁移即生效，零窗口）─────────────────────
update public.tenants set qr_locked_at = now()
 where slug = 'fulai' and qr_locked_at is null;

-- ===========================================================================
--  Done. 立刻验证（应全部被拒）：
--    update tenants set slug='fulai2' where slug='fulai';          -- QR_LOCKED_SLUG
--    update tenants set tables='["1"]'::jsonb where slug='fulai';  -- QR_LOCKED_TABLES
--    delete from tenants where slug='fulai';                        -- QR_LOCKED_DELETE
--  解锁（仅 SQL 编辑器可用；解锁后先改、再重新锁定）：
--    update tenants set qr_locked_at = null where slug='fulai';
--  然后跑 supabase/health-check.sql 确认 gate 全部就位。
-- ===========================================================================
