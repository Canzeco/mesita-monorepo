-- MESITA-2183. Reviews state lives on the place, beside the four tile
-- columns, and is not an enrichment fact. The column is not on public.profiles:
-- admin reads it from place_profiles the same way it reads enrichment, so the
-- view's INSTEAD OF triggers stay untouched.
--
-- Existing numbers stay. A non-null tile column backfills that source to
-- ready with no fetched_at ("on file"). Everything else starts empty.

alter table public.place_profiles
  add column if not exists reviews_state jsonb;

update public.place_profiles
set reviews_state = jsonb_build_object(
  'google', jsonb_build_object(
    'status', case
      when google_stars_overall is not null or google_review_count is not null then 'ready'
      else 'empty'
    end,
    'fetched_at', null,
    'error', null
  ),
  'instagram', jsonb_build_object(
    'status', case when instagram_followers_count is not null then 'ready' else 'empty' end,
    'fetched_at', null,
    'error', null
  ),
  'facebook', jsonb_build_object(
    'status', case when facebook_followers is not null then 'ready' else 'empty' end,
    'fetched_at', null,
    'error', null
  )
)
where reviews_state is null;

alter table public.place_profiles
  alter column reviews_state set default '{
    "google": {"status": "empty", "fetched_at": null, "error": null},
    "instagram": {"status": "empty", "fetched_at": null, "error": null},
    "facebook": {"status": "empty", "fetched_at": null, "error": null}
  }'::jsonb,
  alter column reviews_state set not null;

comment on column public.place_profiles.reviews_state is
  'Per-source reviews reload state (google, instagram, facebook). Independent of enriched_at. MESITA-2183.';
