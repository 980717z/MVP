-- ===========================================================================
--  鸡锅合并 — fold the (半) duplicate rows into their main dish as 全/半 sizes,
--  named to match the printed menu (…窝). Approved 2026-07-03 (D2-A).
--  Supabase → SQL Editor → Run once.
-- ===========================================================================

-- 1) 大补走地鸡窝: 全 $45.99 / 半 $35.99
update public.menu_items
   set name_zh = '大补走地鸡窝',
       name_en = 'Free Range Chicken Hot Pot',
       variants = '[{"label_zh":"全","label_en":"Whole","price":45.99},
                    {"label_zh":"半","label_en":"Half","price":35.99}]'::jsonb
 where id = '58ab6ee7-8012-4e9c-af6b-230a83671434';   -- was 大补走地鸡锅 $45.99

delete from public.menu_items
 where id = 'dc3f1107-1f26-4412-8b34-ce78c8b4a3a0';   -- 大补走地鸡窝 (半) $35.99

-- 2) 滋补竹丝鸡窝: 全 $50.99 / 半 $40.99  (was 药材竹丝鸡锅 + 滋补竹丝鸡窝(半))
update public.menu_items
   set name_zh = '滋补竹丝鸡窝',
       name_en = 'Black Chicken Hot Pot',
       variants = '[{"label_zh":"全","label_en":"Whole","price":50.99},
                    {"label_zh":"半","label_en":"Half","price":40.99}]'::jsonb
 where id = '6064128f-8226-42b8-bbeb-74e443955e49';   -- was 药材竹丝鸡锅 $50.99

delete from public.menu_items
 where id = 'be01a93f-0e46-44a6-b7d8-7099924238dd';   -- 滋补竹丝鸡窝 (半) $40.99

-- (半竹丝鸡 + 半走地鸡窝 $50.99 is a combo, intentionally untouched.)

-- Verify: two dishes with 2 variants each, no (半) rows left
select name_zh, name_en, price, variants
  from public.menu_items
 where tenant_slug = 'fulai' and category = '火锅'
 order by name_zh;
