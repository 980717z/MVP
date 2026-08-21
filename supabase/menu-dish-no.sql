-- ─────────────────────────────────────────────────────────────────────────
--  菜号 (dish number) — the code printed beside a dish on the paper menu
--  ("1", "16", "48A", "F12", "N1", "J118").
--
--  OPTIONAL: many dishes have no number, so this defaults to '' and nothing
--  requires it. Blank never matches a search (see lib/dishNo.ts).
--
--  NOT shown on the customer QR menu — it is a SEARCH KEY only. A diner holding
--  the paper menu can type "115"; staff on a phone order can punch the number
--  instead of the dish name. The printed menu and the QR menu stay visually
--  independent.
--
--  Safe to run anytime: existing rows get '', and the app tolerates the column
--  being absent (number search simply finds nothing until this runs).
--
--  The index supports prefix search (LIKE 'F12%') if we ever push the filter
--  into Postgres; today the menu filters client-side over the loaded dish list.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.menu_items
  add column if not exists dish_no text not null default '';

create index if not exists menu_items_dish_no_idx
  on public.menu_items (tenant_slug, dish_no text_pattern_ops)
  where dish_no <> '';
