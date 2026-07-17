-- ============================================================
-- Pita Express (pita-express) — menu + categories
-- 前提: 先用 /admin「+ Add vendor」以 handle "pita-express" 建店（tenant 行由它创建）
-- 幂等: 菜按 (tenant_slug, template_key) upsert，重跑安全
-- 生成自 templates/pita-express.json（照片菜单转录，翻译为双语）
-- ============================================================

-- 分类顺序（顾客端左栏）
update public.tenants set cat_order = '["每日特惠","卷饼","拼盘","墨西哥卷","套餐","炸鸡","鸡翅鸡柳","鱼虾","汉堡","小食配菜"]'::jsonb where slug = 'pita-express';

insert into public.menu_items (tenant_slug, name_zh, name_en, price, category, image_url, is_market, variants, template_key, sort)
values
  ('pita-express', '任选两卷（法拉费/鸡/牛）', 'Any 2 Wraps (Falafel, Chicken & Beef)', 9.99, '每日特惠', '', false, '[]'::jsonb, 'sp-2wraps', 0),
  ('pita-express', '沙威玛薯条', 'Shawarma on Fries', 7.99, '每日特惠', '', false, '[]'::jsonb, 'sp-shawarma-fries', 1),
  ('pita-express', '牛肉沙威玛卷', 'Beef Shawarma Wrap', 5.99, '卷饼', '', false, '[]'::jsonb, 'wrap-beef', 2),
  ('pita-express', '鸡肉沙威玛卷', 'Chicken Shawarma Wrap', 5.99, '卷饼', '', false, '[]'::jsonb, 'wrap-chicken', 3),
  ('pita-express', '鸡肉串烧卷', 'Shish Tawook Wrap', 7.99, '卷饼', '', false, '[]'::jsonb, 'wrap-tawook', 4),
  ('pita-express', '炸鱼卷', 'Fish Wrap', 6.99, '卷饼', '', false, '[]'::jsonb, 'wrap-fish', 5),
  ('pita-express', '法拉费卷', 'Falafel Wrap', 5.99, '卷饼', '', false, '[]'::jsonb, 'wrap-falafel', 6),
  ('pita-express', '鸡肉沙威玛拼盘', 'Chicken Shawarma Plate', 9.99, '拼盘', '', false, '[]'::jsonb, 'plate-chicken', 7),
  ('pita-express', '牛肉沙威玛拼盘', 'Beef Shawarma Plate', 9.99, '拼盘', '', false, '[]'::jsonb, 'plate-beef', 8),
  ('pita-express', '双拼沙威玛拼盘', 'Mix Shawarma Plate', 10.99, '拼盘', '', false, '[]'::jsonb, 'plate-mix', 9),
  ('pita-express', '牛/鸡肉烤串拼盘', 'Beef/Chicken Kebab Plate', 11.99, '拼盘', '', false, '[]'::jsonb, 'plate-kebab', 10),
  ('pita-express', '鸡肉串烧拼盘', 'Chicken Shish Tawook Plate', 12.99, '拼盘', '', false, '[]'::jsonb, 'plate-tawook', 11),
  ('pita-express', '法拉费拼盘', 'Falafel Plate', 9.99, '拼盘', '', false, '[]'::jsonb, 'plate-falafel', 12),
  ('pita-express', '鸡/牛肉沙拉', 'Chicken/Beef Salad', 9.99, '拼盘', '', false, '[]'::jsonb, 'plate-salad', 13),
  ('pita-express', '鱼排拼盘', 'Fish Fillet Plate', 10.99, '拼盘', '', false, '[]'::jsonb, 'plate-fish', 14),
  ('pita-express', '蔬菜墨西哥卷', 'Veggie Burrito', 6.99, '墨西哥卷', '', false, '[]'::jsonb, 'burrito-veggie', 15),
  ('pita-express', '牛排墨西哥卷', 'Steak Burrito', 10.99, '墨西哥卷', '', false, '[]'::jsonb, 'burrito-steak', 16),
  ('pita-express', '鸡/牛肉墨西哥卷', 'Chicken/Beef Burrito', 9.99, '墨西哥卷', '', false, '[]'::jsonb, 'burrito-cb', 17),
  ('pita-express', '沙威玛卷套餐（鸡/牛）', 'Chicken/Beef Wrap Combo', 9.99, '套餐', '', false, '[]'::jsonb, 'combo-wrap', 18),
  ('pita-express', '鸡块套餐', 'Chicken Nuggets Combo', 9.99, '套餐', '', false, '[]'::jsonb, 'combo-nuggets', 19),
  ('pita-express', '炸鱼卷套餐', 'Fish Wrap Combo', 9.99, '套餐', '', false, '[]'::jsonb, 'combo-fish-wrap', 20),
  ('pita-express', '汉堡套餐（鸡/牛）', 'Chicken/Beef Burger Combo', 9.99, '套餐', '', false, '[]'::jsonb, 'combo-burger', 21),
  ('pita-express', '法拉费卷套餐', 'Falafel Wrap Combo', 9.99, '套餐', '', false, '[]'::jsonb, 'combo-falafel', 22),
  ('pita-express', '热狗套餐', 'Hotdog Combo', 9.99, '套餐', '', false, '[]'::jsonb, 'combo-hotdog', 23),
  ('pita-express', '烤串卷套餐', 'Kebab Wrap Combo', 9.99, '套餐', '', false, '[]'::jsonb, 'combo-kebab', 24),
  ('pita-express', '鸡米花套餐', 'Popcorn Chicken Combo', 9.99, '套餐', '', false, '[]'::jsonb, 'combo-popcorn', 25),
  ('pita-express', '双拼沙威玛卷套餐', 'Mix Shawarma Wrap Combo', 9.99, '套餐', '', false, '[]'::jsonb, 'combo-mix-wrap', 26),
  ('pita-express', '鸡柳套餐', 'Chicken Tender Combo', 9.99, '套餐', '', false, '[]'::jsonb, 'combo-tenders', 27),
  ('pita-express', '鱼块套餐', 'Fish Nuggets Combo', 10.99, '套餐', '', false, '[]'::jsonb, 'combo-fish-nuggets', 28),
  ('pita-express', '炸鸡 2 块（含1餐包）', 'Fried Chicken 2 pcs (1 Dinner Roll)', null, '炸鸡', '', false, '[{"label_zh":"单点","label_en":"Chicken only","price":7.99},{"label_zh":"配薯条","label_en":"With fries","price":9.99}]'::jsonb, 'fc-2', 29),
  ('pita-express', '炸鸡 3 块（含1餐包）', 'Fried Chicken 3 pcs (1 Dinner Roll)', null, '炸鸡', '', false, '[{"label_zh":"单点","label_en":"Chicken only","price":9.99},{"label_zh":"配薯条","label_en":"With fries","price":11.99}]'::jsonb, 'fc-3', 30),
  ('pita-express', '炸鸡 5 块（含2餐包）', 'Fried Chicken 5 pcs (2 Dinner Rolls)', null, '炸鸡', '', false, '[{"label_zh":"单点","label_en":"Chicken only","price":14.99},{"label_zh":"配薯条","label_en":"With fries","price":16.99}]'::jsonb, 'fc-5', 31),
  ('pita-express', '炸鸡 8 块（含3餐包）', 'Fried Chicken 8 pcs (3 Dinner Rolls)', null, '炸鸡', '', false, '[{"label_zh":"单点","label_en":"Chicken only","price":16.99},{"label_zh":"配薯条","label_en":"With fries","price":19.99}]'::jsonb, 'fc-8', 32),
  ('pita-express', '鸡米花', 'Popcorn Chicken', null, '炸鸡', '', false, '[{"label_zh":"小份","label_en":"Small","price":7.99},{"label_zh":"大份","label_en":"Large","price":11.99}]'::jsonb, 'popcorn', 33),
  ('pita-express', '鸡块 8 只', 'Chicken Nuggets 8 pcs', null, '鸡翅鸡柳', '', false, '[{"label_zh":"单点","label_en":"Nuggets only","price":5.99},{"label_zh":"配薯条","label_en":"With fries","price":8.99}]'::jsonb, 'nuggets-8', 34),
  ('pita-express', '鸡块 12 只', 'Chicken Nuggets 12 pcs', null, '鸡翅鸡柳', '', false, '[{"label_zh":"单点","label_en":"Nuggets only","price":9.99},{"label_zh":"配薯条","label_en":"With fries","price":11.99}]'::jsonb, 'nuggets-12', 35),
  ('pita-express', '鸡块 24 只', 'Chicken Nuggets 24 pcs', null, '鸡翅鸡柳', '', false, '[{"label_zh":"单点","label_en":"Nuggets only","price":14.99},{"label_zh":"配薯条","label_en":"With fries","price":18.99}]'::jsonb, 'nuggets-24', 36),
  ('pita-express', 'BBQ 鸡翅 6 只', 'BBQ Chicken Wings 6 pcs', null, '鸡翅鸡柳', '', false, '[{"label_zh":"单点","label_en":"Wings only","price":7.99},{"label_zh":"配薯条","label_en":"With fries","price":10.99}]'::jsonb, 'wings-6', 37),
  ('pita-express', 'BBQ 鸡翅 10 只', 'BBQ Chicken Wings 10 pcs', null, '鸡翅鸡柳', '', false, '[{"label_zh":"单点","label_en":"Wings only","price":12.99},{"label_zh":"配薯条","label_en":"With fries","price":14.99}]'::jsonb, 'wings-10', 38),
  ('pita-express', 'BBQ 鸡翅 15 只', 'BBQ Chicken Wings 15 pcs', null, '鸡翅鸡柳', '', false, '[{"label_zh":"单点","label_en":"Wings only","price":17.99},{"label_zh":"配薯条","label_en":"With fries","price":19.99}]'::jsonb, 'wings-15', 39),
  ('pita-express', 'BBQ 鸡翅 20 只', 'BBQ Chicken Wings 20 pcs', null, '鸡翅鸡柳', '', false, '[{"label_zh":"单点","label_en":"Wings only","price":22.99},{"label_zh":"配薯条","label_en":"With fries","price":24.99}]'::jsonb, 'wings-20', 40),
  ('pita-express', '鸡柳 3 条（含1餐包）', 'Chicken Tenders 3 pcs (1 Dinner Roll)', null, '鸡翅鸡柳', '', false, '[{"label_zh":"单点","label_en":"Tenders only","price":5.99},{"label_zh":"配薯条","label_en":"With fries","price":8.99}]'::jsonb, 'tenders-3', 41),
  ('pita-express', '鸡柳 5 条（含1餐包）', 'Chicken Tenders 5 pcs (1 Dinner Roll)', null, '鸡翅鸡柳', '', false, '[{"label_zh":"单点","label_en":"Tenders only","price":7.99},{"label_zh":"配薯条","label_en":"With fries","price":10.99}]'::jsonb, 'tenders-5', 42),
  ('pita-express', '鸡柳 8 条（含2餐包）', 'Chicken Tenders 8 pcs (2 Dinner Rolls)', null, '鸡翅鸡柳', '', false, '[{"label_zh":"单点","label_en":"Tenders only","price":10.99},{"label_zh":"配薯条","label_en":"With fries","price":13.99}]'::jsonb, 'tenders-8', 43),
  ('pita-express', '鸡柳 12 条（含3餐包）', 'Chicken Tenders 12 pcs (3 Dinner Rolls)', null, '鸡翅鸡柳', '', false, '[{"label_zh":"单点","label_en":"Tenders only","price":15.99},{"label_zh":"配薯条","label_en":"With fries","price":20.99}]'::jsonb, 'tenders-12', 44),
  ('pita-express', '炸鱼 2 块（含1餐包）', 'Fish N Chips 2 pcs (1 Dinner Roll)', null, '鱼虾', '', false, '[{"label_zh":"单点","label_en":"Fish only","price":7.99},{"label_zh":"配薯条","label_en":"With fries","price":9.99}]'::jsonb, 'fish-2', 45),
  ('pita-express', '炸鱼 4 块（含2餐包）', 'Fish N Chips 4 pcs (2 Dinner Rolls)', null, '鱼虾', '', false, '[{"label_zh":"单点","label_en":"Fish only","price":10.99},{"label_zh":"配薯条","label_en":"With fries","price":12.99}]'::jsonb, 'fish-4', 46),
  ('pita-express', '炸鱼 8 块（含3餐包）', 'Fish N Chips 8 pcs (3 Dinner Rolls)', null, '鱼虾', '', false, '[{"label_zh":"单点","label_en":"Fish only","price":17.99},{"label_zh":"配薯条","label_en":"With fries","price":19.99}]'::jsonb, 'fish-8', 47),
  ('pita-express', '珍宝炸虾 6 只（含餐包薯条）', '6 Jumbo Fried Shrimp (Dinner Roll & Fries)', 10.99, '鱼虾', '', false, '[]'::jsonb, 'shrimp-6', 48),
  ('pita-express', '珍宝炸虾 9 只（含餐包薯条）', '9 Jumbo Fried Shrimp (Dinner Roll & Fries)', 12.99, '鱼虾', '', false, '[]'::jsonb, 'shrimp-9', 49),
  ('pita-express', '珍宝炸虾 15 只（含餐包薯条）', '15 Jumbo Fried Shrimp (Dinner Roll & Fries)', 15.99, '鱼虾', '', false, '[]'::jsonb, 'shrimp-15', 50),
  ('pita-express', '牛/鸡肉汉堡', 'Beef or Chicken Burger', 6.99, '汉堡', '', false, '[]'::jsonb, 'burger-cb', 51),
  ('pita-express', '双层芝士汉堡', 'Double Cheese Burger', 10.99, '汉堡', '', false, '[]'::jsonb, 'burger-double', 52),
  ('pita-express', '鱼排汉堡', 'Fish Burger', 6.99, '汉堡', '', false, '[]'::jsonb, 'burger-fish', 53),
  ('pita-express', '炸鸡柳汉堡', 'Chicken Tender Burger', 7.99, '汉堡', '', false, '[]'::jsonb, 'burger-tender', 54),
  ('pita-express', '费城牛肉芝士', 'Philly Cheese Steak', 7.99, '汉堡', '', false, '[]'::jsonb, 'philly', 55),
  ('pita-express', '薯条', 'Fries', 4.99, '小食配菜', '', false, '[]'::jsonb, 'side-fries', 56),
  ('pita-express', '薯角', 'Potato Wedges', 5.99, '小食配菜', '', false, '[]'::jsonb, 'side-wedges', 57),
  ('pita-express', '洋葱圈', 'Onion Rings', 5.99, '小食配菜', '', false, '[]'::jsonb, 'side-rings', 58),
  ('pita-express', '经典肉汁奶酪薯条', 'Original Poutine', 6.99, '小食配菜', '', false, '[]'::jsonb, 'side-poutine', 59),
  ('pita-express', '沙威玛肉汁奶酪薯条', 'Shawarma Poutine', 8.99, '小食配菜', '', false, '[]'::jsonb, 'side-shawarma-poutine', 60),
  ('pita-express', '法拉费（份）', 'Falafel', 5.99, '小食配菜', '', false, '[]'::jsonb, 'side-falafel', 61),
  ('pita-express', '希腊沙拉', 'Greek Salad', 6.99, '小食配菜', '', false, '[]'::jsonb, 'side-greek', 62),
  ('pita-express', '热狗肠', 'Hotdog Sausage', 4.99, '小食配菜', '', false, '[]'::jsonb, 'side-hotdog', 63)
on conflict (tenant_slug, template_key) do update set
  name_zh = excluded.name_zh, name_en = excluded.name_en, price = excluded.price,
  category = excluded.category, image_url = excluded.image_url,
  is_market = excluded.is_market, variants = excluded.variants, sort = excluded.sort;

-- 验证: 应返回 64 道菜
select count(*) as dishes from public.menu_items where tenant_slug = 'pita-express';
