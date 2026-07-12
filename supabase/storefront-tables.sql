-- ===========================================================================
--  Add `tables` to the public storefront view — Supabase → SQL Editor → Run
--  The customer menu (整店一码) offers a table-number dropdown restricted to
--  REAL tables; it reads the labels from this anon-readable view. Table labels
--  are already public (printed on the physical QR signs), so exposing them is
--  safe. Re-runnable (drop + recreate). Adds `tables` alongside the existing
--  columns — nothing else changes.
-- ===========================================================================
drop view if exists public.storefront;
create view public.storefront with (security_invoker = false) as
  select slug, name, cat_order, delivery_fsas, tables from public.tenants;
grant select on public.storefront to anon, authenticated;

-- 验证：select slug, tables from storefront where slug='fulai';
