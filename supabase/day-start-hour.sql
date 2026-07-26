-- ===========================================================================
--  Per-tenant business-day start hour. Sales after midnight but before this
--  hour count toward the PREVIOUS calendar day, so late-night shops close one
--  clean "business day" instead of splitting the night at midnight.
--  0 = midnight (default, unchanged behaviour). fulai opens until ~2am → 7.
--  Supabase → SQL Editor → Run. Re-runnable.
-- ===========================================================================
alter table public.tenants
  add column if not exists day_start_hour int not null default 0;
alter table public.tenants drop constraint if exists tenants_day_start_hour_chk;
alter table public.tenants
  add constraint tenants_day_start_hour_chk check (day_start_hour between 0 and 23);

-- fulai (富来小厨) runs late; a new business day starts at 7am.
update public.tenants set day_start_hour = 7 where slug = 'fulai';

-- 验证: select slug, day_start_hour from tenants where slug='fulai';
