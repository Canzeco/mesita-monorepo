-- MESITA-558 — menu-pdfs: dedicated public bucket for menu PDF uploads.
--
-- Follow-up to menu-images (20260711182000). The menu uploader (business
-- PlaceMenuFields, admin ProductsSection) accepts PDFs or images; images go to
-- menu-images, PDFs now go here. Splitting by kind keeps the three buckets
-- clean: place-images (gallery) · menu-images (menu images) · menu-pdfs (menu
-- PDFs). The client picks the bucket via bucketForMenuFile() by MIME type.
--
-- Public bucket: menu PDF URLs are stored on places and rendered/opened
-- straight from the public URL (no signing), same as menu-images.
--
-- Path contract (identical to menu-images / place-images, so the RLS predicate
-- is reused verbatim):
--   business/{project_id}/catalog/{timestamp}-{uuid}.pdf
--
-- The is_super_admin() / is_project_member() helpers already exist
-- (20260709193328_place_images_storage_policies) — reused here as-is.

insert into storage.buckets (id, name, public)
values ('menu-pdfs', 'menu-pdfs', true)
on conflict (id) do nothing;

-- Public read — bucket is public; menu PDF URLs must resolve for anon consumers.
drop policy if exists "menu_pdfs_public_read" on storage.objects;
create policy "menu_pdfs_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'menu-pdfs');

-- Members (any role) + super-admins may upload under business/{project_id}/…
drop policy if exists "menu_pdfs_member_or_admin_insert" on storage.objects;
create policy "menu_pdfs_member_or_admin_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'menu-pdfs'
    and (storage.foldername(name))[1] = 'business'
    and (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (
      public.is_super_admin()
      or public.is_project_member(((storage.foldername(name))[2])::uuid)
    )
  );

-- Same principals may overwrite/delete their own uploads (optional cleanup).
drop policy if exists "menu_pdfs_member_or_admin_update" on storage.objects;
create policy "menu_pdfs_member_or_admin_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'menu-pdfs'
    and (storage.foldername(name))[1] = 'business'
    and (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (
      public.is_super_admin()
      or public.is_project_member(((storage.foldername(name))[2])::uuid)
    )
  )
  with check (
    bucket_id = 'menu-pdfs'
    and (storage.foldername(name))[1] = 'business'
    and (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (
      public.is_super_admin()
      or public.is_project_member(((storage.foldername(name))[2])::uuid)
    )
  );

drop policy if exists "menu_pdfs_member_or_admin_delete" on storage.objects;
create policy "menu_pdfs_member_or_admin_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'menu-pdfs'
    and (storage.foldername(name))[1] = 'business'
    and (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (
      public.is_super_admin()
      or public.is_project_member(((storage.foldername(name))[2])::uuid)
    )
  );
