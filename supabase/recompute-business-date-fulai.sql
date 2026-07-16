-- ===========================================================================
--  One-time: re-stamp fulai's PAST checkout sessions under the 7am business-day
--  rule so late-night sales (00:00–07:00) count toward the night before, in
--  historical reports too. business_date = calendar date of (Toronto local
--  time − 7h). Re-runnable and reversible (re-run with a 0h offset to undo).
--  Run AFTER day-start-hour.sql. Supabase → SQL Editor → Run.
-- ===========================================================================
update public.table_sessions
set business_date = ((created_at at time zone 'America/Toronto') - interval '7 hours')::date
where tenant_slug = 'fulai';

-- 验证(应无 00:00–07:00 归到当天的记录):
-- select business_date, count(*) from table_sessions where tenant_slug='fulai'
--   group by business_date order by business_date desc limit 10;
