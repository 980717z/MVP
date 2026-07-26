-- ===========================================================================
--  List Pita Express on the campus directory (/eat).
--  Provisioning seeded its campus_vendors row with listed=false (opt-in); this
--  flips it on and fills the fields that make the card show correctly:
--    • status='open' + hours  → the RPC auto-computes open/closed by clock
--    • hours also drive the pickup ORDERING gate (/api/pickup/hours) — set them
--      right and closed-hour orders get blocked automatically
--    • dietary_tags {halal} → the halal badge students filter on
--  Adjust the days/times + zone to the truck's real schedule before running.
--  Supabase → SQL Editor → Run. Idempotent.
-- ===========================================================================

update public.campus_vendors set
  listed            = true,
  status            = 'open',
  price_band        = '$',
  dietary_tags      = '{halal}',
  cuisine_tags      = '{shawarma,middle-eastern,halal}',
  -- Weekly hours, America/Toronto, "HH:MM"; [] = closed that day.
  -- (Template said 11:00–20:00; confirm the truck's real days/times.)
  hours             = '{"mon":[["11:00","20:00"]],"tue":[["11:00","20:00"]],"wed":[["11:00","20:00"]],"thu":[["11:00","20:00"]],"fri":[["11:00","20:00"]],"sat":[],"sun":[]}'::jsonb,
  status_updated_at = now()
where tenant_slug = 'pita-express';

-- zone was set when you provisioned (the St. George dropdown). To move it:
--   update public.campus_vendors set zone = 'Spadina' where tenant_slug = 'pita-express';

-- Verify: listed=t, status=open, has hours + halal.
select tenant_slug, listed, status, zone, price_band, dietary_tags,
       jsonb_object_keys(hours) as day_with_hours
  from public.campus_vendors where tenant_slug = 'pita-express';
