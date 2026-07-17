-- ===========================================================================
--  Order-insert abuse guard — protects the kitchen printer + order log from a
--  flood. Anon clients insert directly into `orders` (orders_public_insert
--  with check (true)) and every new row auto-prints via the Epson poll, so an
--  unthrottled insert path is a paper/DoS vector: a script with the public
--  anon key (or devtools open) could print hundreds of tickets mid-service.
--
--  This BEFORE INSERT trigger enforces two rolling-window caps, entirely in
--  the database (global + unbypassable, unlike the per-serverless-instance
--  lib/rateLimit.ts). Thresholds are set FAR above any real small-shop peak so
--  a genuine dinner rush never trips them; a flood is thousands/min and gets
--  cut to a trickle.
--
--    • Per-tenant: <= 30 new orders / rolling 60s. The catastrophic-flood
--      backstop. Fulai (~12 tables) never approaches this; a campus truck at
--      lunch peak doesn't either.
--    • Per-phone: <= 6 new orders / rolling 5 min, for REAL phone numbers only
--      (togo/delivery require a 10-digit phone). Catches a naive single-identity
--      loop. Dine-in's 'N/A' sentinel is excluded so a busy N/A night can't
--      false-positive.
--
--  Uses the existing orders_tenant_idx (tenant_slug, created_at desc) — the
--  count is a cheap index range scan.
--
--  NOTE: this does NOT stop an attacker rotating phone numbers within the
--  per-tenant cap (max ~30 junk tickets/min). True per-IP limiting needs the
--  insert behind an API route; that's a follow-up if real abuse appears.
--
--  Reversible: `drop trigger orders_rate_limit on public.orders;`
--  Supabase → SQL Editor → Run (idempotent).
-- ===========================================================================

create or replace function public.orders_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant_recent int;
  phone_recent  int;
begin
  -- Per-tenant burst cap (60s window).
  select count(*) into tenant_recent
    from public.orders
   where tenant_slug = new.tenant_slug
     and created_at > now() - interval '60 seconds';
  if tenant_recent >= 30 then
    raise exception '下单太频繁，请稍后再试 / Too many orders right now, please try again in a minute'
      using errcode = '53400';
  end if;

  -- Per-phone cap (5 min window) for real numbers only; 'N/A' dine-in is exempt.
  if new.phone is not null and new.phone <> 'N/A' and new.phone ~ '^[0-9]{10}$' then
    select count(*) into phone_recent
      from public.orders
     where phone = new.phone
       and created_at > now() - interval '5 minutes';
    if phone_recent >= 6 then
      raise exception '该号码下单过于频繁，请稍后再试 / This number has ordered too many times, please wait a few minutes'
        using errcode = '53400';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_rate_limit on public.orders;
create trigger orders_rate_limit
  before insert on public.orders
  for each row execute function public.orders_rate_limit();

-- ===========================================================================
--  Done. To tune: edit the two thresholds (30 / 60s, 6 / 5min) and re-run.
-- ===========================================================================
