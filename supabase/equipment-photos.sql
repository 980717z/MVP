-- ===========================================================================
--  设备维护照片存储桶
--  Supabase → SQL Editor → Run（可重复跑）
--  和 menu-images 一样的读写模式：读公开（URL 带随机后缀，不对外链接，不算敏感
--  数据），写仅限本店成员。跟 menu-images 不同的是——这些照片不会出现在任何
--  顾客可见的页面（QR 菜单等），纯粹是后台维护记录用的。
-- ===========================================================================

insert into storage.buckets (id, name, public)
values ('equipment-photos', 'equipment-photos', true)
on conflict (id) do nothing;

drop policy if exists "equipment photos public read" on storage.objects;
create policy "equipment photos public read" on storage.objects
  for select using (bucket_id = 'equipment-photos');

drop policy if exists "equipment photos write" on storage.objects;
create policy "equipment photos write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'equipment-photos'
    and public.can_access_tenant((storage.foldername(name))[1])
  );

drop policy if exists "equipment photos modify" on storage.objects;
create policy "equipment photos modify" on storage.objects
  for update to authenticated
  using (bucket_id = 'equipment-photos' and public.can_access_tenant((storage.foldername(name))[1]));

drop policy if exists "equipment photos delete" on storage.objects;
create policy "equipment photos delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'equipment-photos' and public.can_access_tenant((storage.foldername(name))[1]));

-- ===========================================================================
--  Done.
-- ===========================================================================
