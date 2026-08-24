-- The agent is the INTAKER (Pato, 2026-08-23, §8.4 "Intaker Functions"). Six
-- column comments still named it the Enricher. Comments only: no column, type,
-- constraint or name moves, because a rename never follows the label — the
-- route stays /enricher-config, the columns stay atlas_*, and the Edge
-- Functions stay admin-web-*-enricher-config.

comment on column public.places.description is
  'Canonical About — English (Mesita core language). The Intaker always writes English.';

comment on column public.places.description_es is
  'Spanish translation of About. The Intaker generates from English core; admin/business editable.';

comment on column public.places.google_name is
  'Google Places displayName — a CACHED OBSERVATION, not an identity spine (google_place_id is). Intaker-only write; changes whenever the Google listing changes.';

comment on column public.places.mesita_name is
  'Operator display override. NULL/empty ⇒ the place follows google_name. Admin/business writable; the Intaker never touches it.';

comment on column public.places.reservation_target is
  'Value dialled for reservation_channel — normally a copy of places.phone. Seeded by the Intaker, overridable by an operator.';

-- Same sweep: this one named the admin page, which is Intake since 2026-08-23.
comment on column public.app_config.atlas_save_total_images is
  'How many selected images an enrichment run persists to places.photos ("Save Total Images"). Ceiling 10 (Pato 2026-08-22, was 20) and enforced by app_config_atlas_save_total_images_range. Mirrored in ENRICH_FIELD_LIMITS.photos.max — the two must move together. The admin Intake page was a third mirror (MAX_SAVE_IMAGES) until 2026-08-23, when it became a Soon page with no controls; admin-web-update-enricher-config is now the only writer of this column. Separate from PHOTO_CEILING=50 in enrich-config.ts, which caps the stored array at the S9 storage-mirror step regardless of this value.';
