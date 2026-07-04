-- ===========================================================================
--  时价 (market price) dishes — 佛跳墙, 蚝皇大鲍鱼, 鲍翅, 红烧乳鸽 etc.
--  is_market=true marks a dish as market-priced: the menu shows a gold 时价 tag,
--  the owner updates today's price from the 今日时价 panel in 菜单设置, and if
--  no price is set the dish can't be added to the cart (prevents $0 orders).
--  Supabase → SQL Editor → Run (可重复跑).
-- ===========================================================================

alter table public.menu_items
  add column if not exists is_market boolean not null default false;

-- Seed: today's priceless dishes are exactly the market-priced ones.
update public.menu_items set is_market = true where price is null;

-- Verify
select name_zh, price, is_market from public.menu_items
 where is_market order by name_zh;
