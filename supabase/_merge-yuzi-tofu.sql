-- ─────────────────────────────────────────────────────────────────────────
--  Merge 黄金玉子豆腐 → 黄金玉子豆腐煲, into ONE dish. Fulai only.
--
--  Final surviving dish:
--    name_zh  : 黄金玉子豆腐煲               (kept)
--    name_en  : King Mushroom with Deep Fried Japanese Bean Curd   (adopted)
--    category : 招牌精选 (Signatures)        (kept)
--    price    : 24.99                        (both were 24.99)
--
--  Covers menu + 菜品销量 stat + historical ORDERS. ⚠️ DESTRUCTIVE + one-way:
--  deletes a dish and rewrites past order line-items. Run the PREVIEW block
--  first; take a Supabase backup/snapshot if you want an undo.
--
--  Run top-to-bottom in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────

-- 0) PREVIEW ────────────────────────────────────────────────────────────────
select id, name_zh, name_en, category, price from public.menu_items
  where tenant_slug = 'fulai' and name_zh in ('黄金玉子豆腐', '黄金玉子豆腐煲');
select id, data->>'dish' dish, data->>'soldMonth' sold_month from public.records
  where tenant_slug = 'fulai' and module_id = 'dish-margin' and data->>'dish' in ('黄金玉子豆腐', '黄金玉子豆腐煲');
-- how many historical orders contain the dish being merged away:
select count(*) as orders_to_rewrite from public.orders
  where tenant_slug = 'fulai' and items @> '[{"name_zh":"黄金玉子豆腐"}]'::jsonb;

-- ── After confirming the preview, run the rest as one block ─────────────────

-- 1) MENU: give the survivor the King-Mushroom English name; delete the other.
update public.menu_items
  set name_en = 'King Mushroom with Deep Fried Japanese Bean Curd'
  where tenant_slug = 'fulai' and name_zh = '黄金玉子豆腐煲';
delete from public.menu_items
  where tenant_slug = 'fulai' and name_zh = '黄金玉子豆腐';

-- 2) 菜品销量: fold the removed dish's monthly sales into the survivor, then
--    drop its stat record. (soldMonth may be text or number; missing → 0.)
update public.records tgt
set data = jsonb_set(
      tgt.data, '{soldMonth}',
      to_jsonb((
        coalesce(nullif(tgt.data->>'soldMonth','')::numeric, 0)
      + coalesce(nullif(src.data->>'soldMonth','')::numeric, 0))::text))
from public.records src
where tgt.tenant_slug='fulai' and tgt.module_id='dish-margin' and tgt.data->>'dish'='黄金玉子豆腐煲'
  and src.tenant_slug='fulai' and src.module_id='dish-margin' and src.data->>'dish'='黄金玉子豆腐';
delete from public.records
  where tenant_slug='fulai' and module_id='dish-margin' and data->>'dish'='黄金玉子豆腐';

-- 3) HISTORICAL ORDERS: rewrite every line-item named 黄金玉子豆腐 to the merged
--    dish (name_zh + the new English), preserving each order's item order.
--    Exact match on name_zh, so 黄金玉子豆腐煲 rows are untouched here.
update public.orders o
set items = sub.new_items
from (
  select r.id,
    jsonb_agg(
      case when elem->>'name_zh' = '黄金玉子豆腐'
        then elem || '{"name_zh":"黄金玉子豆腐煲","name_en":"King Mushroom with Deep Fried Japanese Bean Curd"}'::jsonb
        else elem end
      order by ord) as new_items
  from public.orders r, jsonb_array_elements(r.items) with ordinality as t(elem, ord)
  where r.tenant_slug = 'fulai' and r.items @> '[{"name_zh":"黄金玉子豆腐"}]'::jsonb
  group by r.id
) sub
where o.id = sub.id;

-- 4) OPTIONAL — unify the survivor's OWN past orders to the new English too, so
--    every 黄金玉子豆腐煲 receipt reads "King Mushroom …" (else old hot-pot
--    receipts keep "Golden Japanese Tofu Hot Pot"). Skip this to preserve what
--    was literally printed at the time. Stats aggregate on name_zh regardless.
-- update public.orders o
-- set items = sub.new_items
-- from (
--   select r.id,
--     jsonb_agg(
--       case when elem->>'name_zh' = '黄金玉子豆腐煲'
--         then elem || '{"name_en":"King Mushroom with Deep Fried Japanese Bean Curd"}'::jsonb
--         else elem end
--       order by ord) as new_items
--   from public.orders r, jsonb_array_elements(r.items) with ordinality as t(elem, ord)
--   where r.tenant_slug = 'fulai' and r.items @> '[{"name_zh":"黄金玉子豆腐煲"}]'::jsonb
--   group by r.id
-- ) sub
-- where o.id = sub.id;

-- 5) VERIFY — one menu row, one stat row (combined soldMonth), zero orders left
--    referencing the old name.
select name_zh, name_en, category from public.menu_items
  where tenant_slug='fulai' and name_zh like '黄金玉子豆腐%';
select data->>'dish' dish, data->>'soldMonth' sold_month from public.records
  where tenant_slug='fulai' and module_id='dish-margin' and data->>'dish' like '黄金玉子豆腐%';
select count(*) as orders_still_old from public.orders
  where tenant_slug='fulai' and items @> '[{"name_zh":"黄金玉子豆腐"}]'::jsonb;
