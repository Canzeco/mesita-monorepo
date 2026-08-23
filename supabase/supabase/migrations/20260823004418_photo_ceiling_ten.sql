-- The Enricher's "Save Total Images" ceiling drops 20 -> 10 (Pato, 2026-08-22).
--
-- MIRRORED FROM CLOUD (MESITA-1237). This migration was applied directly to the
-- database on 2026-08-23 00:44 UTC and existed only in the ledger; the file is
-- reconstructed verbatim from supabase_migrations.schema_migrations. Its absence
-- made `supabase db push` abort on a remote-only version for the next person to
-- touch the schema, which is exactly what Development Rules §B's mirror-back rule
-- exists to prevent.
--
-- The existing rows are clamped BEFORE the constraint lands, because the check
-- is validated against current data and a live config above the new ceiling
-- would make the ALTER itself fail.

update public.app_config
   set atlas_save_total_images = 10
 where atlas_save_total_images > 10;

alter table public.app_config
  drop constraint if exists app_config_atlas_save_total_images_range;

alter table public.app_config
  add constraint app_config_atlas_save_total_images_range
  check (atlas_save_total_images between 0 and 10);

comment on column public.app_config.atlas_save_total_images is
  'Enricher Config "Images → Save Total Images": how many selected images an enrichment run persists to places.photos. Ceiling 10 (Pato 2026-08-22, was 20) and enforced by app_config_atlas_save_total_images_range. Mirrored in ENRICH_FIELD_LIMITS.photos.max and MAX_SAVE_IMAGES on the admin Enricher Config page — all three must move together. Separate from PHOTO_CEILING=50 in enrich-config.ts, which caps the stored array at the S9 storage-mirror step regardless of this value.';
