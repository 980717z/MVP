-- ─────────────────────────────────────────────────────────────────────────
--  Pinyin-initial search key for dishes. Lets staff find 菠萝咕噜肉 by typing
--  "blglr" on the iPad. Computed in JS (pinyin-pro) at dish-save time in the
--  admin + a one-time backfill — the customer menu just matches this string, so
--  no pinyin dictionary ships to diners.
--
--  Safe to run anytime: the column defaults to '' and the app tolerates it
--  being absent (matching just skips the initials until it's populated).
--
--  After running this, run supabase/_backfill-search-initials.sql (generated
--  from the live menu) to fill existing dishes. New/edited dishes populate
--  themselves on save.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.menu_items
  add column if not exists search_initials text not null default '';
