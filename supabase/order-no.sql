-- ===========================================================================
--  订单编号 order_no —— 下单时由数据库自动分配,三处共用同一个号:
--    • 有桌号(堂食): 桌号-该桌当天第几单, 数字补两位。例 6 桌第一单 = 06-01
--    • 无桌号(自取/外送/配送): A + 全店当天第几个无桌号单。例 A01
--  每个营业日重置(营业日 = 多伦多本地时间 − day_start_hour 小时的日期,
--  与 day-start-hour.sql / table_sessions.business_date 规则一致)。
--  编号在 BEFORE INSERT 触发器里分配 → 单一来源、并发不冲突。
--  Supabase → SQL Editor → Run(可重复跑)。
-- ===========================================================================

alter table public.orders add column if not exists business_date date;
alter table public.orders add column if not exists order_no text;

-- 分配函数:计算营业日 + 该桌(或无桌号A组)当天第几单,写回 NEW。
-- 同一 (店, 营业日) 上事务级 advisory lock,防并发下单拿到同一个序号。
-- SECURITY DEFINER 必需:匿名顾客(anon)只有 orders 的 INSERT 权限,没有
-- SELECT。触发器默认按调用者身份跑,内部的 count(*) 会 permission denied →
-- 顾客下单直接失败。以属主身份运行既修复此问题,又能统计到全店当天所有单。
create or replace function public.assign_order_no()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dsh int;
  bdate date;
  seq int;
  tbl text;
begin
  select coalesce(day_start_hour, 0) into dsh
  from public.tenants where slug = NEW.tenant_slug;
  dsh := coalesce(dsh, 0);

  bdate := (((NEW.created_at at time zone 'America/Toronto') - make_interval(hours => dsh)))::date;
  NEW.business_date := bdate;

  -- 序列化同店同日的编号分配(hashtext→int4,单参 bigint 版 advisory lock)
  perform pg_advisory_xact_lock(hashtext(NEW.tenant_slug || '|' || bdate::text)::bigint);

  -- 同一 table_no 分组计数:堂食按各自桌号;无桌号(table_no='')整组共用 → A 流水
  select count(*) + 1 into seq
  from public.orders
  where tenant_slug = NEW.tenant_slug
    and business_date = bdate
    and table_no = NEW.table_no;

  if NEW.table_no <> '' then
    tbl := case when NEW.table_no ~ '^[0-9]+$' then lpad(NEW.table_no, 2, '0') else NEW.table_no end;
    NEW.order_no := tbl || '-' || lpad(seq::text, 2, '0');
  else
    NEW.order_no := 'A' || lpad(seq::text, 2, '0');
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_assign_order_no on public.orders;
create trigger trg_assign_order_no
  before insert on public.orders
  for each row execute function public.assign_order_no();

-- 回填历史行(含仍在进行中的订单),让老板 app / 小票不出现空号。
-- 用同一分组规则:partition by (店, 营业日, table_no),按下单时间排序。
update public.orders o
set business_date = (((o.created_at at time zone 'America/Toronto')
      - make_interval(hours => coalesce(t.day_start_hour, 0))))::date
from public.tenants t
where t.slug = o.tenant_slug
  and o.business_date is null;

with seq as (
  select id, tenant_slug, business_date, table_no,
    row_number() over (
      partition by tenant_slug, business_date, table_no
      order by created_at
    ) as rn
  from public.orders
  where order_no is null
)
update public.orders o
set order_no = case
  when o.table_no <> '' then
    (case when o.table_no ~ '^[0-9]+$' then lpad(o.table_no, 2, '0') else o.table_no end)
    || '-' || lpad(s.rn::text, 2, '0')
  else 'A' || lpad(s.rn::text, 2, '0')
end
from seq s
where s.id = o.id;

-- 顾客(匿名)下单后按自己生成的 id 读回编号,只返回 order_no(无任何隐私字段),
-- id 是不可猜的 UUID → 安全。SECURITY DEFINER 绕过 RLS 只读这一列。
create or replace function public.order_no_for(p_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select order_no from public.orders where id = p_id;
$$;

grant execute on function public.order_no_for(uuid) to anon, authenticated;

-- 验证:
-- select order_no, table_no, business_date, created_at from orders
--   where tenant_slug='fulai' order by created_at desc limit 20;
-- ===========================================================================
--  Done.
-- ===========================================================================
