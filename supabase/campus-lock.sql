-- ===========================================================================
--  Campus content lockdown — Task 2 (RLS lock).
--
--  Campus tenants (tenants.campus = true) are configured ONLY by the BentoOS
--  team; merchant staff can view but not write. This adds RESTRICTIVE
--  policies (AND'd with the existing PERMISSIVE ones — see menu.sql /
--  schema.sql) so a campus + non-admin write is blocked regardless of what
--  the permissive `can_access_tenant` policies already allow. Pattern copied
--  from supabase/order-modes-rls.sql's guard.
--
--  PREREQUISITE: supabase/admin-emails.sql must be run FIRST — these policies
--  call public.is_admin(), which does not exist until that file runs.
--
--  Supabase → SQL Editor → Run. Idempotent.
-- ===========================================================================

-- ── 1. menu_items — READY, no known side effects ────────────────────────────
--  Blocks insert/update/delete on dishes for campus tenants unless is_admin().
--  Read (select) is untouched — merchants can still SEE their menu, per the
--  "view-only" requirement. Covers name/price/category/sort/variants/
--  sold_out/is_market (market price) — all go through the same table, so
--  there's no way to carve out an exception for "today's price" without a
--  separate RPC (not built — see Task 0 notes on this).

drop policy if exists menu_items_campus_lock_insert on public.menu_items;
create policy menu_items_campus_lock_insert on public.menu_items
  as restrictive for insert to authenticated
  with check (
    public.is_admin()
    or not exists (select 1 from public.tenants t where t.slug = tenant_slug and t.campus = true)
  );

drop policy if exists menu_items_campus_lock_update on public.menu_items;
create policy menu_items_campus_lock_update on public.menu_items
  as restrictive for update to authenticated
  using (
    public.is_admin()
    or not exists (select 1 from public.tenants t where t.slug = tenant_slug and t.campus = true)
  )
  with check (
    public.is_admin()
    or not exists (select 1 from public.tenants t where t.slug = tenant_slug and t.campus = true)
  );

drop policy if exists menu_items_campus_lock_delete on public.menu_items;
create policy menu_items_campus_lock_delete on public.menu_items
  as restrictive for delete to authenticated
  using (
    public.is_admin()
    or not exists (select 1 from public.tenants t where t.slug = tenant_slug and t.campus = true)
  );

-- ── 1b. menu-images storage bucket — same lock, covers "传图" ───────────────
--  Without this, a campus merchant can't add/edit dish rows (locked above)
--  but could still upload/replace/delete files in their menu-images/<slug>/
--  folder directly, e.g. swapping a photo without a menu_items write.

drop policy if exists "menu images campus lock insert" on storage.objects;
create policy "menu images campus lock insert" on storage.objects
  as restrictive for insert to authenticated
  with check (
    bucket_id <> 'menu-images'
    or public.is_admin()
    or not exists (
      select 1 from public.tenants t
      where t.slug = (storage.foldername(name))[1] and t.campus = true
    )
  );

drop policy if exists "menu images campus lock update" on storage.objects;
create policy "menu images campus lock update" on storage.objects
  as restrictive for update to authenticated
  using (
    bucket_id <> 'menu-images'
    or public.is_admin()
    or not exists (
      select 1 from public.tenants t
      where t.slug = (storage.foldername(name))[1] and t.campus = true
    )
  );

drop policy if exists "menu images campus lock delete" on storage.objects;
create policy "menu images campus lock delete" on storage.objects
  as restrictive for delete to authenticated
  using (
    bucket_id <> 'menu-images'
    or public.is_admin()
    or not exists (
      select 1 from public.tenants t
      where t.slug = (storage.foldername(name))[1] and t.campus = true
    )
  );

-- ── 2. records — READY. Option B implemented (2026-08-12) ───────────────────
--  `records` is shared by every module, including write paths that used to
--  fire automatically during normal order fulfillment (NOT manual content
--  edits) from the STAFF's own browser session:
--    - postOrderSales / recordOrderSale / adjustOrderSale / deleteOrderSale
--      (module_id 'sales', 'dish-margin') — order complete, merge, edit-add
--    - syncMemberFromOrder (module_id 'members') — order complete, and
--      group-booking's member sync
--  RLS can't tell "staff manually editing the members module" apart from
--  "staff completing an order, which auto-updates members/sales/dish-margin"
--  — both used to be the same authenticated user writing the same table.
--
--  FIX: those specific writes now go through POST /api/orders/post-ledger
--  (app/api/orders/post-ledger/route.ts), which verifies the caller owns/is a
--  member of the tenant, then writes via supabaseAdmin (service-role — bypasses
--  RLS). Call sites updated: components/OrdersPortal.tsx (complete, merge),
--  components/OrderEditor.tsx (edit-add), app/[tenant]/m/[moduleId]/page.tsx
--  (group-booking's member sync only — its own group-booking record still
--  goes through addRecord, correctly staying subject to this lock). The
--  underlying lib/store.ts functions (recordOrderSale / adjustOrderSale /
--  deleteOrderSale / postOrderSales / syncMemberFromOrder) now take an
--  optional `db` client param, defaulting to the browser client — the API
--  route is the only caller that passes supabaseAdmin.
--
--  ⚠️ NOT YET TESTED against a live database (no Supabase access at draft
--  time) — before shipping, verify a completed order still updates
--  sales/dish-margin/members on both a campus and a non-campus tenant.

drop policy if exists records_campus_lock_insert on public.records;
create policy records_campus_lock_insert on public.records
  as restrictive for insert to authenticated
  with check (
    public.is_admin()
    or not exists (select 1 from public.tenants t where t.slug = tenant_slug and t.campus = true)
  );

drop policy if exists records_campus_lock_update on public.records;
create policy records_campus_lock_update on public.records
  as restrictive for update to authenticated
  using (
    public.is_admin()
    or not exists (select 1 from public.tenants t where t.slug = tenant_slug and t.campus = true)
  )
  with check (
    public.is_admin()
    or not exists (select 1 from public.tenants t where t.slug = tenant_slug and t.campus = true)
  );

drop policy if exists records_campus_lock_delete on public.records;
create policy records_campus_lock_delete on public.records
  as restrictive for delete to authenticated
  using (
    public.is_admin()
    or not exists (select 1 from public.tenants t where t.slug = tenant_slug and t.campus = true)
  );

-- ── 3. tenants / members / campus_vendors config columns — CONDITIONAL ──────
--  Task 0's checklist says: "确认 owner-only 已挡住成员; 若某 campus 租户
--  owner 是商户本人,补 campus 守卫。" These three tables' existing policies
--  (tenants_update, members_write, campus_vendors_owner_all — all
--  `owner_id = auth.uid()`) ALREADY block non-owner writes. Whether that's
--  enough depends entirely on the Task 0 ownership-verification query:
--
--    select t.slug, t.campus, u.email as owner_email
--    from public.tenants t join auth.users u on u.id = t.owner_id
--    where t.campus;
--
--  RESULT (ran in Supabase SQL Editor): only one campus tenant exists today —
--  pita-express, owner_email = allen.zhang@bentoos.io.
--
--  Re-confirmed 2026-08-12: Vercel's ADMIN_EMAILS is exactly this one address
--  (see admin-emails.sql — this value bounced between three different answers
--  earlier in the review, so if a new campus tenant is provisioned later,
--  RE-RUN the ownership query and re-check against ADMIN_EMAILS before
--  assuming this conclusion still holds).
--
--  Assumption holds for the current data: tenants_update / members_write /
--  campus_vendors_owner_all already block non-owner writes on pita-express,
--  because its owner IS the one confirmed admin account. NOTHING TO ADD in
--  this section — deliberately not widening these three policies with an
--  is_admin() exception, since it isn't needed today and would otherwise grant
--  direct-session write access to every tenant's config, not just campus
--  ones (a real scope expansion, not a free no-op).

-- ── Verify (once admin-emails.sql + this file have both been run) ──────────
--   As a non-admin campus-tenant member, via curl against PostgREST or the
--   Supabase JS client (NOT the Studio SQL editor, which runs as you):
--     insert into menu_items (...) values (...);   -- expect: blocked by RLS
--   As is_admin():
--     same insert                                   -- expect: succeeds
--   Non-campus tenant, non-admin member:
--     same insert                                   -- expect: succeeds (unaffected)
-- ===========================================================================
