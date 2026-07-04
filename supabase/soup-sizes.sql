-- ===========================================================================
--  汤羹类 多规格 — Single→XL price ladders from the printed 湯羹類 menu.
--  Labels: 位 Single · 小 Small · 中 Medium · 大 Large · 特大 XL.
--  Row ids match the live fulai menu (verified 2026-07-03). Re-runnable.
--
--  ⚠️ Prices transcribed from the menu photo — eyeball the verify SELECT at the
--  bottom against the physical card once. Any digit off: fix in 菜单设置 UI.
-- ===========================================================================

-- 1. 红烧蟹肉翅 Shark's Fin & Crab Meat: 35.99/59.99/87.99/145.99/190.99
update public.menu_items set variants = '[
  {"label_zh":"位","label_en":"Single","price":35.99},
  {"label_zh":"小","label_en":"Small","price":59.99},
  {"label_zh":"中","label_en":"Medium","price":87.99},
  {"label_zh":"大","label_en":"Large","price":145.99},
  {"label_zh":"特大","label_en":"XL","price":190.99}]'::jsonb
where id = '5a1b886e-6686-4c81-8f5a-549671d266bd';

-- 2. 红烧鸡丝翅 Shark's Fin & Shredded Chicken: 32.99/52.99/76.99/135.99/180.99
update public.menu_items set variants = '[
  {"label_zh":"位","label_en":"Single","price":32.99},
  {"label_zh":"小","label_en":"Small","price":52.99},
  {"label_zh":"中","label_en":"Medium","price":76.99},
  {"label_zh":"大","label_en":"Large","price":135.99},
  {"label_zh":"特大","label_en":"XL","price":180.99}]'::jsonb
where id = '3ef69d1c-5e8a-4566-8036-cf519457ab4c';

-- 3. 节瓜蚬汤 Melon Clams (no Single on the card): 17.99/21.99/28.99/32.99
update public.menu_items set variants = '[
  {"label_zh":"小","label_en":"Small","price":17.99},
  {"label_zh":"中","label_en":"Medium","price":21.99},
  {"label_zh":"大","label_en":"Large","price":28.99},
  {"label_zh":"特大","label_en":"XL","price":32.99}]'::jsonb
where id = '70da2738-d41d-4446-881a-96ed0db9c79f';

-- 4-7. 蟹肉鱼肚羹 / 海皇豆腐羹 / 八宝豆腐羹 / 蟹肉粟米羹: 9.99/14.99/20.99/30.99/40.99
update public.menu_items set variants = '[
  {"label_zh":"位","label_en":"Single","price":9.99},
  {"label_zh":"小","label_en":"Small","price":14.99},
  {"label_zh":"中","label_en":"Medium","price":20.99},
  {"label_zh":"大","label_en":"Large","price":30.99},
  {"label_zh":"特大","label_en":"XL","price":40.99}]'::jsonb
where id in ('f1fb532a-f72e-4202-8679-f8166f225327',  -- 蟹肉鱼肚羹
             'ee9ed95f-54db-41b3-80f8-dedfa0fc2052',  -- 海皇豆腐羹
             '94ed7923-9ea5-4c96-b597-86b266bbe554',  -- 八宝豆腐羹
             '84f33457-0f06-4e2e-8184-95339593b0ab'); -- 蟹肉粟米羹

-- 8. 海鲜酸辣汤 Seafood Hot & Sour: 9.99/14.99/18.99/26.99/33.99
update public.menu_items set variants = '[
  {"label_zh":"位","label_en":"Single","price":9.99},
  {"label_zh":"小","label_en":"Small","price":14.99},
  {"label_zh":"中","label_en":"Medium","price":18.99},
  {"label_zh":"大","label_en":"Large","price":26.99},
  {"label_zh":"特大","label_en":"XL","price":33.99}]'::jsonb
where id = 'a9e7f39d-2474-42a7-91e4-996c943c5d6a';

-- 9. 酸辣汤 Hot & Sour: 8.99/12.99/15.99/22.99/26.99
update public.menu_items set variants = '[
  {"label_zh":"位","label_en":"Single","price":8.99},
  {"label_zh":"小","label_en":"Small","price":12.99},
  {"label_zh":"中","label_en":"Medium","price":15.99},
  {"label_zh":"大","label_en":"Large","price":22.99},
  {"label_zh":"特大","label_en":"XL","price":26.99}]'::jsonb
where id = 'a79647de-d0f8-4399-aa3e-365f764abdce';

-- 10. 西洋菜肉片汤 Watercress & Pork: 8.99/14.99/16.99/24.99/30.99
update public.menu_items set variants = '[
  {"label_zh":"位","label_en":"Single","price":8.99},
  {"label_zh":"小","label_en":"Small","price":14.99},
  {"label_zh":"中","label_en":"Medium","price":16.99},
  {"label_zh":"大","label_en":"Large","price":24.99},
  {"label_zh":"特大","label_en":"XL","price":30.99}]'::jsonb
where id = '470ed6cc-c144-4106-885b-a0e9b0571ccd';

-- 11. 西湖牛肉羹 Minced Beef Egg Drop: 8.99/12.99/15.99/22.99/30.99  ⚠️ verify XL
update public.menu_items set variants = '[
  {"label_zh":"位","label_en":"Single","price":8.99},
  {"label_zh":"小","label_en":"Small","price":12.99},
  {"label_zh":"中","label_en":"Medium","price":15.99},
  {"label_zh":"大","label_en":"Large","price":22.99},
  {"label_zh":"特大","label_en":"XL","price":30.99}]'::jsonb
where id = '07044910-4fa5-4a45-bb30-355457bd7651';

-- 12. 鸡茸粟米羹 Chicken Sweet Corn: 8.99/14.99/16.99/24.99/30.99
update public.menu_items set variants = '[
  {"label_zh":"位","label_en":"Single","price":8.99},
  {"label_zh":"小","label_en":"Small","price":14.99},
  {"label_zh":"中","label_en":"Medium","price":16.99},
  {"label_zh":"大","label_en":"Large","price":24.99},
  {"label_zh":"特大","label_en":"XL","price":30.99}]'::jsonb
where id = '99afe235-df52-46fa-b15e-b2368413ab47';

-- 13. 云吞汤 Wonton: 8.99/12.99/15.99/22.99/30.99
update public.menu_items set variants = '[
  {"label_zh":"位","label_en":"Single","price":8.99},
  {"label_zh":"小","label_en":"Small","price":12.99},
  {"label_zh":"中","label_en":"Medium","price":15.99},
  {"label_zh":"大","label_en":"Large","price":22.99},
  {"label_zh":"特大","label_en":"XL","price":30.99}]'::jsonb
where id = '6da49787-aaa8-473d-8f4e-fe315fca3f7f';

-- 14. 鲜菇蛋花汤 Mushroom Egg Drop: 8.99/12.99/15.99/22.99/30.99
update public.menu_items set variants = '[
  {"label_zh":"位","label_en":"Single","price":8.99},
  {"label_zh":"小","label_en":"Small","price":12.99},
  {"label_zh":"中","label_en":"Medium","price":15.99},
  {"label_zh":"大","label_en":"Large","price":22.99},
  {"label_zh":"特大","label_en":"XL","price":30.99}]'::jsonb
where id = '3431ae32-c1a2-4848-a89c-d5df114a1df4';

-- 15. 鲜虾云吞汤 Shrimp Wonton: 9.99/15.99/18.99/25.99/31.99
update public.menu_items set variants = '[
  {"label_zh":"位","label_en":"Single","price":9.99},
  {"label_zh":"小","label_en":"Small","price":15.99},
  {"label_zh":"中","label_en":"Medium","price":18.99},
  {"label_zh":"大","label_en":"Large","price":25.99},
  {"label_zh":"特大","label_en":"XL","price":31.99}]'::jsonb
where id = 'ebf84171-f1c0-4fc8-893e-8dad94612814';

-- ── Verify against the physical menu card ──────────────────────────────────
select name_zh,
       (select string_agg(v->>'label_zh' || ' $' || (v->>'price'), ' · ' order by (v->>'price')::numeric)
          from jsonb_array_elements(variants) v) as 规格
  from public.menu_items
 where tenant_slug = 'fulai' and category = '汤羹'
 order by name_zh;
