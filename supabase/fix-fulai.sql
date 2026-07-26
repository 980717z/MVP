-- Set the real bilingual name for 富来小厨 / Sang's Seafood so the new
-- dashboard top bar + sidebar show it instead of "Fulai".
-- Run in Supabase Studio → SQL editor. `name` is a jsonb column.
update public.tenants
set name = '{"zh":"富来小厨","en":"Sang''s Seafood"}'::jsonb
where slug = 'fulai';

-- Optional: also enable the "online-orders" module so it appears in the
-- sidebar. (The dashboard's live-orders panel + "View live orders" link work
-- without this — they read the orders table directly — but enabling it adds
-- the nav entry.) Uncomment the matching block for your `enabled` column type.

-- If `enabled` is jsonb:
-- update public.tenants
-- set enabled = case when enabled @> '["online-orders"]'::jsonb
--                    then enabled else enabled || '["online-orders"]'::jsonb end
-- where slug = 'fulai';

-- If `enabled` is text[]:
-- update public.tenants
-- set enabled = case when 'online-orders' = any(enabled)
--                    then enabled else array_append(enabled, 'online-orders') end
-- where slug = 'fulai';

select slug, name, enabled from public.tenants where slug = 'fulai';
