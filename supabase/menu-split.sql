-- ===========================================================================
--  菜单拆分（2026-07-05，接 menu-choices.sql 之后跑）
--  决策：同价的"斜杠菜"不做"点进去再选"，而是拆成各自独立的菜品
--        （各一行 + 号）。不同 size/价的（例/小/中/大、全只/半只、大/中）
--        保留选择器 —— 那些不动。
--  安全：只改 menu_items（不受 QR 合约锁影响）；可重复跑（拆过的按旧名
--        已找不到，自动跳过，不会重复插入）。
-- ===========================================================================

-- 把一道"同价多选"菜拆开：第 1 项复用原行（保留 id / 排序 / 图片 / 时间），
-- 其余项各插一行（同价、同分类、同排序位、同图片）。
create or replace function pg_temp.split_dish(p_old_name text, p_options jsonb)
returns void language plpgsql as $$
declare
  r public.menu_items%rowtype;
  opt jsonb;
  i int := 0;
begin
  select * into r from public.menu_items
   where tenant_slug = 'fulai' and name_zh = p_old_name limit 1;
  if not found then
    raise notice 'skip（已拆或不存在）: %', p_old_name;
    return;
  end if;
  for opt in select value from jsonb_array_elements(p_options) loop
    if i = 0 then
      update public.menu_items
         set name_zh = opt->>'zh', name_en = opt->>'en', variants = '[]'::jsonb
       where id = r.id;
    else
      insert into public.menu_items
        (tenant_slug, name_zh, name_en, price, category, image_url, sort, variants, is_market)
      values
        ('fulai', opt->>'zh', opt->>'en', r.price, r.category, r.image_url, r.sort, '[]'::jsonb, false);
    end if;
    i := i + 1;
  end loop;
end $$;

-- ── 火锅配菜（每个选项本身就是一道菜）──────────────────────────────────────
select pg_temp.split_dish('鱼丸 / 牛筋丸', '[
  {"zh":"鱼丸","en":"Fish Ball"},{"zh":"牛筋丸","en":"Beef Tendon Ball"}]');
select pg_temp.split_dish('冬菇 / 皇子菇', '[
  {"zh":"冬菇","en":"Chinese Black Mushroom"},{"zh":"皇子菇","en":"King Mushroom"}]');
select pg_temp.split_dish('菠菜 / 唐生菜', '[
  {"zh":"菠菜","en":"Spinach"},{"zh":"唐生菜","en":"Lettuce"}]');
select pg_temp.split_dish('绍菜 / 西洋菜', '[
  {"zh":"绍菜","en":"Napa Cabbage"},{"zh":"西洋菜","en":"Watercress"}]');
select pg_temp.split_dish('A菜 / 唐蒿 / 冬瓜', '[
  {"zh":"A菜","en":"Romaine Lettuce"},{"zh":"唐蒿","en":"Tang Hao"},{"zh":"冬瓜","en":"Winter Melon"}]');
select pg_temp.split_dish('芋头 / 藕片', '[
  {"zh":"芋头","en":"Taro"},{"zh":"藕片","en":"Lotus Root"}]');
select pg_temp.split_dish('粉丝 / 蛋面', '[
  {"zh":"粉丝","en":"Glass Noodles"},{"zh":"蛋面","en":"Egg Noodles"}]');
select pg_temp.split_dish('河粉 / 乌冬', '[
  {"zh":"河粉","en":"Rice Noodle"},{"zh":"乌冬","en":"Udon"}]');

-- ── 炒粉面（底菜 + 炒面/捞面）────────────────────────────────────────────────
select pg_temp.split_dish('虾仁炒面 / 捞面', '[
  {"zh":"虾仁炒面","en":"Shrimp Chow Mein"},{"zh":"虾仁捞面","en":"Shrimp Lo Mein"}]');
select pg_temp.split_dish('海鲜炒面 / 捞面', '[
  {"zh":"海鲜炒面","en":"Seafood Chow Mein"},{"zh":"海鲜捞面","en":"Seafood Lo Mein"}]');
select pg_temp.split_dish('广东炒面 / 捞面', '[
  {"zh":"广东炒面","en":"Cantonese Chow Mein"},{"zh":"广东捞面","en":"Cantonese Lo Mein"}]');
select pg_temp.split_dish('牛肉炒面 / 捞面', '[
  {"zh":"牛肉炒面","en":"Beef Chow Mein"},{"zh":"牛肉捞面","en":"Beef Lo Mein"}]');
select pg_temp.split_dish('鸡肉炒面 / 捞面', '[
  {"zh":"鸡肉炒面","en":"Chicken Chow Mein"},{"zh":"鸡肉捞面","en":"Chicken Lo Mein"}]');
select pg_temp.split_dish('杂菜炒面 / 捞面', '[
  {"zh":"杂菜炒面","en":"Vegetable Chow Mein"},{"zh":"杂菜捞面","en":"Vegetable Lo Mein"}]');
select pg_temp.split_dish('肉丝炒面 / 捞面', '[
  {"zh":"肉丝炒面","en":"Julienne Pork Chow Mein"},{"zh":"肉丝捞面","en":"Julienne Pork Lo Mein"}]');

-- ── 汤粉面 ───────────────────────────────────────────────────────────────────
select pg_temp.split_dish('沙爹鸡 / 牛汤面', '[
  {"zh":"沙爹鸡汤面","en":"Satay Chicken Noodle Soup"},{"zh":"沙爹牛汤面","en":"Satay Beef Noodle Soup"}]');

-- ── 招牌精选 / 海鲜（底菜 + 做法/规格 拼名）─────────────────────────────────
-- ⚠️ 椒盐软壳蟹 已在「头盘」里存在（$27.99，同一道菜），所以这里只保留
--    避风塘软壳蟹（招牌精选），避免重复。想两处都留请告知。
select pg_temp.split_dish('软壳蟹 (椒盐/避风塘)', '[
  {"zh":"避风塘软壳蟹","en":"Typhoon Shelter Soft Shell Crab"}]');
select pg_temp.split_dish('椒盐 / 卤水鸭舌', '[
  {"zh":"椒盐鸭舌","en":"Salt & Pepper Duck Tongue"},{"zh":"卤水鸭舌","en":"Marinated Duck Tongue"}]');
select pg_temp.split_dish('美极虾仁 / 中虾', '[
  {"zh":"美极虾仁 (去壳)","en":"Pan Fried Shrimps (Peeled)"},{"zh":"美极中虾 (带壳)","en":"Pan Fried Shrimps (Shell-on)"}]');

-- ── 铁板煲仔 ─────────────────────────────────────────────────────────────────
select pg_temp.split_dish('铁板豉汁牛肉 / 鸡片', '[
  {"zh":"铁板豉汁牛肉","en":"Beef in Black Bean Sauce (Sizzling)"},{"zh":"铁板豉汁鸡片","en":"Chicken in Black Bean Sauce (Sizzling)"}]');
select pg_temp.split_dish('铁板沙爹牛肉 / 鸡片', '[
  {"zh":"铁板沙爹牛肉","en":"Beef in Satay Sauce (Sizzling)"},{"zh":"铁板沙爹鸡片","en":"Chicken in Satay Sauce (Sizzling)"}]');

-- ── 酒水饮品（⚠️ 名字拿不准，见文件尾说明，跑前可改）───────────────────────
select pg_temp.split_dish('青岛 / 喜力 / Corona 啤酒', '[
  {"zh":"青岛啤酒","en":"Tsing Tao Beer"},{"zh":"喜力啤酒","en":"Heineken Beer"},{"zh":"Corona 啤酒","en":"Corona Beer"}]');
select pg_temp.split_dish('Bar Shots (1-1/4 oz)', '[
  {"zh":"金酒 Gin","en":"Gin (1-1/4 oz)"},{"zh":"冧酒 Rum","en":"Rum (1-1/4 oz)"},{"zh":"伏特加 Vodka","en":"Vodka (1-1/4 oz)"},{"zh":"威士忌 Scotch","en":"Scotch (1-1/4 oz)"}]');
select pg_temp.split_dish('汽水 / 苹果橙汁 (瓶)', '[
  {"zh":"汽水 (瓶)","en":"Pop (bottle)"},{"zh":"苹果汁 (瓶)","en":"Apple Juice (bottle)"},{"zh":"橙汁 (瓶)","en":"Orange Juice (bottle)"}]');
select pg_temp.split_dish('茶包 (茉莉花 / 铁观音)', '[
  {"zh":"茉莉花茶包","en":"Jasmine Tea Bag"},{"zh":"铁观音茶包","en":"Tieguanyin Tea Bag"}]');

-- ── 不同价 → 加选择器（不是拆分）───────────────────────────────────────────
-- 潮式大拼盘：中 $75.99 / 大 $85.99（老板给价 2026-07-05）。去掉名字里的
-- (大/中) 后缀，规格按小→大排（和汤羹 位/小/中/大 一致）。
update public.menu_items
   set name_zh = '潮式大拼盘',
       name_en = 'Chiu Chow Combo Platter',
       price = 85.99,
       variants = '[
         {"label_zh":"中","label_en":"M","price":75.99},
         {"label_zh":"大","label_en":"L","price":85.99}]'::jsonb
 where tenant_slug = 'fulai' and name_zh = '潮式大拼盘 (大/中)';

-- ── 验证：应该没有任何"同价 variants"残留 ──────────────────────────────────
select name_zh, jsonb_array_length(variants) as opts,
       (select count(distinct (v->>'price')) from jsonb_array_elements(variants) v) as distinct_prices
  from public.menu_items
 where tenant_slug = 'fulai' and jsonb_array_length(variants) > 1
 order by category, name_zh;
-- 上面结果里 distinct_prices 应该全部 > 1（只剩不同价的规格菜）；
-- 若还有 distinct_prices = 1 的行，说明那道没拆到，检查菜名是否对得上。

-- ===========================================================================
--  ⚠️ 酒水名字请过目（跑之前想改就直接改上面的 zh/en）：
--    · Bar Shots 拆成 4 行（金酒/冧酒/伏特加/威士忌）—— 冧酒是粤语，
--      要普通话就改成"朗姆酒"。或你想保留 "Bar Shots" 一行不拆也行，
--      删掉那条 split_dish 即可。
--    · Corona 啤酒 保留了英文品牌名。
-- ===========================================================================
