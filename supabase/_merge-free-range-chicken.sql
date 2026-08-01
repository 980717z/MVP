-- ─────────────────────────────────────────────────────────────────────────
--  合并「大补走地鸡锅」的重复菜品(火锅分类里出现了两次)
--
--  两行完全同名、同价、同分类,区别只有规格:
--    7437faee…  $45.99  无规格      sort=0   ← 删除(旧的散行)
--    58ab6ee7…  $45.99  全只/半只   sort=15  ← 保留(带 2 规格,顾客能选)
--
--  为什么可以直接删,不用改统计:
--   • 历史订单把菜名/价格写死在 orders.items 的 JSON 里,不引用 menu_items,
--     所以删菜不会动到任何一张已完成的单。
--   • 菜品销量(records / module_id='dish-margin')按「菜名」归集,两行同名,
--     所以销量与营业额本来就合在一起,删掉重复行不会少算任何一份。
--   • 只影响菜单展示:顾客菜单从「两条大补走地鸡锅」变成「一条(可选全只/半只)」。
--
--  先看后删:第一条 select 确认只有这两行、且要删的那行确实是无规格的那条。
-- ─────────────────────────────────────────────────────────────────────────

-- 1) 先确认(应当返回 2 行)
select id, name_zh, price, category, sort, jsonb_array_length(coalesce(variants, '[]'::jsonb)) as n_variants
from public.menu_items
where tenant_slug = 'fulai' and name_zh = '大补走地鸡锅'
order by sort;

-- 2) 删除无规格的那一行(保留带 全只/半只 的)
delete from public.menu_items
where tenant_slug = 'fulai'
  and name_zh = '大补走地鸡锅'
  and id = '7437faee-ee5a-4a9f-a37c-fd336e3c5249'
  and jsonb_array_length(coalesce(variants, '[]'::jsonb)) = 0;  -- 双保险:只删没有规格的那条

-- 3) 复核(应当只剩 1 行,且 n_variants = 2)
select id, name_zh, price, category, sort, jsonb_array_length(coalesce(variants, '[]'::jsonb)) as n_variants
from public.menu_items
where tenant_slug = 'fulai' and name_zh = '大补走地鸡锅';
