-- ===========================================================================
--  Gate 体检：验证 qr-lock.sql 的防护真的在生产环境里（防手动迁移漂移）
--  Supabase → SQL Editor → Run。每行 status 都应该是 OK；任何 MISSING 都
--  说明 qr-lock.sql 没跑全 —— 重跑它（可重复执行）。
-- ===========================================================================

select 'protect trigger'      as gate,
       case when exists (select 1 from pg_trigger where tgname = 'trg_protect_qr_contract')
            then 'OK' else 'MISSING' end as status
union all
select 'audit trigger',
       case when exists (select 1 from pg_trigger where tgname = 'trg_audit_tenants')
            then 'OK' else 'MISSING' end
union all
select 'slug format constraint',
       case when exists (select 1 from pg_constraint where conname = 'tenants_slug_format')
            then 'OK' else 'MISSING' end
union all
select 'template_key unique index',
       case when exists (select 1 from pg_indexes where indexname = 'menu_items_template_key_uniq')
            then 'OK' else 'MISSING' end
union all
select 'audit table RLS',
       case when (select relrowsecurity from pg_class where relname = 'tenants_audit') is true
            then 'OK' else 'MISSING' end
union all
select 'fulai locked',
       case when exists (select 1 from public.tenants where slug = 'fulai' and qr_locked_at is not null)
            then 'OK' else 'MISSING' end
union all
select 'audit fn search_path pinned',
       case when exists (
         select 1 from pg_proc p
         where p.proname = 'audit_tenants_change'
           and array_to_string(p.proconfig, ',') like '%search_path=public%')
            then 'OK' else 'MISSING' end;
