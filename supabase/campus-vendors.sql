-- ===========================================================================
--  Campus Marketplace — Phase 1 schema ("what to eat today" directory).
--  Idempotent: safe to re-run. Supabase → SQL Editor → Run.
--
--  A NEW table (campus_vendors, 1:1 with tenants, opt-in by row) holds the
--  marketplace listing so high-frequency status writes don't churn the tenants
--  row. The /eat directory reads through ONE security-definer RPC
--  (get_campus_directory) that computes EFFECTIVE status server-side from
--  hours + sold_out_until + manual status — mirrors get_order_tracking
--  (campus-pickup.sql): anon gets the RPC only, never the table.
--
--  Effective status precedence (computed in the RPC, so the client can't get
--  it wrong and stale toggles self-heal):
--    1. manual 'closed'  OR  outside today's hours   → closed   (hours auto-close)
--    2. sold_out_until > now()                        → sold_out (auto-expires)
--    3. manual 'busy'                                 → busy (+ short|long band)
--    4. otherwise                                     → open
-- ===========================================================================

-- 1) Vendor listing table --------------------------------------------------
create table if not exists public.campus_vendors (
  tenant_slug        text        primary key references public.tenants (slug) on delete cascade,
  listed             boolean     not null default false,       -- opt-in: shows on /eat when true
  campus             text        not null default 'uoft-stgeorge',
  zone               text        not null default '',          -- 'Spadina','Robarts',... (grouping)
  hours              jsonb       not null default '{}'::jsonb,  -- weekly, America/Toronto; see note below
  cuisine_tags       text[]      not null default '{}',
  dietary_tags       text[]      not null default '{}',        -- 'halal','veg',...
  price_band         text        not null default '$',
  status             text        not null default 'closed',    -- manual: open|busy|closed
  busy_band          text,                                     -- short|long (only meaningful when busy)
  sold_out_until     timestamptz,                              -- set to end-of-day when marked sold out
  special            jsonb,                                    -- {zh,en,fr} today's special (nullable)
  lat                double precision,                         -- opt-in walk-time (D3); nullable
  lng                double precision,
  status_updated_at  timestamptz not null default now()        -- heartbeat for staleness display
);

alter table public.campus_vendors drop constraint if exists campus_vendors_status_chk;
alter table public.campus_vendors add constraint campus_vendors_status_chk
  check (status in ('open','busy','closed'));
alter table public.campus_vendors drop constraint if exists campus_vendors_busy_band_chk;
alter table public.campus_vendors add constraint campus_vendors_busy_band_chk
  check (busy_band is null or busy_band in ('short','long'));
alter table public.campus_vendors drop constraint if exists campus_vendors_price_band_chk;
alter table public.campus_vendors add constraint campus_vendors_price_band_chk
  check (price_band in ('$','$$','$$$'));

create index if not exists campus_vendors_listed_idx
  on public.campus_vendors (campus, zone) where listed = true;

--  hours shape (America/Toronto local "HH24:MI"), empty array = closed that day:
--    { "mon": [["11:00","20:00"]], "tue": [["11:00","20:00"]], ... , "sun": [] }

-- 2) RLS: owner writes own row; NO anon table access (anon uses the RPC only) -
alter table public.campus_vendors enable row level security;
grant select, insert, update, delete on public.campus_vendors to authenticated;

drop policy if exists campus_vendors_owner_all on public.campus_vendors;
create policy campus_vendors_owner_all on public.campus_vendors
  for all
  using      (exists (select 1 from public.tenants where slug = tenant_slug and owner_id = auth.uid()))
  with check (exists (select 1 from public.tenants where slug = tenant_slug and owner_id = auth.uid()));

-- 3) Public directory read — security-definer RPC, public columns ONLY -------
--  Bypasses RLS (like storefront / get_order_tracking) but returns only
--  listed rows and marketplace-safe columns — never owner_id/address/phone.
create or replace function public.get_campus_directory(p_campus text default 'uoft-stgeorge')
returns table (
  slug               text,
  name               jsonb,
  zone               text,
  cuisine_tags       text[],
  dietary_tags       text[],
  price_band         text,
  special            jsonb,
  lat                double precision,
  lng                double precision,
  payment_mode       text,
  effective_status   text,     -- open | busy | sold_out | closed (computed)
  busy_band          text,     -- short | long (only when busy)
  hours              jsonb,     -- so the client can show "Opens 8:00 AM" when closed
  status_updated_at  timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  with clock as (
    select
      lower(to_char(now() at time zone 'America/Toronto', 'dy'))    as dow,   -- 'mon'..'sun'
      to_char(now() at time zone 'America/Toronto', 'HH24:MI')       as hhmm
  )
  select
    cv.tenant_slug, t.name, cv.zone, cv.cuisine_tags, cv.dietary_tags,
    cv.price_band, cv.special, cv.lat, cv.lng, t.payment_mode,
    case
      when cv.status = 'closed'
        or not exists (
          select 1
          from clock c, jsonb_array_elements(coalesce(cv.hours -> c.dow, '[]'::jsonb)) iv
          where (iv->>0) <= c.hhmm and c.hhmm < (iv->>1)
        )
        then 'closed'
      when cv.sold_out_until is not null and cv.sold_out_until > now() then 'sold_out'
      when cv.status = 'busy' then 'busy'
      else 'open'
    end                                                          as effective_status,
    case when cv.status = 'busy' then cv.busy_band end           as busy_band,
    cv.hours, cv.status_updated_at
  from public.campus_vendors cv
  join public.tenants t on t.slug = cv.tenant_slug
  where cv.listed = true and cv.campus = p_campus
  order by cv.zone, t.slug;
$$;

revoke all on function public.get_campus_directory(text) from public;
grant execute on function public.get_campus_directory(text) to anon, authenticated;

-- 4) Dev seed: list demo-truck (校园餐车 / Campus Eats) so /eat has content ----
--  Safe/idempotent. Remove or set listed=false for prod campuses without a truck.
insert into public.campus_vendors (tenant_slug, listed, campus, zone, hours,
    cuisine_tags, dietary_tags, price_band, status, special)
values (
  'demo-truck', true, 'uoft-stgeorge', 'Spadina',
  '{"mon":[["09:00","20:00"]],"tue":[["09:00","20:00"]],"wed":[["09:00","20:00"]],"thu":[["09:00","20:00"]],"fri":[["09:00","20:00"]],"sat":[["11:00","18:00"]],"sun":[]}'::jsonb,
  array['bento','rice bowls'], array['veg'], '$', 'open',
  '{"zh":"今日特餐:招牌便当","en":"Today: signature bento","fr":"Aujourd''hui : bento signature"}'::jsonb
)
on conflict (tenant_slug) do update
  set listed = excluded.listed, campus = excluded.campus, zone = excluded.zone,
      hours = excluded.hours, status_updated_at = now();

-- ===========================================================================
--  Done. /eat reads get_campus_directory('uoft-stgeorge'). Back-office writes
--  campus_vendors (owner RLS). Verify:
--    select * from get_campus_directory('uoft-stgeorge');
-- ===========================================================================
