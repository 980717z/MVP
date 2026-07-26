-- ===========================================================================
--  多规格 — dishes with size/portion options (全/半, 位/小/中/大/特大…).
--  A dish keeps its single `price`; when `variants` is non-empty the diner
--  picks a size instead. Backward compatible: existing dishes get [] and are
--  unchanged. Supabase → SQL Editor → Run (可重复跑).
-- ===========================================================================

alter table public.menu_items
  add column if not exists variants jsonb not null default '[]'::jsonb;

-- shape: [{ "label_zh": "全", "label_en": "Whole", "price": 45.99 }, ...]
-- The public storefront read of menu_items already exposes all columns, so the
-- QR menu picks these up with no policy change.

-- ===========================================================================
--  Done. Verify:
--    select name_zh, price, variants from public.menu_items
--    where variants <> '[]'::jsonb limit 20;
-- ===========================================================================
