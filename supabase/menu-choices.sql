-- ===========================================================================
--  菜单一致性修复（2026-07-05 全菜单审计）
--  Supabase → SQL Editor → Run（可重复跑：转换只在 variants 为空时执行）
--
--  问题 A：24 道"斜杠菜"（如 菠菜/唐生菜 一个价）没有选择器 ——
--          顾客下单后厨房不知道选的是哪样。修法：转成同价 variants，
--          点单必选其一，小票打印「菠菜 / 唐生菜（菠菜）」。
--  问题 B：全只/半只 四种写法并存（variants 全/半 · 独立菜 (全只)/(半只) ·
--          白切鸡 (半)）。统一为 variants 标签「全只/半只」。
--  例外：潮式大拼盘 (大/中) 未转换 —— 需要老板提供中份价格（见文件尾）。
-- ===========================================================================

-- ── A. 斜杠菜 → 同价选项（厨房从此知道选了啥）────────────────────────────────
create or replace function pg_temp.set_choices(p_name text, p_variants jsonb)
returns void language sql as $$
  update public.menu_items
     set variants = p_variants
   where tenant_slug = 'fulai' and name_zh = p_name
     and variants = '[]'::jsonb;
$$;

-- 招牌精选
select pg_temp.set_choices('软壳蟹 (椒盐/避风塘)', '[
  {"label_zh":"椒盐","label_en":"Salt & Pepper","price":27.99},
  {"label_zh":"避风塘","label_en":"Typhoon Shelter","price":27.99}]'::jsonb);
select pg_temp.set_choices('椒盐 / 卤水鸭舌', '[
  {"label_zh":"椒盐","label_en":"Salt & Pepper","price":26.99},
  {"label_zh":"卤水","label_en":"Marinated","price":26.99}]'::jsonb);

-- 汤粉面 / 海鲜
select pg_temp.set_choices('沙爹鸡 / 牛汤面', '[
  {"label_zh":"沙爹鸡","label_en":"Satay Chicken","price":11.99},
  {"label_zh":"沙爹牛","label_en":"Satay Beef","price":11.99}]'::jsonb);
select pg_temp.set_choices('美极虾仁 / 中虾', '[
  {"label_zh":"虾仁 (去壳)","label_en":"Without Shell","price":23.99},
  {"label_zh":"中虾 (带壳)","label_en":"With Shell","price":23.99}]'::jsonb);

-- 火锅配菜
select pg_temp.set_choices('鱼丸 / 牛筋丸', '[
  {"label_zh":"鱼丸","label_en":"Fish Ball","price":8.99},
  {"label_zh":"牛筋丸","label_en":"Beef Tendon Ball","price":8.99}]'::jsonb);
select pg_temp.set_choices('冬菇 / 皇子菇', '[
  {"label_zh":"冬菇","label_en":"Black Mushroom","price":13.99},
  {"label_zh":"皇子菇","label_en":"King Mushroom","price":13.99}]'::jsonb);
select pg_temp.set_choices('菠菜 / 唐生菜', '[
  {"label_zh":"菠菜","label_en":"Spinach","price":8.99},
  {"label_zh":"唐生菜","label_en":"Lettuce","price":8.99}]'::jsonb);
select pg_temp.set_choices('绍菜 / 西洋菜', '[
  {"label_zh":"绍菜","label_en":"Napa Cabbage","price":8.99},
  {"label_zh":"西洋菜","label_en":"Watercress","price":8.99}]'::jsonb);
select pg_temp.set_choices('A菜 / 唐蒿 / 冬瓜', '[
  {"label_zh":"A菜","label_en":"Romaine Lettuce","price":8.99},
  {"label_zh":"唐蒿","label_en":"Tang Hao","price":8.99},
  {"label_zh":"冬瓜","label_en":"Winter Melon","price":8.99}]'::jsonb);
select pg_temp.set_choices('芋头 / 藕片', '[
  {"label_zh":"芋头","label_en":"Taro","price":8.99},
  {"label_zh":"藕片","label_en":"Lotus Root","price":8.99}]'::jsonb);
select pg_temp.set_choices('粉丝 / 蛋面', '[
  {"label_zh":"粉丝","label_en":"Glass Noodles","price":7.99},
  {"label_zh":"蛋面","label_en":"Egg Noodles","price":7.99}]'::jsonb);
select pg_temp.set_choices('河粉 / 乌冬', '[
  {"label_zh":"河粉","label_en":"Rice Noodle","price":7.99},
  {"label_zh":"乌冬","label_en":"Udon","price":7.99}]'::jsonb);

-- 炒粉面（炒面 or 捞面）
select pg_temp.set_choices('虾仁炒面 / 捞面', '[
  {"label_zh":"炒面","label_en":"Chow Mein","price":20.99},
  {"label_zh":"捞面","label_en":"Lo Mein","price":20.99}]'::jsonb);
select pg_temp.set_choices('海鲜炒面 / 捞面', '[
  {"label_zh":"炒面","label_en":"Chow Mein","price":21.99},
  {"label_zh":"捞面","label_en":"Lo Mein","price":21.99}]'::jsonb);
select pg_temp.set_choices('广东炒面 / 捞面', '[
  {"label_zh":"炒面","label_en":"Chow Mein","price":20.99},
  {"label_zh":"捞面","label_en":"Lo Mein","price":20.99}]'::jsonb);
select pg_temp.set_choices('牛肉炒面 / 捞面', '[
  {"label_zh":"炒面","label_en":"Chow Mein","price":18.99},
  {"label_zh":"捞面","label_en":"Lo Mein","price":18.99}]'::jsonb);
select pg_temp.set_choices('鸡肉炒面 / 捞面', '[
  {"label_zh":"炒面","label_en":"Chow Mein","price":18.99},
  {"label_zh":"捞面","label_en":"Lo Mein","price":18.99}]'::jsonb);
select pg_temp.set_choices('杂菜炒面 / 捞面', '[
  {"label_zh":"炒面","label_en":"Chow Mein","price":18.99},
  {"label_zh":"捞面","label_en":"Lo Mein","price":18.99}]'::jsonb);
select pg_temp.set_choices('肉丝炒面 / 捞面', '[
  {"label_zh":"炒面","label_en":"Chow Mein","price":18.99},
  {"label_zh":"捞面","label_en":"Lo Mein","price":18.99}]'::jsonb);

-- 铁板煲仔
select pg_temp.set_choices('铁板豉汁牛肉 / 鸡片', '[
  {"label_zh":"牛肉","label_en":"Beef","price":22.99},
  {"label_zh":"鸡片","label_en":"Chicken","price":22.99}]'::jsonb);
select pg_temp.set_choices('铁板沙爹牛肉 / 鸡片', '[
  {"label_zh":"牛肉","label_en":"Beef","price":22.99},
  {"label_zh":"鸡片","label_en":"Chicken","price":22.99}]'::jsonb);

-- 酒水饮品
select pg_temp.set_choices('青岛 / 喜力 / Corona 啤酒', '[
  {"label_zh":"青岛","label_en":"Tsing Tao","price":7},
  {"label_zh":"喜力","label_en":"Heineken","price":7},
  {"label_zh":"Corona","label_en":"Corona","price":7}]'::jsonb);
select pg_temp.set_choices('Bar Shots (1-1/4 oz)', '[
  {"label_zh":"Gin","label_en":"Gin","price":8},
  {"label_zh":"Rum","label_en":"Rum","price":8},
  {"label_zh":"Vodka","label_en":"Vodka","price":8},
  {"label_zh":"Scotch","label_en":"Scotch","price":8}]'::jsonb);
select pg_temp.set_choices('汽水 / 苹果橙汁 (瓶)', '[
  {"label_zh":"汽水","label_en":"Pop","price":4},
  {"label_zh":"苹果汁","label_en":"Apple Juice","price":4},
  {"label_zh":"橙汁","label_en":"Orange Juice","price":4}]'::jsonb);
select pg_temp.set_choices('茶包 (茉莉花 / 铁观音)', '[
  {"label_zh":"茉莉花","label_en":"Jasmine","price":4},
  {"label_zh":"铁观音","label_en":"Tieguanyin","price":4}]'::jsonb);

-- ── B. 全只/半只 统一 ────────────────────────────────────────────────────────
-- 火锅窝：variants 标签 全/半 → 全只/半只（价格不变）
update public.menu_items set variants = '[
  {"label_zh":"全只","label_en":"Whole","price":45.99},
  {"label_zh":"半只","label_en":"Half","price":35.99}]'::jsonb
 where tenant_slug = 'fulai' and name_zh = '大补走地鸡窝';
update public.menu_items set variants = '[
  {"label_zh":"全只","label_en":"Whole","price":50.99},
  {"label_zh":"半只","label_en":"Half","price":40.99}]'::jsonb
 where tenant_slug = 'fulai' and name_zh = '滋补竹丝鸡窝';

-- 脆皮炸子鸡：两道独立菜 → 一道 + 全只/半只（保留全只行的图片/排序，删半只行）
update public.menu_items
   set name_zh = '脆皮炸子鸡', name_en = 'Deep Fried Crispy Chicken',
       price = 39.99, variants = '[
  {"label_zh":"全只","label_en":"Whole","price":39.99},
  {"label_zh":"半只","label_en":"Half","price":20.99}]'::jsonb
 where tenant_slug = 'fulai' and name_zh = '脆皮炸子鸡 (全只)';
delete from public.menu_items
 where tenant_slug = 'fulai' and name_zh = '脆皮炸子鸡 (半只)';

-- 菜胆上汤鸡：同上
update public.menu_items
   set name_zh = '菜胆上汤鸡', name_en = 'Steamed Chicken with Seasonal Greens',
       price = 39.99, variants = '[
  {"label_zh":"全只","label_en":"Whole","price":39.99},
  {"label_zh":"半只","label_en":"Half","price":22.99}]'::jsonb
 where tenant_slug = 'fulai' and name_zh = '菜胆上汤鸡 (全只)';
delete from public.menu_items
 where tenant_slug = 'fulai' and name_zh = '菜胆上汤鸡 (半只)';

-- 白切鸡 (半) → (半只)（只卖半只，保持独立菜，仅统一写法）
update public.menu_items set name_zh = '白切鸡 (半只)'
 where tenant_slug = 'fulai' and name_zh = '白切鸡 (半)';

-- ── 验证 ────────────────────────────────────────────────────────────────────
select name_zh, jsonb_array_length(variants) as options, price
  from public.menu_items
 where tenant_slug = 'fulai' and (name_zh ~ '[/／]' or variants != '[]'::jsonb)
 order by category, name_zh;

-- ===========================================================================
--  ⚠️ 未处理：潮式大拼盘 (大/中) $85.99 —— 数据库里只有一个价。
--  问老板中份多少钱后，在后台「菜单设置 → 多规格」给它加 大/中 两档，
--  或跑：
--    update menu_items set variants =
--      '[{"label_zh":"大","label_en":"L","price":85.99},
--        {"label_zh":"中","label_en":"M","price":<中份价>}]'::jsonb
--     where tenant_slug='fulai' and name_zh='潮式大拼盘 (大/中)';
-- ===========================================================================
