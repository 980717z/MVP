-- ─────────────────────────────────────────────────────────────────────────
--  Per-tenant menu languages. Controls which languages the CUSTOMER menu
--  offers: the zh/en toggle, and whether the other-language dish subtitle
--  renders. NON-DESTRUCTIVE — name_zh stays in menu_items; a shop set to
--  ['en'] just stops SHOWING Chinese, and can be flipped back any time.
--
--  Ordered array, first entry = default/primary language. Dish data is zh/en
--  only, so other values are ignored by the app. Empty '{}' = "unset" → the
--  menu falls back to bilingual zh/en, so this file is safe to run before OR
--  after the code deploys.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.tenants
  add column if not exists menu_langs text[] not null default '{}';

-- Auto-default: campus vendors are non-Chinese-native by default → English-only.
-- Guarded so it's safe even if the `campus` column isn't present yet.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tenants' and column_name = 'campus'
  ) then
    update public.tenants
      set menu_langs = array['en']
      where coalesce(campus, false) = true and menu_langs = '{}';
  end if;
end $$;

-- Pita Express: English-only menu (explicit — the tonight ask), regardless of
-- how the campus flag ended up.
update public.tenants set menu_langs = array['en'] where slug = 'pita-express';

-- Everyone still unset stays bilingual, matching today's behavior. (The app
-- also defaults to zh/en when the column/value is absent, so this is belt +
-- suspenders and keeps the stored value explicit.)
update public.tenants set menu_langs = array['zh','en'] where menu_langs = '{}';

-- Expose menu_langs to the public/anon customer menu. The storefront view is
-- how the menu reads shop config without granting anon access to `tenants`.
-- CREATE OR REPLACE preserves the existing columns (appends menu_langs at end).
create or replace view public.storefront with (security_invoker = false) as
  select slug, name, cat_order, delivery_fsas, tables, menu_langs
  from public.tenants;
