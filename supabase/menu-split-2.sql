-- ===========================================================================
--  菜单拆分 · 补漏（2026-07-05，接 menu-split.sql 之后跑）
--  这几道的"选项"藏在英文括号里，中文名没斜杠，所以第一轮审计漏了：
--    · 生猛龙虾（时价）— 清蒸 / 姜葱 / 豉椒，三种做法后厨要知道
--    · 三丝炒面捞面 — 炒面 / 捞面
--    · 本地啤酒 — 百威 / Molson / Coors / Labatt 四个牌子
--  规则同前：同价/时价 → 拆成独立菜；不同 size → 选择器。
--  安全：只改 menu_items；可重复跑（按旧名找不到就跳过）。
-- ===========================================================================

-- 拆分助手：拆出的每一行继承原菜的 price 和 is_market（时价龙虾拆出来仍是时价）
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
        ('fulai', opt->>'zh', opt->>'en', r.price, r.category, r.image_url, r.sort, '[]'::jsonb, r.is_market);
    end if;
    i := i + 1;
  end loop;
end $$;

-- 生猛龙虾（时价）→ 三种做法各一行，仍是时价（结账时按重量报价）
select pg_temp.split_dish('生猛龙虾', '[
  {"zh":"清蒸生猛龙虾","en":"Live Lobster (Steamed)"},
  {"zh":"姜葱生猛龙虾","en":"Live Lobster (Ginger & Onion)"},
  {"zh":"豉椒生猛龙虾","en":"Live Lobster (Black Bean)"}]');

-- 三丝炒面捞面 → 三丝炒面 / 三丝捞面（各 $18.99）
select pg_temp.split_dish('三丝炒面捞面', '[
  {"zh":"三丝炒面","en":"Three-Shred Chow Mein"},
  {"zh":"三丝捞面","en":"Three-Shred Lo Mein"}]');

-- 本地啤酒 → 四个牌子各一行（各 $5）
select pg_temp.split_dish('本地啤酒', '[
  {"zh":"百威啤酒","en":"Budweiser Beer"},
  {"zh":"Molson 啤酒","en":"Molson Beer"},
  {"zh":"Coors 啤酒","en":"Coors Beer"},
  {"zh":"Labatt 啤酒","en":"Labatt Beer"}]');

-- ── 验证 ────────────────────────────────────────────────────────────────────
select name_zh, name_en, is_market, price
  from public.menu_items
 where tenant_slug = 'fulai'
   and (name_zh like '%生猛龙虾' or name_zh like '三丝%面' or name_zh like '%啤酒')
 order by category, sort, name_zh;

-- ===========================================================================
--  ⚠️ 生猛龙虾现在是 3 行（清蒸/姜葱/豉椒），都显示"时价"。如果你觉得
--     3 行太重复，想改成"一行 生猛龙虾 时价 · 点进去选做法"的选择器，
--     告诉我，那需要一点前端改动（时价 + 选项的组合）。
-- ===========================================================================
