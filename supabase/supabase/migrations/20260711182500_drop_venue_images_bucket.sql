-- MESITA-555 — retire the legacy venue-images bucket.
--
-- venue-images (0057) was the pre-rename gallery bucket. After the venue→place
-- rename, place-images (20260705110000) became the live gallery and every
-- referenced image was re-mirrored there. venue-images was left in place only
-- so old public URLs kept resolving — but nothing points at it anymore:
-- places.photos / products / menus / menu_pdf_url and place_media_assets.public_url
-- all had zero venue-images references when this migration was written. The
-- objects were fully orphaned legacy weight.
--
-- The project blocks direct DELETE on storage.objects / storage.buckets
-- ("Direct deletion from storage tables is not allowed. Use the Storage API
-- instead.", SQLSTATE 42501). So on the live singleton the bucket was emptied
-- and removed via the sanctioned Storage API:
--   supabase storage rm -r --linked --experimental ss:///venue-images/
-- (removes the underlying blobs, not just the rows, and drops the bucket).
--
-- This migration is the ledger record of that removal and a best-effort cleanup
-- for any environment where the storage guard is absent. Where the guard is
-- present (or the bucket is already gone) the delete is caught and no-ops, so
-- the migration is safe to run everywhere.
do $$
begin
  delete from storage.objects where bucket_id = 'venue-images';
  delete from storage.buckets where id = 'venue-images';
exception
  when insufficient_privilege then
    raise notice 'venue-images left to the Storage API (storage-table deletes are guarded)';
end
$$;
