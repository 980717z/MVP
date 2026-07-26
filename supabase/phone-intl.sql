-- ===========================================================================
--  International phone numbers on orders.
--  +1 numbers keep the legacy bare-10-digit format (zero breakage for members
--  matching / existing rows); other country codes store as +<code><digits>.
--  Supabase → SQL Editor → Run (可重复跑).
-- ===========================================================================

alter table public.orders drop constraint if exists orders_phone_chk;
alter table public.orders add constraint orders_phone_chk
  check (phone ~ '^[0-9]{10}$' or phone ~ '^\+[0-9]{8,15}$') not valid;

-- ===========================================================================
--  Done.
-- ===========================================================================
