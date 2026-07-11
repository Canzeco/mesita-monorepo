-- MESITA-555 — menu-images: dedicated public bucket for menu / catalog uploads.
--
-- Business (PlaceMenuFields) and admin (ProductsSection) let a signed-in user
-- upload a menu or catalog file (PDF or image). Those uploads used to land in
-- place-images under business/{project_id}/catalog/… — mixing menus into the
-- gallery bucket. They now go to this dedicated bucket instead, keeping
-- place-images for gallery photos only.
--
-- Public bucket: menu URLs are stored on places and rendered straight from the
-- public URL (no signing), same as place-images. The enricher writes gallery
-- images with the service-role key and never touches this bucket.
--
-- Path contract (mirrors place-images so the RLS predicate is identical):
--   business/{project_id}/catalog/{timestamp}-{uuid}.{ext}
--
-- The is_super_admin() / is_project_member() helpers already exist
-- (20260709193328_place_images_storage_policies) — reused here as-is.

insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

-- Public read — bucket is public; menu URLs must resolve for anon consumers.
drop policy if exists "menu_images_public_read" on storage.objects;
create policy "menu_images_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'menu-images');

-- Members (any role) + super-admins may upload under business/{project_id}/…
drop policy if exists "menu_images_member_or_admin_insert" on storage.objects;
create policy "menu_images_member_or_admin_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] = 'business'
    and (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (
      public.is_super_admin()
      or public.is_project_member(((storage.foldername(name))[2])::uuid)
    )
  );

-- Same principals may overwrite/delete their own uploads (optional cleanup).
drop policy if exists "menu_images_member_or_admin_update" on storage.objects;
create policy "menu_images_member_or_admin_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] = 'business'
    and (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (
      public.is_super_admin()
      or public.is_project_member(((storage.foldername(name))[2])::uuid)
    )
  )
  with check (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] = 'business'
    and (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (
      public.is_super_admin()
      or public.is_project_member(((storage.foldername(name))[2])::uuid)
    )
  );

drop policy if exists "menu_images_member_or_admin_delete" on storage.objects;
create policy "menu_images_member_or_admin_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] = 'business'
    and (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (
      public.is_super_admin()
      or public.is_project_member(((storage.foldername(name))[2])::uuid)
    )
  );
