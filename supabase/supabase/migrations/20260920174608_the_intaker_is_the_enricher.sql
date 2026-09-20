-- MESITA-2026 — "Intake" dies. CRENUP = CReate + ENrich + UPdate.
--
-- COMMENT-ONLY. No column, type, table or function in this database was ever
-- named `intake` (checked: information_schema.columns had zero matches), so
-- the whole rename is app-layer. What survived here is prose: seven column
-- COMMENTs that still said "the Intaker" or "Intake", written by
-- 20260824020903_the_enricher_is_the_intaker.sql and its neighbours.
--
-- Those files are applied and are NOT edited — history stays as it ran. This
-- migration restates the comments in the live vocabulary instead: the PROCESS
-- is the Enricher (the name /enricher-config and admin-web-*-enricher-config
-- already used), and the UMBRELLA over the three verbs is Crenup.

comment on column public.place_profiles.description is
  'Canonical About — English (Mesita core language). The Enricher always writes English.';

comment on column public.place_profiles.description_es is
  'Spanish translation of About. The Enricher generates from English core; admin/business editable.';

comment on column public.place_profiles.google_name is
  'Google Places displayName — a CACHED OBSERVATION, not an identity spine (google_place_id is). Enricher-only write; changes whenever the Google listing changes.';

comment on column public.place_profiles.mesita_name is
  'Operator display override. NULL/empty ⇒ the place follows google_name. Admin/business writable; the Enricher never touches it.';

comment on column public.place_profiles.reservation_target is
  'Value dialled for reservation_channel — normally a copy of places.phone. Seeded by the Enricher, overridable by an operator.';

comment on column public.place_profiles.request_count is
  'Consumer Requests count. Progress toward the Crenup vote threshold (atlasRequestThreshold). Requested is derived (count > 0 and content_status <> ready).';

comment on column public.app_config.enrichment_config is
  'Crenup knobs (admin /enricher-config). Wire camelCase atlasGatherGoogleImages etc. Image funnel lock is EF write-path only.';
