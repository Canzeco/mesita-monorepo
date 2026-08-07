-- MESITA-953 — consumer-avatars: public bucket for profile photo uploads.
--
-- Path contract (enforced by RLS + consumer-web-update-profile URL check):
--   {consumer_id}/{timestamp}-{uuid}.{ext}
--
-- Client (web + mobile) uploads as the signed-in JWT, then patches
-- consumers.avatar_url via consumer-web-update-profile. Max 2 MiB;
-- JPG / PNG / WEBP only (bucket-enforced + client-validated).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'consumer-avatars',
  'consumer-avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read — avatar URLs render straight from the public object URL.
drop policy if exists "consumer_avatars_public_read" on storage.objects;
create policy "consumer_avatars_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'consumer-avatars');

-- Caller may upload only under their own consumer id folder.
drop policy if exists "consumer_avatars_owner_insert" on storage.objects;
create policy "consumer_avatars_owner_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'consumer-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "consumer_avatars_owner_update" on storage.objects;
create policy "consumer_avatars_owner_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'consumer-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'consumer-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "consumer_avatars_owner_delete" on storage.objects;
create policy "consumer_avatars_owner_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'consumer-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
