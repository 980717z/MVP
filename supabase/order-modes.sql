-- ─────────────────────────────────────────────────────────────────────────
--  Per-tenant order modes. Which ordering flows a vendor offers, from
--  {dine, togo, delivery, pickup, market}. A campus food truck offers PICKUP
--  only (instant ASAP + scheduled, no dine-in tables / delivery / seafood
--  market price). Empty '{}' = "unset" → the app falls back to ALL modes, so
--  existing restaurants are unaffected and this is safe to run before/after
--  the code deploys.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.tenants
  add column if not exists order_modes text[] not null default '{}';

-- Auto-default: campus vendors are pickup-only. Guarded so it's safe even if
-- the `campus` column isn't present.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tenants' and column_name = 'campus'
  ) then
    update public.tenants
      set order_modes = array['pickup']
      where coalesce(campus, false) = true and order_modes = '{}';
  end if;
end $$;

-- Pita Express: pickup only, explicit (the tonight ask), regardless of campus flag.
update public.tenants set order_modes = array['pickup'] where slug = 'pita-express';

-- Expose to the public/anon customer menu so it can gate the ?m= mode without
-- granting anon access to `tenants`. CREATE OR REPLACE appends the column,
-- preserving the existing ones (incl. menu_langs added earlier).
create or replace view public.storefront with (security_invoker = false) as
  select slug, name, cat_order, delivery_fsas, tables, menu_langs, order_modes
  from public.tenants;
