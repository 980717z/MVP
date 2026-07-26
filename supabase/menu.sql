-- ===========================================================================
--  菜单设置 (Menu Settings) — dedicated schema
--  Run in Supabase → SQL Editor. Safe to re-run (idempotent).
--  Gives "菜单设置" its own table + an image storage bucket, separate from the
--  generic `records` table.
-- ===========================================================================

-- ── 1. Table ────────────────────────────────────────────────────────────────
create table if not exists public.menu_items (
  id           uuid        primary key default gen_random_uuid(),
  tenant_slug  text        not null references public.tenants (slug) on delete cascade,
  name_zh      text        not null,
  name_en      text        not null default '',
  price        numeric,
  category     text        not null default '',
  image_url    text        not null default '',
  sort         int         not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists menu_items_tenant_idx
  on public.menu_items (tenant_slug, sort, created_at);

-- ── 2. RLS (same tenant rule as the rest of the app) ────────────────────────
alter table public.menu_items enable row level security;

drop policy if exists menu_items_select on public.menu_items;
create policy menu_items_select on public.menu_items
  for select using (public.can_access_tenant(tenant_slug));

drop policy if exists menu_items_write on public.menu_items;
create policy menu_items_write on public.menu_items
  for all
  using (public.can_access_tenant(tenant_slug))
  with check (public.can_access_tenant(tenant_slug));

grant select, insert, update, delete on public.menu_items to authenticated;

-- ── 3. Image storage bucket ─────────────────────────────────────────────────
-- Public bucket so menu images can be shown by URL. Writes are restricted to
-- members of the owning tenant; files live under "<tenant_slug>/<file>".
insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

-- anyone can read (public menu images)
drop policy if exists "menu images public read" on storage.objects;
create policy "menu images public read" on storage.objects
  for select using (bucket_id = 'menu-images');

-- only members of the tenant folder can write/replace/delete
drop policy if exists "menu images write" on storage.objects;
create policy "menu images write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'menu-images'
    and public.can_access_tenant((storage.foldername(name))[1])
  );

drop policy if exists "menu images modify" on storage.objects;
create policy "menu images modify" on storage.objects
  for update to authenticated
  using (bucket_id = 'menu-images' and public.can_access_tenant((storage.foldername(name))[1]));

drop policy if exists "menu images delete" on storage.objects;
create policy "menu images delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'menu-images' and public.can_access_tenant((storage.foldername(name))[1]));

-- ===========================================================================
--  Done.
-- ===========================================================================
