-- ============================================================
-- Pita Express (pita-express) — menu + categories
-- Prereq: create the tenant first via /admin → + Add vendor (handle "pita-express")
-- Idempotent: upserts by (tenant_slug, template_key) — safe to re-run
-- Generated from templates/pita-express.json (transcribed from the truck menu photos)
-- ============================================================

-- Category order (customer-facing left rail)
update public.tenants set cat_order = '["Daily Deals","Wraps","Plates","Burritos","Combos","Fried Chicken","Wings & Tenders","Fish & Shrimp","Burgers","Sides"]'::jsonb where slug = 'pita-express';

insert into public.menu_items (tenant_slug, name_zh, name_en, price, category, image_url, is_market, variants, template_key, sort)
values
  ('pita-express', 'Any 2 Wraps', 'Any 2 Wraps', null, 'Daily Deals', '', false, '[{"label_zh":"Falafel ×2","label_en":"Falafel ×2","price":9.99},{"label_zh":"Falafel + Chicken","label_en":"Falafel + Chicken","price":9.99},{"label_zh":"Falafel + Beef","label_en":"Falafel + Beef","price":9.99},{"label_zh":"Chicken ×2","label_en":"Chicken ×2","price":9.99},{"label_zh":"Chicken + Beef","label_en":"Chicken + Beef","price":9.99},{"label_zh":"Beef ×2","label_en":"Beef ×2","price":9.99}]'::jsonb, 'sp-2wraps', 0),
  ('pita-express', 'Shawarma on Fries', 'Shawarma on Fries', 7.99, 'Daily Deals', '', false, '[]'::jsonb, 'sp-shawarma-fries', 1),
  ('pita-express', 'Beef Shawarma Wrap', 'Beef Shawarma Wrap', 5.99, 'Wraps', '', false, '[]'::jsonb, 'wrap-beef', 2),
  ('pita-express', 'Chicken Shawarma Wrap', 'Chicken Shawarma Wrap', 5.99, 'Wraps', '', false, '[]'::jsonb, 'wrap-chicken', 3),
  ('pita-express', 'Shish Tawook Wrap', 'Shish Tawook Wrap', 7.99, 'Wraps', '', false, '[]'::jsonb, 'wrap-tawook', 4),
  ('pita-express', 'Fish Wrap', 'Fish Wrap', 6.99, 'Wraps', '', false, '[]'::jsonb, 'wrap-fish', 5),
  ('pita-express', 'Falafel Wrap', 'Falafel Wrap', 5.99, 'Wraps', '', false, '[]'::jsonb, 'wrap-falafel', 6),
  ('pita-express', 'Chicken Shawarma Plate', 'Chicken Shawarma Plate', 9.99, 'Plates', '', false, '[]'::jsonb, 'plate-chicken', 7),
  ('pita-express', 'Beef Shawarma Plate', 'Beef Shawarma Plate', 9.99, 'Plates', '', false, '[]'::jsonb, 'plate-beef', 8),
  ('pita-express', 'Mix Shawarma Plate', 'Mix Shawarma Plate', 10.99, 'Plates', '', false, '[]'::jsonb, 'plate-mix', 9),
  ('pita-express', 'Kebab Plate', 'Kebab Plate', null, 'Plates', '', false, '[{"label_zh":"Chicken","label_en":"Chicken","price":11.99},{"label_zh":"Beef","label_en":"Beef","price":11.99}]'::jsonb, 'plate-kebab', 10),
  ('pita-express', 'Chicken Shish Tawook Plate', 'Chicken Shish Tawook Plate', 12.99, 'Plates', '', false, '[]'::jsonb, 'plate-tawook', 11),
  ('pita-express', 'Falafel Plate', 'Falafel Plate', 9.99, 'Plates', '', false, '[]'::jsonb, 'plate-falafel', 12),
  ('pita-express', 'Salad', 'Salad', null, 'Plates', '', false, '[{"label_zh":"Chicken","label_en":"Chicken","price":9.99},{"label_zh":"Beef","label_en":"Beef","price":9.99}]'::jsonb, 'plate-salad', 13),
  ('pita-express', 'Fish Fillet Plate', 'Fish Fillet Plate', 10.99, 'Plates', '', false, '[]'::jsonb, 'plate-fish', 14),
  ('pita-express', 'Veggie Burrito', 'Veggie Burrito', 6.99, 'Burritos', '', false, '[]'::jsonb, 'burrito-veggie', 15),
  ('pita-express', 'Steak Burrito', 'Steak Burrito', 10.99, 'Burritos', '', false, '[]'::jsonb, 'burrito-steak', 16),
  ('pita-express', 'Burrito', 'Burrito', null, 'Burritos', '', false, '[{"label_zh":"Chicken","label_en":"Chicken","price":9.99},{"label_zh":"Beef","label_en":"Beef","price":9.99}]'::jsonb, 'burrito-cb', 17),
  ('pita-express', 'Shawarma Wrap Combo (+ fries & drink)', 'Shawarma Wrap Combo (+ fries & drink)', null, 'Combos', '', false, '[{"label_zh":"Chicken","label_en":"Chicken","price":9.99},{"label_zh":"Beef","label_en":"Beef","price":9.99}]'::jsonb, 'combo-wrap', 18),
  ('pita-express', 'Chicken Nuggets Combo (+ fries & drink)', 'Chicken Nuggets Combo (+ fries & drink)', 9.99, 'Combos', '', false, '[]'::jsonb, 'combo-nuggets', 19),
  ('pita-express', 'Fish Wrap Combo (+ fries & drink)', 'Fish Wrap Combo (+ fries & drink)', 9.99, 'Combos', '', false, '[]'::jsonb, 'combo-fish-wrap', 20),
  ('pita-express', 'Burger Combo (+ fries & drink)', 'Burger Combo (+ fries & drink)', null, 'Combos', '', false, '[{"label_zh":"Chicken","label_en":"Chicken","price":9.99},{"label_zh":"Beef","label_en":"Beef","price":9.99}]'::jsonb, 'combo-burger', 21),
  ('pita-express', 'Falafel Wrap Combo (+ fries & drink)', 'Falafel Wrap Combo (+ fries & drink)', 9.99, 'Combos', '', false, '[]'::jsonb, 'combo-falafel', 22),
  ('pita-express', 'Hotdog Combo (+ fries & drink)', 'Hotdog Combo (+ fries & drink)', 9.99, 'Combos', '', false, '[]'::jsonb, 'combo-hotdog', 23),
  ('pita-express', 'Kebab Wrap Combo (+ fries & drink)', 'Kebab Wrap Combo (+ fries & drink)', 9.99, 'Combos', '', false, '[]'::jsonb, 'combo-kebab', 24),
  ('pita-express', 'Popcorn Chicken Combo (+ fries & drink)', 'Popcorn Chicken Combo (+ fries & drink)', 9.99, 'Combos', '', false, '[]'::jsonb, 'combo-popcorn', 25),
  ('pita-express', 'Mix Shawarma Wrap Combo (+ fries & drink)', 'Mix Shawarma Wrap Combo (+ fries & drink)', 9.99, 'Combos', '', false, '[]'::jsonb, 'combo-mix-wrap', 26),
  ('pita-express', 'Chicken Tender Combo (+ fries & drink)', 'Chicken Tender Combo (+ fries & drink)', 9.99, 'Combos', '', false, '[]'::jsonb, 'combo-tenders', 27),
  ('pita-express', 'Fish Nuggets Combo (+ fries & drink)', 'Fish Nuggets Combo (+ fries & drink)', 10.99, 'Combos', '', false, '[]'::jsonb, 'combo-fish-nuggets', 28),
  ('pita-express', 'Fried Chicken 2 pcs (1 Dinner Roll)', 'Fried Chicken 2 pcs (1 Dinner Roll)', null, 'Fried Chicken', '', false, '[{"label_zh":"Chicken only","label_en":"Chicken only","price":7.99},{"label_zh":"With fries","label_en":"With fries","price":9.99}]'::jsonb, 'fc-2', 29),
  ('pita-express', 'Fried Chicken 3 pcs (1 Dinner Roll)', 'Fried Chicken 3 pcs (1 Dinner Roll)', null, 'Fried Chicken', '', false, '[{"label_zh":"Chicken only","label_en":"Chicken only","price":9.99},{"label_zh":"With fries","label_en":"With fries","price":11.99}]'::jsonb, 'fc-3', 30),
  ('pita-express', 'Fried Chicken 5 pcs (2 Dinner Rolls)', 'Fried Chicken 5 pcs (2 Dinner Rolls)', null, 'Fried Chicken', '', false, '[{"label_zh":"Chicken only","label_en":"Chicken only","price":14.99},{"label_zh":"With fries","label_en":"With fries","price":16.99}]'::jsonb, 'fc-5', 31),
  ('pita-express', 'Fried Chicken 8 pcs (3 Dinner Rolls)', 'Fried Chicken 8 pcs (3 Dinner Rolls)', null, 'Fried Chicken', '', false, '[{"label_zh":"Chicken only","label_en":"Chicken only","price":16.99},{"label_zh":"With fries","label_en":"With fries","price":19.99}]'::jsonb, 'fc-8', 32),
  ('pita-express', 'Popcorn Chicken', 'Popcorn Chicken', null, 'Fried Chicken', '', false, '[{"label_zh":"Small","label_en":"Small","price":7.99},{"label_zh":"Large","label_en":"Large","price":11.99}]'::jsonb, 'popcorn', 33),
  ('pita-express', 'Chicken Nuggets 8 pcs', 'Chicken Nuggets 8 pcs', null, 'Wings & Tenders', '', false, '[{"label_zh":"Nuggets only","label_en":"Nuggets only","price":5.99},{"label_zh":"With fries","label_en":"With fries","price":8.99}]'::jsonb, 'nuggets-8', 34),
  ('pita-express', 'Chicken Nuggets 12 pcs', 'Chicken Nuggets 12 pcs', null, 'Wings & Tenders', '', false, '[{"label_zh":"Nuggets only","label_en":"Nuggets only","price":9.99},{"label_zh":"With fries","label_en":"With fries","price":11.99}]'::jsonb, 'nuggets-12', 35),
  ('pita-express', 'Chicken Nuggets 24 pcs', 'Chicken Nuggets 24 pcs', null, 'Wings & Tenders', '', false, '[{"label_zh":"Nuggets only","label_en":"Nuggets only","price":14.99},{"label_zh":"With fries","label_en":"With fries","price":18.99}]'::jsonb, 'nuggets-24', 36),
  ('pita-express', 'BBQ Chicken Wings 6 pcs', 'BBQ Chicken Wings 6 pcs', null, 'Wings & Tenders', '', false, '[{"label_zh":"Wings only","label_en":"Wings only","price":7.99},{"label_zh":"With fries","label_en":"With fries","price":10.99}]'::jsonb, 'wings-6', 37),
  ('pita-express', 'BBQ Chicken Wings 10 pcs', 'BBQ Chicken Wings 10 pcs', null, 'Wings & Tenders', '', false, '[{"label_zh":"Wings only","label_en":"Wings only","price":12.99},{"label_zh":"With fries","label_en":"With fries","price":14.99}]'::jsonb, 'wings-10', 38),
  ('pita-express', 'BBQ Chicken Wings 15 pcs', 'BBQ Chicken Wings 15 pcs', null, 'Wings & Tenders', '', false, '[{"label_zh":"Wings only","label_en":"Wings only","price":17.99},{"label_zh":"With fries","label_en":"With fries","price":19.99}]'::jsonb, 'wings-15', 39),
  ('pita-express', 'BBQ Chicken Wings 20 pcs', 'BBQ Chicken Wings 20 pcs', null, 'Wings & Tenders', '', false, '[{"label_zh":"Wings only","label_en":"Wings only","price":22.99},{"label_zh":"With fries","label_en":"With fries","price":24.99}]'::jsonb, 'wings-20', 40),
  ('pita-express', 'Chicken Tenders 3 pcs (1 Dinner Roll)', 'Chicken Tenders 3 pcs (1 Dinner Roll)', null, 'Wings & Tenders', '', false, '[{"label_zh":"Tenders only","label_en":"Tenders only","price":5.99},{"label_zh":"With fries","label_en":"With fries","price":8.99}]'::jsonb, 'tenders-3', 41),
  ('pita-express', 'Chicken Tenders 5 pcs (1 Dinner Roll)', 'Chicken Tenders 5 pcs (1 Dinner Roll)', null, 'Wings & Tenders', '', false, '[{"label_zh":"Tenders only","label_en":"Tenders only","price":7.99},{"label_zh":"With fries","label_en":"With fries","price":10.99}]'::jsonb, 'tenders-5', 42),
  ('pita-express', 'Chicken Tenders 8 pcs (2 Dinner Rolls)', 'Chicken Tenders 8 pcs (2 Dinner Rolls)', null, 'Wings & Tenders', '', false, '[{"label_zh":"Tenders only","label_en":"Tenders only","price":10.99},{"label_zh":"With fries","label_en":"With fries","price":13.99}]'::jsonb, 'tenders-8', 43),
  ('pita-express', 'Chicken Tenders 12 pcs (3 Dinner Rolls)', 'Chicken Tenders 12 pcs (3 Dinner Rolls)', null, 'Wings & Tenders', '', false, '[{"label_zh":"Tenders only","label_en":"Tenders only","price":15.99},{"label_zh":"With fries","label_en":"With fries","price":20.99}]'::jsonb, 'tenders-12', 44),
  ('pita-express', 'Fish N Chips 2 pcs (1 Dinner Roll)', 'Fish N Chips 2 pcs (1 Dinner Roll)', null, 'Fish & Shrimp', '', false, '[{"label_zh":"Fish only","label_en":"Fish only","price":7.99},{"label_zh":"With fries","label_en":"With fries","price":9.99}]'::jsonb, 'fish-2', 45),
  ('pita-express', 'Fish N Chips 4 pcs (2 Dinner Rolls)', 'Fish N Chips 4 pcs (2 Dinner Rolls)', null, 'Fish & Shrimp', '', false, '[{"label_zh":"Fish only","label_en":"Fish only","price":10.99},{"label_zh":"With fries","label_en":"With fries","price":12.99}]'::jsonb, 'fish-4', 46),
  ('pita-express', 'Fish N Chips 8 pcs (3 Dinner Rolls)', 'Fish N Chips 8 pcs (3 Dinner Rolls)', null, 'Fish & Shrimp', '', false, '[{"label_zh":"Fish only","label_en":"Fish only","price":17.99},{"label_zh":"With fries","label_en":"With fries","price":19.99}]'::jsonb, 'fish-8', 47),
  ('pita-express', '6 Jumbo Fried Shrimp (Dinner Roll & Fries)', '6 Jumbo Fried Shrimp (Dinner Roll & Fries)', 10.99, 'Fish & Shrimp', '', false, '[]'::jsonb, 'shrimp-6', 48),
  ('pita-express', '9 Jumbo Fried Shrimp (Dinner Roll & Fries)', '9 Jumbo Fried Shrimp (Dinner Roll & Fries)', 12.99, 'Fish & Shrimp', '', false, '[]'::jsonb, 'shrimp-9', 49),
  ('pita-express', '15 Jumbo Fried Shrimp (Dinner Roll & Fries)', '15 Jumbo Fried Shrimp (Dinner Roll & Fries)', 15.99, 'Fish & Shrimp', '', false, '[]'::jsonb, 'shrimp-15', 50),
  ('pita-express', 'Burger', 'Burger', null, 'Burgers', '', false, '[{"label_zh":"Chicken","label_en":"Chicken","price":6.99},{"label_zh":"Beef","label_en":"Beef","price":6.99}]'::jsonb, 'burger-cb', 51),
  ('pita-express', 'Double Cheese Burger', 'Double Cheese Burger', 10.99, 'Burgers', '', false, '[]'::jsonb, 'burger-double', 52),
  ('pita-express', 'Fish Burger', 'Fish Burger', 6.99, 'Burgers', '', false, '[]'::jsonb, 'burger-fish', 53),
  ('pita-express', 'Chicken Tender Burger', 'Chicken Tender Burger', 7.99, 'Burgers', '', false, '[]'::jsonb, 'burger-tender', 54),
  ('pita-express', 'Philly Cheese Steak', 'Philly Cheese Steak', 7.99, 'Burgers', '', false, '[]'::jsonb, 'philly', 55),
  ('pita-express', 'Fries', 'Fries', 4.99, 'Sides', '', false, '[]'::jsonb, 'side-fries', 56),
  ('pita-express', 'Potato Wedges', 'Potato Wedges', 5.99, 'Sides', '', false, '[]'::jsonb, 'side-wedges', 57),
  ('pita-express', 'Onion Rings', 'Onion Rings', 5.99, 'Sides', '', false, '[]'::jsonb, 'side-rings', 58),
  ('pita-express', 'Original Poutine', 'Original Poutine', 6.99, 'Sides', '', false, '[]'::jsonb, 'side-poutine', 59),
  ('pita-express', 'Shawarma Poutine', 'Shawarma Poutine', 8.99, 'Sides', '', false, '[]'::jsonb, 'side-shawarma-poutine', 60),
  ('pita-express', 'Falafel', 'Falafel', 5.99, 'Sides', '', false, '[]'::jsonb, 'side-falafel', 61),
  ('pita-express', 'Greek Salad', 'Greek Salad', 6.99, 'Sides', '', false, '[]'::jsonb, 'side-greek', 62),
  ('pita-express', 'Hotdog Sausage', 'Hotdog Sausage', 4.99, 'Sides', '', false, '[]'::jsonb, 'side-hotdog', 63)
on conflict (tenant_slug, template_key) do update set
  name_zh = excluded.name_zh, name_en = excluded.name_en, price = excluded.price,
  category = excluded.category, image_url = excluded.image_url,
  is_market = excluded.is_market, variants = excluded.variants, sort = excluded.sort;

-- Verify: expect 64 dishes
select count(*) as dishes from public.menu_items where tenant_slug = 'pita-express';
