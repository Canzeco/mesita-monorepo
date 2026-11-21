-- MESITA-4571: thirty families. Family, Karaoke, Fun, Cinema, Casino, Spa and
-- Tourism leave the catalog.
--
-- Pato, 2026-11-21: "I WANT ONLY 30 FAMILIES. COMPRESS THE LIST OR REMOVE
-- ITEMS. MUST ONLY 30 FAMILIES." On that day none of the seven sat on a live
-- place and none is food or drink. Sports and Hookah also sat on none but
-- stay (MESITA-2930: "Keep Sports and Hookah"). Slugs, labels, emoji and the
-- order of the thirty that stay are untouched; sort_order closes up, 1..30,
-- Undefined stays 999.
--
-- Order:
--   1. seed_place_families() is defined FIRST (place-families-parity.test.ts
--      reads the first `insert into public.place_families` in the newest
--      migration that defines the seed).
--   2. Every stored place_profiles.family_keys drops the seven, before the
--      seed deletes the rows; a list left empty becomes null (Undefined).
--   3. The seed runs.
--   4. catalog_membership.enabled goes off for every Google type that is not
--      a table — the seven's own types and the halls, stadiums, shops and
--      stands (RETIRED_RAIL_TYPES in catalog-families.ts; Pato: "reduce the
--      size or list of allowed google categories"):
--      Search's gate reads the code map and Create reads this switch, and
--      the two must agree (MESITA-2974).

create or replace function public.seed_place_families()
returns void
language plpgsql
set search_path to ''
as $function$
begin
  update public.place_families set sort_order = sort_order + 1000 where true;
  insert into public.place_families (slug, label, emoji, sort_order) values
    ('dinner', 'Dinner', '🍽️', 1),
    ('coffee', 'Coffee', '☕', 2),
    ('drinks', 'Bar', '🍻', 3),
    ('quick_bite', 'Quick', '⚡', 4),
    ('breakfast', 'Breakfast', '🍳', 5),
    ('mexican', 'Mexican', '🇲🇽', 6),
    ('tacos', 'Tacos', '🌮', 7),
    ('seafood', 'Seafood', '🦐', 8),
    ('asian', 'Asian', '🍥', 9),
    ('european', 'European', '🥨', 10),
    ('fancy', 'Fancy', '🥂', 11),
    ('steak', 'Steak', '🥩', 12),
    ('japanese', 'Japanese', '🍱', 13),
    ('american', 'American', '🍟', 14),
    ('healthy', 'Healthy', '🥗', 15),
    ('italian', 'Italian', '🍝', 16),
    ('sushi', 'Sushi', '🍣', 17),
    ('pizza', 'Pizza', '🍕', 18),
    ('burgers', 'Burgers', '🍔', 19),
    ('arabic', 'Arabic', '🧆', 20),
    ('chinese', 'Chinese', '🥡', 21),
    ('indian', 'Indian', '🍛', 22),
    ('chicken', 'Wings', '🍗', 23),
    ('sweet', 'Dessert', '🍰', 24),
    ('night_out', 'Night', '🌙', 25),
    ('bakery', 'Bakery', '🥐', 26),
    ('nightclub', 'Club', '🪩', 27),
    ('music', 'Music', '🎶', 28),
    ('sports', 'Sports', '📺', 29),
    ('hookah', 'Hookah', '💨', 30),
    ('undefined', 'Undefined', '·', 999)
  on conflict (slug) do update set
    label = excluded.label,
    emoji = excluded.emoji,
    sort_order = excluded.sort_order;
  delete from public.place_families
   where slug not in ('dinner','coffee','drinks','quick_bite','breakfast','mexican','tacos','seafood','asian','european','fancy','steak','japanese','american','healthy','italian','sushi','pizza','burgers','arabic','chinese','indian','chicken','sweet','night_out','bakery','nightclub','music','sports','hookah','undefined');
end;
$function$;

update public.place_profiles p
   set family_keys = (
     select array_agg(k.slug order by k.ord)
       from unnest(p.family_keys) with ordinality as k(slug, ord)
      where k.slug not in ('family', 'karaoke', 'fun', 'cinema', 'casino', 'spa', 'tourist'))
 where p.family_keys && array['family', 'karaoke', 'fun', 'cinema', 'casino', 'spa', 'tourist']::text[];

select public.seed_place_families();

update public.catalog_membership
   set enabled = false
 where enabled
   and slug in (
     'bowling_alley', 'video_arcade', 'arcade', 'amusement_center', 'escape_room',
     'laser_tag', 'axe_throwing', 'trampoline_park', 'go_karting_venue', 'go_kart',
     'golf_course', 'indoor_golf_course', 'miniature_golf_course', 'mini_golf',
     'adventure_sports_center', 'paintball_center', 'race_course', 'ice_skating_rink',
     'water_park', 'movie_theater', 'performing_arts_theater', 'theater', 'casino',
     'spa', 'massage_spa', 'sauna', 'wellness_center', 'public_bath', 'temazcal',
     'hot_springs', 'zoo', 'aquarium', 'wildlife_park', 'amusement_park',
     'indoor_playground', 'ferris_wheel', 'roller_coaster', 'planetarium',
     'tourist_attraction', 'cultural_center', 'museum', 'art_museum', 'history_museum',
     'art_gallery', 'botanical_garden', 'observation_deck', 'market', 'flea_market',
     'farmers_market',
     -- Not a table: halls, stadiums, shops, stands, a food court.
     'concert_hall', 'concert_venue', 'amphitheatre', 'philharmonic_hall', 'opera_house',
     'auditorium', 'stadium', 'arena', 'vineyard', 'chocolate_factory',
     'chocolate_shop', 'confectionery', 'coffee_roastery', 'coffee_stand', 'hot_dog_stand',
     'pizza_delivery', 'meal_takeaway', 'food_court');

-- Postflight.
do $$
declare
  n int;
begin
  select count(*) into n from public.place_families;
  if n <> 31 then
    raise exception 'place_families holds % rows, expected 30 families plus Undefined', n;
  end if;
  select count(*) into n from public.place_profiles
   where family_keys && array['family', 'karaoke', 'fun', 'cinema', 'casino', 'spa', 'tourist']::text[];
  if n <> 0 then
    raise exception '% places still store a family that is gone', n;
  end if;
  select count(*) into n from public.catalog_membership
   where enabled and slug in ('tourist_attraction', 'museum', 'spa', 'casino', 'movie_theater', 'bowling_alley', 'zoo', 'stadium', 'concert_hall', 'food_court', 'chocolate_shop');
  if n <> 0 then
    raise exception '% retired Google types are still enabled', n;
  end if;
end;
$$;
