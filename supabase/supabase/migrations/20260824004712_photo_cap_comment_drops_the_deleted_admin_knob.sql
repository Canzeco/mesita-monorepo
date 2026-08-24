-- The Enrichment page renders no knobs since 2026-08-23 (Pato: "Fuck this
-- page. Just write it as soon"), so MAX_SAVE_IMAGES — the admin-side constant
-- this comment named as the third mirror — no longer exists. Two mirrors left,
-- and one writer: admin-web-update-enricher-config.
comment on column public.app_config.atlas_save_total_images is
  'How many selected images an enrichment run persists to places.photos ("Save Total Images"). Ceiling 10 (Pato 2026-08-22, was 20) and enforced by app_config_atlas_save_total_images_range. Mirrored in ENRICH_FIELD_LIMITS.photos.max — the two must move together. The admin Enrichment page was a third mirror (MAX_SAVE_IMAGES) until 2026-08-23, when it became a Soon page with no controls; admin-web-update-enricher-config is now the only writer of this column. Separate from PHOTO_CEILING=50 in enrich-config.ts, which caps the stored array at the S9 storage-mirror step regardless of this value.';
