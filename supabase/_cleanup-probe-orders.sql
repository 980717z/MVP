-- One-off: remove the 2 junk orders created during VT1-RLS verification
-- (anon has no delete grant, so this must run as a privileged role in the
-- Supabase SQL editor). Targets exactly those rows: empty items, $0, the probe
-- phone, togo/delivery, on pita-express. Review the SELECT before the DELETE.
select id, order_type, created_at from public.orders
  where tenant_slug = 'pita-express' and items = '[]'::jsonb and total = 0
    and phone = '4165551234' and order_type in ('togo','delivery');

delete from public.orders
  where tenant_slug = 'pita-express' and items = '[]'::jsonb and total = 0
    and phone = '4165551234' and order_type in ('togo','delivery');
