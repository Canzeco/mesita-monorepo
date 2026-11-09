-- MESITA-3528 — the place's profile picture (Pato, 2026-11-08: "add also
-- another box for profile picture, by default is the first image in the
-- media carousel when the profile is created, then you can manually change it").
--
-- place_profiles.profile_photo is the owner's pick, null until they choose.
-- Null follows the cover: the profiles view answers
-- coalesce(profile_photo, photos[1]), so every round photo (place header,
-- voucher pill, wallet, Business sidebar) reads one column. Create, Enrich and
-- Google Update never write it, so a pick survives them all; "Use the cover"
-- writes null. Writes go to place_profiles directly
-- (business-web-update-place), never through the view's INSTEAD OF writers.
--
-- CREATE OR REPLACE appends the column at the end, so the view keeps its
-- INSTEAD OF triggers and its grants (pgTAP pins both).

alter table public.place_profiles add column if not exists profile_photo text;

comment on column public.place_profiles.profile_photo is
  'MESITA-3528: the owner''s profile picture; null follows the cover (photos[1]).';

create or replace view public.profiles with (security_invoker = true) as
 SELECT p.id,
    p.created_at,
    p.updated_at,
    p.google_place_id,
    p.google_types,
    p.prepay_enabled,
    p.payments_enabled,
    u.slug,
    p.name,
    p.category,
    p.price_level,
    u.state,
    p.lat,
    p.lng,
    p.address,
    p.timezone,
    p.closes_at,
    p.phone,
    p.pitch,
    p.story,
    p.photos,
    p.website_url,
    p.instagram_url,
    p.facebook_url,
    p.whatsapp_url,
    p.opentable_url,
    p.resy_url,
    p.uber_eats_url,
    p.x_url,
    p.threads_url,
    p.reddit_url,
    p.google_maps_url,
    p.didi_food_url,
    p.hours,
    p.embedding,
    p.description,
    p.menu_pdf_url,
    p.tags,
    p.google_stars_overall,
    p.google_review_count,
    p.instagram_followers_count,
    u.currency,
    p.menu_pdf_name,
    p.enriched_at,
    p.enrichment_sources,
    p.zone,
    p.city,
    p.facebook_followers,
    p.google_reviews,
    p.menus,
    p.popular_times,
    p.products,
    p.category_label,
    u.content_state,
    p.embedding_source_text,
    p.google_name,
    p.reservation_channel,
    p.reservation_target,
    p.business_state,
    p.business_state_at,
    p.request_count,
    place_family_keys(p.family_keys, p.google_types, p.category) AS family_keys,
    p.reservations_enabled,
    p.google_address,
    p.source_sync,
    p.google_tags,
    u.boost_tier,
    p.google_source_types,
    coalesce(p.profile_photo, p.photos[1]) AS profile_photo
   FROM places u
     JOIN place_profiles p ON p.id = u.id;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'profile_photo'
  ) then
    raise exception 'MESITA-3528: profiles.profile_photo missing after the rebuild';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.profiles'::regclass and tgname = 'profiles_update_trg') then
    raise exception 'MESITA-3528: profiles lost its update trigger';
  end if;
end $$;
