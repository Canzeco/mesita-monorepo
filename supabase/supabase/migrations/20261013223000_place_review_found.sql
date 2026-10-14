-- MESITA-2189. Three booleans replace reviews_state. A source is found
-- or it is not. The reason for a miss stays in logs and enrichment_sources,
-- never on the place. The columns are not on public.profiles: admin reads
-- them from place_profiles, so the view's INSTEAD OF triggers stay untouched.
--
-- Backfill from the stored state and from numbers already on the row. A
-- previous success that kept its count (including a reload marked failed)
-- stays found.

alter table public.place_profiles
  add column if not exists google_found boolean not null default false,
  add column if not exists instagram_found boolean not null default false,
  add column if not exists facebook_found boolean not null default false;

update public.place_profiles
set
  google_found = coalesce(reviews_state->'google'->>'status', '') = 'ready'
    or google_stars_overall is not null
    or google_review_count is not null,
  instagram_found = coalesce(reviews_state->'instagram'->>'status', '') = 'ready'
    or instagram_followers_count is not null,
  facebook_found = coalesce(reviews_state->'facebook'->>'status', '') = 'ready'
    or facebook_followers is not null;

alter table public.place_profiles
  drop column if exists reviews_state;

comment on column public.place_profiles.google_found is
  'The Google place id resolved. Stars and the review count sit beside it. MESITA-2189.';

comment on column public.place_profiles.instagram_found is
  'A live Instagram profile came back for instagram_url. MESITA-2189.';

comment on column public.place_profiles.facebook_found is
  'A Facebook page came back for facebook_url. MESITA-2189.';
