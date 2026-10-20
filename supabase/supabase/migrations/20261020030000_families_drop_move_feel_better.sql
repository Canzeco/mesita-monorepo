-- MESITA-2468: Mesita is social (Pato, 2026-10-19: "its more social, so
-- fuck the gyms" + "i neither want barber shops nor fucking spas or that
-- type of shit"). The Move and Feel better families are deleted. Every
-- gym, studio, court, pool, spa, salon, barber and tattoo studio sits in
-- no family (`undefined`), the same list as the code twin
-- `NOT_SOCIAL_TYPES` (`_shared/catalog-families.ts`);
-- `catalog-families.test.ts` pins the pair. The catalog is thirteen
-- families.
--
-- Order matters: every family_keys array drops the two keys BEFORE the
-- family rows go, so the atlas_family_slugs_valid CHECKs never see a
-- dangling key.

update public.catalog_membership
set family_keys = array['undefined']::text[]
where slug in (
-- NOT SOCIAL
  'gym',
  'fitness_center',
  'yoga_studio',
  'sports_club',
  'sports_coaching',
  'sports_complex',
  'sports_school',
  'sports_activity_location',
  'golf_course',
  'indoor_golf_course',
  'ice_skating_rink',
  'swimming_pool',
  'tennis_court',
  'adventure_sports_center',
  'skateboard_park',
  'padel_club',
  'tennis_club',
  'soccer_field',
  'climbing_gym',
  'crossfit_box',
  'pilates_studio',
  'dance_studio',
  'martial_arts',
  'spa',
  'massage',
  'massage_spa',
  'sauna',
  'wellness_center',
  'beauty_salon',
  'hair_salon',
  'hair_care',
  'nail_salon',
  'barber_shop',
  'barbershop',
  'temazcal',
  'hot_springs',
  'medical_spa',
  'tattoo_studio'
-- END NOT SOCIAL
);

-- Any other row still naming the two keys keeps its other families, or
-- falls to undefined when they were its only ones.
update public.catalog_membership
set family_keys = coalesce(
  nullif(array(select k from unnest(family_keys) as k where k not in ('move', 'feel_better')), '{}'::text[]),
  array['undefined']::text[])
where family_keys && array['move', 'feel_better']::text[];

update public.place_categories
set family_keys = coalesce(
  nullif(array(select k from unnest(family_keys) as k where k not in ('move', 'feel_better')), '{}'::text[]),
  array['undefined']::text[])
where family_keys && array['move', 'feel_better']::text[];

update public.place_profiles
set family_keys = coalesce(
  nullif(array(select k from unnest(family_keys) as k where k not in ('move', 'feel_better')), '{}'::text[]),
  array['undefined']::text[])
where family_keys && array['move', 'feel_better']::text[];

delete from public.place_families where slug in ('move', 'feel_better');

create or replace function public.seed_place_families()
returns void
language plpgsql
set search_path to ''
as $function$
begin
  update public.place_families set sort_order = sort_order + 1000 where true;
  insert into public.place_families (slug, label, emoji, sort_order) values
    ('coffee', 'Coffee', '☕', 1),
    ('breakfast', 'Breakfast', '🥐', 2),
    ('quick_bite', 'Quick bite', '🥙', 3),
    ('pizza', 'Pizza', '🍕', 4),
    ('tacos', 'Tacos', '🌮', 5),
    ('sushi', 'Sushi', '🍣', 6),
    ('burgers', 'Burgers', '🍔', 7),
    ('noodles', 'Noodles', '🍜', 8),
    ('dinner', 'Dinner', '🍝', 9),
    ('sweet', 'Sweet', '🍰', 10),
    ('drinks', 'Drinks', '🍸', 11),
    ('night_out', 'Night out', '🌙', 12),
    ('go_out', 'Go out', '🎟️', 13),
    ('undefined', 'Undefined', '·', 999)
  on conflict (slug) do update set
    label = excluded.label,
    emoji = excluded.emoji,
    sort_order = excluded.sort_order;
  delete from public.place_families
   where slug not in (
     'coffee','breakfast','quick_bite','pizza','tacos','sushi','burgers',
     'noodles','dinner','sweet','drinks','night_out','go_out','undefined'
   );
end;
$function$;

-- The category seed carries the same mapping, so a reset writes it too.
create or replace function public.seed_place_categories()
returns void
language plpgsql
set search_path = ''
as $$
begin
  insert into public.place_categories (slug, label, section, sort_order, family_keys) values
    ('mexican', '🌮 Mexican', 'Food & Nightlife', 1, array['tacos']),
    ('taco', '🌮 Tacos', 'Food & Nightlife', 2, array['tacos']),
    ('seafood', '🦐 Seafood', 'Food & Nightlife', 3, array['dinner']),
    ('steak_house', '🥩 Steakhouse', 'Food & Nightlife', 4, array['dinner']),
    ('italian', '🍝 Italian', 'Food & Nightlife', 5, array['dinner']),
    ('pizza', '🍕 Pizza', 'Food & Nightlife', 6, array['pizza']),
    ('japanese', '🍱 Japanese', 'Food & Nightlife', 7, array['sushi']),
    ('sushi', '🍣 Sushi', 'Food & Nightlife', 8, array['sushi']),
    ('ramen', '🍜 Ramen', 'Food & Nightlife', 9, array['noodles']),
    ('chinese', '🥡 Chinese', 'Food & Nightlife', 10, array['dinner']),
    ('thai', '🌶️ Thai', 'Food & Nightlife', 11, array['dinner']),
    ('korean', '🍲 Korean', 'Food & Nightlife', 12, array['dinner']),
    ('vietnamese', '🍜 Vietnamese', 'Food & Nightlife', 13, array['dinner']),
    ('indian', '🍛 Indian', 'Food & Nightlife', 14, array['dinner']),
    ('middle_eastern', '🧆 Middle Eastern', 'Food & Nightlife', 15, array['dinner']),
    ('mediterranean', '🫒 Mediterranean', 'Food & Nightlife', 16, array['dinner']),
    ('greek', '🥙 Greek', 'Food & Nightlife', 17, array['dinner']),
    ('spanish', '🥘 Spanish', 'Food & Nightlife', 18, array['dinner']),
    ('french', '🥐 French', 'Food & Nightlife', 19, array['dinner']),
    ('american', '🍟 American', 'Food & Nightlife', 20, array['dinner']),
    ('argentinian', '🥩 Argentinian', 'Food & Nightlife', 21, array['dinner']),
    ('brazilian', '🍖 Brazilian', 'Food & Nightlife', 22, array['dinner']),
    ('peruvian', '🐟 Peruvian', 'Food & Nightlife', 23, array['dinner']),
    ('asian_fusion', '🥢 Asian Fusion', 'Food & Nightlife', 24, array['dinner']),
    ('burger', '🍔 Burgers', 'Food & Nightlife', 25, array['burgers']),
    ('sandwich', '🥪 Sandwiches', 'Food & Nightlife', 26, array['quick_bite']),
    ('bbq', '🍖 BBQ', 'Food & Nightlife', 27, array['dinner']),
    ('breakfast', '🍳 Breakfast', 'Food & Nightlife', 28, array['breakfast']),
    ('brunch', '🥞 Brunch', 'Food & Nightlife', 29, array['breakfast']),
    ('vegan', '🌱 Vegan', 'Food & Nightlife', 30, array['dinner']),
    ('vegetarian', '🥬 Vegetarian', 'Food & Nightlife', 31, array['dinner']),
    ('salad', '🥗 Salads', 'Food & Nightlife', 33, array['quick_bite']),
    ('fast_food', '🍟 Fast Food', 'Food & Nightlife', 34, array['quick_bite']),
    ('fine_dining', '🍽️ Fine Dining', 'Food & Nightlife', 35, array['dinner']),
    ('food_truck', '🚚 Food Truck', 'Food & Nightlife', 36, array['quick_bite']),
    ('food_hall', '🍜 Food Hall', 'Food & Nightlife', 37, array['quick_bite']),
    ('deli', '🥓 Deli', 'Food & Nightlife', 38, array['quick_bite']),
    ('cafe', '☕ Café', 'Food & Nightlife', 39, array['coffee', 'breakfast']),
    ('coffee_shop', '☕ Coffee Shop', 'Food & Nightlife', 40, array['coffee', 'breakfast']),
    ('bakery', '🥐 Bakery', 'Food & Nightlife', 41, array['sweet', 'breakfast']),
    ('dessert_shop', '🍰 Desserts', 'Food & Nightlife', 42, array['sweet']),
    ('ice_cream', '🍦 Ice Cream', 'Food & Nightlife', 43, array['sweet']),
    ('juice_bar', '🧃 Juice Bar', 'Food & Nightlife', 44, array['coffee']),
    ('bar', '🍺 Bar', 'Food & Nightlife', 45, array['drinks']),
    ('pub', '🍺 Pub', 'Food & Nightlife', 46, array['drinks']),
    ('cocktail_bar', '🍸 Cocktail Bar', 'Food & Nightlife', 47, array['drinks']),
    ('wine_bar', '🍷 Wine Bar', 'Food & Nightlife', 48, array['drinks']),
    ('brewery', '🍻 Brewery', 'Food & Nightlife', 49, array['drinks']),
    ('night_club', '🪩 Nightclub', 'Food & Nightlife', 50, array['night_out']),
    ('bowling_alley', '🎳 Bowling', 'Experiences & Wellness', 51, array['undefined']),
    ('karaoke', '🎤 Karaoke', 'Experiences & Wellness', 52, array['night_out', 'go_out']),
    ('escape_room', '🗝️ Escape Room', 'Experiences & Wellness', 53, array['go_out']),
    ('arcade', '🕹️ Arcade', 'Experiences & Wellness', 54, array['undefined']),
    ('billiards', '🎱 Billiards', 'Experiences & Wellness', 55, array['go_out']),
    ('board_game_cafe', '🎲 Board Game Café', 'Experiences & Wellness', 56, array['coffee', 'go_out']),
    ('park', '🌳 Park', 'Experiences & Wellness', 57, array['undefined']),
    ('mini_golf', '⛳ Mini Golf', 'Experiences & Wellness', 58, array['undefined']),
    ('laser_tag', '🔫 Laser Tag', 'Experiences & Wellness', 59, array['undefined']),
    ('axe_throwing', '🪓 Axe Throwing', 'Experiences & Wellness', 60, array['undefined']),
    ('trampoline_park', '🤸 Trampoline Park', 'Experiences & Wellness', 61, array['undefined']),
    ('go_kart', '🏎️ Go-Karts', 'Experiences & Wellness', 62, array['undefined']),
    ('movie_theater', '🎬 Movie Theater', 'Experiences & Wellness', 63, array['undefined']),
    ('amusement_park', '🎡 Amusement Park', 'Experiences & Wellness', 64, array['undefined']),
    ('water_park', '🌊 Water Park', 'Experiences & Wellness', 65, array['undefined']),
    ('casino', '🎰 Casino', 'Experiences & Wellness', 66, array['undefined']),
    ('gym', '💪 Gym', 'Experiences & Wellness', 67, array['undefined']),
    ('yoga_studio', '🧘 Yoga Studio', 'Experiences & Wellness', 68, array['undefined']),
    ('pilates_studio', '🧘 Pilates Studio', 'Experiences & Wellness', 69, array['undefined']),
    ('crossfit_box', '🏋️ CrossFit', 'Experiences & Wellness', 70, array['undefined']),
    ('climbing_gym', '🧗 Climbing Gym', 'Experiences & Wellness', 71, array['undefined']),
    ('padel_club', '🎾 Padel Club', 'Experiences & Wellness', 72, array['undefined']),
    ('tennis_club', '🎾 Tennis Club', 'Experiences & Wellness', 73, array['undefined']),
    ('golf_course', '⛳ Golf Course', 'Experiences & Wellness', 74, array['undefined']),
    ('soccer_field', '⚽ Soccer Field', 'Experiences & Wellness', 75, array['undefined']),
    ('swimming_pool', '🏊 Swimming Pool', 'Experiences & Wellness', 76, array['undefined']),
    ('dance_studio', '💃 Dance Studio', 'Experiences & Wellness', 77, array['undefined']),
    ('martial_arts', '🥋 Martial Arts', 'Experiences & Wellness', 78, array['undefined']),
    ('spa', '💆 Spa', 'Experiences & Wellness', 79, array['undefined']),
    ('temazcal', '🔥 Temazcal', 'Experiences & Wellness', 80, array['undefined']),
    ('hot_springs', '♨️ Hot Springs', 'Experiences & Wellness', 81, array['undefined']),
    ('massage', '💆 Massage', 'Experiences & Wellness', 82, array['undefined']),
    ('sauna', '🧖 Sauna', 'Experiences & Wellness', 83, array['undefined']),
    ('barbershop', '💈 Barbershop', 'Experiences & Wellness', 84, array['undefined']),
    ('hair_salon', '💇 Hair Salon', 'Experiences & Wellness', 85, array['undefined']),
    ('nail_salon', '💅 Nail Salon', 'Experiences & Wellness', 86, array['undefined']),
    ('beauty_salon', '💄 Beauty Salon', 'Experiences & Wellness', 87, array['undefined']),
    ('wellness_center', '🌿 Wellness Center', 'Experiences & Wellness', 88, array['undefined']),
    ('tattoo_studio', '🖋️ Tattoo Studio', 'Experiences & Wellness', 89, array['undefined']),
    ('medical_spa', '💉 Medical Spa', 'Experiences & Wellness', 90, array['undefined']),
    ('museum', '🏛️ Museum', 'Experiences & Wellness', 91, array['undefined']),
    ('art_gallery', '🖼️ Art Gallery', 'Experiences & Wellness', 92, array['undefined']),
    ('aquarium', '🐠 Aquarium', 'Experiences & Wellness', 93, array['undefined']),
    ('zoo', '🦁 Zoo', 'Experiences & Wellness', 94, array['undefined']),
    ('observation_deck', '🌆 Observation Deck', 'Experiences & Wellness', 95, array['undefined']),
    ('winery', '🍷 Winery', 'Experiences & Wellness', 96, array['drinks']),
    ('theater', '🎭 Theater', 'Experiences & Wellness', 97, array['undefined']),
    ('concert_venue', '🎸 Concert Venue', 'Experiences & Wellness', 98, array['undefined']),
    ('botanical_garden', '🌷 Botanical Garden', 'Experiences & Wellness', 99, array['undefined']),
    ('cultural_center', '🎟️ Cultural Center', 'Experiences & Wellness', 100, array['undefined']),
    ('market', '🛒 Market', 'Experiences & Wellness', 101, array['undefined']),
    ('undefined', '❓ Undefined', 'Food & Nightlife', 999, array['undefined'])
  on conflict (slug) do update set
    label       = excluded.label,
    section     = excluded.section,
    sort_order  = excluded.sort_order,
    family_keys = case
      when cardinality(public.place_categories.family_keys) > 0
       and public.atlas_family_slugs_valid(public.place_categories.family_keys)
        then public.place_categories.family_keys
      else excluded.family_keys
    end;
end;
$$;
