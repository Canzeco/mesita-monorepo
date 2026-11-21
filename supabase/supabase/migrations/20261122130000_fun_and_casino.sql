-- MESITA-4588: Fun and Casino replace Sports and Hookah in the thirty.
--
-- Pato, 2026-11-21, on the Categories sheet: "MAYBE ADD CASINOS HERE. I CAN
-- GET LOT OF EARLY DEALS FROM CASINOS. REMOVE HOOHAK OR THAT WEIRD SHIT NOBODY
-- UNDERSTANDS." then "AND MAYBE CHANGE SPORTS FOR FUN". A sports bar is Bar
-- and a hookah bar Bar and Night; bowling, karts, arcades, golf, rinks, water
-- parks and casinos come back because they sell early deals. Slugs, labels
-- and emoji of the other 28 are untouched; Fun is 29, Casino 30.
--
--   1. seed_place_families() first (place-families-parity.test.ts reads the
--      newest migration's seed).
--   2. Stored lists drop sports and hookah (none carried either on
--      2026-11-21); an emptied list becomes null.
--   3. The seed runs.
--   4. catalog_membership (the allow-list since MESITA-4576) gains the Fun
--      Google types and casino, so Create and the Search gate agree
--      (pipeline-audit PA-MEMBERSHIP-DRIFT:gate).

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
    ('fun', 'Fun', '🎯', 29),
    ('casino', 'Casino', '🎰', 30),
    ('undefined', 'Undefined', '·', 999)
  on conflict (slug) do update set
    label = excluded.label,
    emoji = excluded.emoji,
    sort_order = excluded.sort_order;
  delete from public.place_families
   where slug not in ('dinner','coffee','drinks','quick_bite','breakfast','mexican','tacos','seafood','asian','european','fancy','steak','japanese','american','healthy','italian','sushi','pizza','burgers','arabic','chinese','indian','chicken','sweet','night_out','bakery','nightclub','music','fun','casino','undefined');
end;
$function$;

update public.place_profiles p
   set family_keys = (
     select array_agg(k.slug order by k.ord)
       from unnest(p.family_keys) with ordinality as k(slug, ord)
      where k.slug not in ('sports', 'hookah'))
 where p.family_keys && array['sports', 'hookah']::text[];

select public.seed_place_families();

insert into public.catalog_membership (slug, enabled) values
  ('bowling_alley', true), ('video_arcade', true), ('amusement_center', true),
  ('go_karting_venue', true), ('golf_course', true), ('indoor_golf_course', true),
  ('miniature_golf_course', true), ('adventure_sports_center', true),
  ('paintball_center', true), ('race_course', true), ('ice_skating_rink', true),
  ('water_park', true), ('amusement_park', true), ('roller_coaster', true),
  ('casino', true)
on conflict (slug) do update set enabled = true;

-- Postflight.
do $$
declare
  n int;
begin
  select count(*) into n from public.place_families;
  if n <> 31 then
    raise exception 'place_families holds % rows, expected 30 families plus Undefined', n;
  end if;
  select count(*) into n from public.place_families where slug in ('sports', 'hookah');
  if n <> 0 then
    raise exception 'Sports or Hookah is still a family';
  end if;
  select count(*) into n from public.place_profiles where family_keys && array['sports', 'hookah']::text[];
  if n <> 0 then
    raise exception '% places still store Sports or Hookah', n;
  end if;
  select count(*) into n from public.catalog_membership where slug in ('casino', 'bowling_alley', 'water_park');
  if n <> 3 then
    raise exception 'casino, bowling_alley or water_park is not allowed';
  end if;
end;
$$;
