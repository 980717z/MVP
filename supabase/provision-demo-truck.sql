-- ============================================================
-- Provision: 校园餐车 (demo-truck)
-- 店型: 校园餐车（订餐-取餐 · 无桌码） (food-truck) · 模版 v1
-- 生成自 scripts/provision-sql.ts —— 可重复执行（幂等）
-- 将创建: 0 个桌号 · 4 个模块 · 3 个分类 · 0 个配送区 · 9 道菜
-- ============================================================

insert into public.tenants (slug, name, industry, address, enabled, tables, delivery_fsas, cat_order, owner_id)
values (
  'demo-truck',
  '{"zh":"校园餐车","en":"Campus Eats"}'::jsonb,
  'restaurant',
  '',
  '["menu-generator","qr-menu","online-orders","members"]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '["招牌饭","面 & 小食","饮品"]'::jsonb,
  'e8871942-9b75-4c00-9f62-802122fdd26f'::uuid
)
on conflict (slug) do update set
  enabled = excluded.enabled,
  tables = excluded.tables,          -- 锁定后触发器会拦缩水，安全
  delivery_fsas = excluded.delivery_fsas,
  cat_order = excluded.cat_order;

-- 店主计入成员名册（roster UI）。members.name 与 role 均 NOT NULL，
-- 店主 role = 'owner'，name 缺省用中文店名（无个人姓名可填时的安全默认）。
insert into public.members (tenant_slug, member_id, name, role)
select 'demo-truck', 'e8871942-9b75-4c00-9f62-802122fdd26f'::uuid, '校园餐车', 'owner'
where not exists (select 1 from public.members where tenant_slug = 'demo-truck' and member_id = 'e8871942-9b75-4c00-9f62-802122fdd26f'::uuid);

-- 菜单（按 template_key 幂等 upsert —— 重跑不会双倍菜）
insert into public.menu_items (tenant_slug, name_zh, name_en, price, category, image_url, is_market, variants, template_key, sort)
values
  ('demo-truck', '招牌鸡肉饭', 'Signature Chicken Rice Bowl', 12.99, '招牌饭', '', false, '[]'::jsonb, 'rice-1', 0),
  ('demo-truck', '红烧牛肉饭', 'Braised Beef Rice Bowl', 13.99, '招牌饭', '', false, '[]'::jsonb, 'rice-2', 1),
  ('demo-truck', '麻婆豆腐饭', 'Mapo Tofu Rice Bowl', 11.49, '招牌饭', '', false, '[]'::jsonb, 'rice-3', 2),
  ('demo-truck', '红烧牛肉面', 'Braised Beef Noodle Soup', 13.49, '面 & 小食', '', false, '[]'::jsonb, 'noodle-1', 3),
  ('demo-truck', '煎饺 (5 只)', 'Pan-fried Dumplings (5)', 7.99, '面 & 小食', '', false, '[]'::jsonb, 'snack-1', 4),
  ('demo-truck', '椒盐鸡', 'Salt & Pepper Chicken', 9.99, '面 & 小食', '', false, '[]'::jsonb, 'snack-2', 5),
  ('demo-truck', '春卷 (3 只)', 'Spring Rolls (3)', 5.49, '面 & 小食', '', false, '[]'::jsonb, 'snack-3', 6),
  ('demo-truck', '珍珠奶茶', 'Bubble Milk Tea', null, '饮品', '', false, '[{"label_zh":"中杯","label_en":"M","price":5.5},{"label_zh":"大杯","label_en":"L","price":6.5}]'::jsonb, 'drink-1', 7),
  ('demo-truck', '柠檬绿茶', 'Lemon Green Tea', 4.5, '饮品', '', false, '[]'::jsonb, 'drink-2', 8)
on conflict (tenant_slug, template_key) do update set
  name_zh = excluded.name_zh, name_en = excluded.name_en, price = excluded.price,
  category = excluded.category, image_url = excluded.image_url,
  is_market = excluded.is_market, variants = excluded.variants, sort = excluded.sort;

-- 验证
select slug, jsonb_array_length(tables) as tables, jsonb_array_length(delivery_fsas) as fsas,
       (select count(*) from public.menu_items where tenant_slug = 'demo-truck') as dishes
  from public.tenants where slug = 'demo-truck';
