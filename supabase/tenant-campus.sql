-- ===========================================================================
--  商家表加「是否校园专属」标记 tenants.campus
--  campus = true 的商家是专门为校园(campus/取餐)场景开的(如 Pita Express)。
--  之后前端/后台可据此走校园分支(校园登录品牌、取餐流程、marketplace 上架等)。
--  Supabase → SQL Editor → Run（可重复跑）。
-- ===========================================================================

alter table public.tenants
  add column if not exists campus boolean not null default false;

-- Pita Express 是校园专属 → 标记为 true
update public.tenants set campus = true where slug = 'pita-express';

-- 核对
select slug, campus from public.tenants where slug = 'pita-express';
-- 想看所有校园商家: select slug, campus from public.tenants where campus;
-- ===========================================================================
--  Done.
-- ===========================================================================
