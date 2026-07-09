-- ===========================================================================
--  菜单补漏 v2（2026-07-05，替代之前的 menu-split-2.sql）
--  这几道的"选项"藏在英文括号里，中文名没斜杠，第一轮审计漏了。规则调整：
--    · 生猛龙虾（时价）— 清蒸/姜葱/豉椒 是同一只龙虾的不同做法 →
--      做成【选择器】（点进去选做法），仍是时价，按重量结账时报价
--    · 本地啤酒 — 百威/Molson/Coors/Labatt 是同一行的不同牌子 →
--      做成【选择器】（点进去选牌子），各 $5
--    · 三丝炒面捞面 — 炒面/捞面 是两种不同主食 → 拆成两道菜（同其它面）
--  安全：只改 menu_items；可重复跑。
-- ===========================================================================

-- ── 生猛龙虾：时价 + 做法选择器（价格留空 = 时价，结账时按重量录入）──────────
update public.menu_items
   set name_en = 'Live Lobster',
       variants = '[
         {"label_zh":"清蒸","label_en":"Steamed","price":null},
         {"label_zh":"姜葱","label_en":"Ginger & Onion","price":null},
         {"label_zh":"豉椒","label_en":"Black Bean","price":null}]'::jsonb
 where tenant_slug = 'fulai' and name_zh = '生猛龙虾';

-- ── 本地啤酒：牌子选择器（各 $5，同价 → 顾客菜单显示"选择"）─────────────────
update public.menu_items
   set name_en = 'Domestic Beer',
       variants = '[
         {"label_zh":"百威","label_en":"Budweiser","price":5},
         {"label_zh":"Molson","label_en":"Molson","price":5},
         {"label_zh":"Coors","label_en":"Coors","price":5},
         {"label_zh":"Labatt","label_en":"Labatt","price":5}]'::jsonb
 where tenant_slug = 'fulai' and name_zh = '本地啤酒';

-- ── 三丝炒面捞面 → 三丝炒面 / 三丝捞面（各 $18.99，两种主食各点各的）────────
create or replace function pg_temp.split_dish(p_old_name text, p_options jsonb)
returns void language plpgsql as $$
declare r public.menu_items%rowtype; opt jsonb; i int := 0;
begin
  select * into r from public.menu_items where tenant_slug='fulai' and name_zh=p_old_name limit 1;
  if not found then raise notice 'skip: %', p_old_name; return; end if;
  for opt in select value from jsonb_array_elements(p_options) loop
    if i = 0 then
      update public.menu_items set name_zh=opt->>'zh', name_en=opt->>'en', variants='[]'::jsonb where id=r.id;
    else
      insert into public.menu_items (tenant_slug,name_zh,name_en,price,category,image_url,sort,variants,is_market)
      values ('fulai',opt->>'zh',opt->>'en',r.price,r.category,r.image_url,r.sort,'[]'::jsonb,r.is_market);
    end if;
    i := i + 1;
  end loop;
end $$;
select pg_temp.split_dish('三丝炒面捞面', '[
  {"zh":"三丝炒面","en":"Three-Shred Chow Mein"},
  {"zh":"三丝捞面","en":"Three-Shred Lo Mein"}]');

-- ── 验证 ────────────────────────────────────────────────────────────────────
select name_zh, name_en, is_market,
       jsonb_array_length(variants) as opts,
       (select string_agg(v->>'label_zh', '/') from jsonb_array_elements(variants) v) as choices
  from public.menu_items
 where tenant_slug='fulai' and (name_zh='生猛龙虾' or name_zh='本地啤酒' or name_zh like '三丝%面')
 order by name_zh;
-- 生猛龙虾 opts=3 (清蒸/姜葱/豉椒) is_market=t；本地啤酒 opts=4；三丝→两行 opts=0
