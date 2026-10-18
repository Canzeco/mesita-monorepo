-- MESITA-2333: Reset database failed on every press.
--
-- admin_reset_database() re-seeds place_families (today's sixteen) and then
-- calls seed_place_categories(), which still assigned the seven families the
-- catalog had before the twenty → fifteen rewrites (restaurants,
-- cafes_bakeries, …). place_categories_family_keys_valid refused the first of
-- those rows, the whole reset rolled back, and the admin button said
-- reset_failed.
--
-- The seed now writes the same 101 categories with the mapping live holds on
-- 2026-10-18. A row that already carries a valid mapping keeps it: the
-- Families page edits that mapping, place_categories survives the reset, and
-- a reset is not a reason to undo the operator's edits.

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
    ('bakery', '🥐 Bakery', 'Food & Nightlife', 41, array['breakfast', 'sweet']),
    ('dessert_shop', '🍰 Desserts', 'Food & Nightlife', 42, array['sweet']),
    ('ice_cream', '🍦 Ice Cream', 'Food & Nightlife', 43, array['sweet']),
    ('juice_bar', '🧃 Juice Bar', 'Food & Nightlife', 44, array['coffee']),
    ('bar', '🍺 Bar', 'Food & Nightlife', 45, array['drinks']),
    ('pub', '🍺 Pub', 'Food & Nightlife', 46, array['drinks']),
    ('cocktail_bar', '🍸 Cocktail Bar', 'Food & Nightlife', 47, array['drinks']),
    ('wine_bar', '🍷 Wine Bar', 'Food & Nightlife', 48, array['drinks']),
    ('brewery', '🍻 Brewery', 'Food & Nightlife', 49, array['drinks']),
    ('night_club', '🪩 Nightclub', 'Food & Nightlife', 50, array['night_out']),
    ('bowling_alley', '🎳 Bowling', 'Experiences & Wellness', 51, array['go_out']),
    ('karaoke', '🎤 Karaoke', 'Experiences & Wellness', 52, array['night_out', 'go_out']),
    ('escape_room', '🗝️ Escape Room', 'Experiences & Wellness', 53, array['go_out']),
    ('arcade', '🕹️ Arcade', 'Experiences & Wellness', 54, array['go_out']),
    ('billiards', '🎱 Billiards', 'Experiences & Wellness', 55, array['go_out']),
    ('board_game_cafe', '🎲 Board Game Café', 'Experiences & Wellness', 56, array['coffee', 'go_out']),
    ('park', '🌳 Park', 'Experiences & Wellness', 57, array['go_out']),
    ('mini_golf', '⛳ Mini Golf', 'Experiences & Wellness', 58, array['go_out']),
    ('laser_tag', '🔫 Laser Tag', 'Experiences & Wellness', 59, array['go_out']),
    ('axe_throwing', '🪓 Axe Throwing', 'Experiences & Wellness', 60, array['go_out']),
    ('trampoline_park', '🤸 Trampoline Park', 'Experiences & Wellness', 61, array['go_out']),
    ('go_kart', '🏎️ Go-Karts', 'Experiences & Wellness', 62, array['go_out']),
    ('movie_theater', '🎬 Movie Theater', 'Experiences & Wellness', 63, array['go_out']),
    ('amusement_park', '🎡 Amusement Park', 'Experiences & Wellness', 64, array['go_out']),
    ('water_park', '🌊 Water Park', 'Experiences & Wellness', 65, array['go_out']),
    ('casino', '🎰 Casino', 'Experiences & Wellness', 66, array['go_out']),
    ('gym', '💪 Gym', 'Experiences & Wellness', 67, array['move']),
    ('yoga_studio', '🧘 Yoga Studio', 'Experiences & Wellness', 68, array['move']),
    ('pilates_studio', '🧘 Pilates Studio', 'Experiences & Wellness', 69, array['move']),
    ('crossfit_box', '🏋️ CrossFit', 'Experiences & Wellness', 70, array['move']),
    ('climbing_gym', '🧗 Climbing Gym', 'Experiences & Wellness', 71, array['move']),
    ('padel_club', '🎾 Padel Club', 'Experiences & Wellness', 72, array['move']),
    ('tennis_club', '🎾 Tennis Club', 'Experiences & Wellness', 73, array['move']),
    ('golf_course', '⛳ Golf Course', 'Experiences & Wellness', 74, array['move']),
    ('soccer_field', '⚽ Soccer Field', 'Experiences & Wellness', 75, array['move']),
    ('swimming_pool', '🏊 Swimming Pool', 'Experiences & Wellness', 76, array['move']),
    ('dance_studio', '💃 Dance Studio', 'Experiences & Wellness', 77, array['move']),
    ('martial_arts', '🥋 Martial Arts', 'Experiences & Wellness', 78, array['move']),
    ('spa', '💆 Spa', 'Experiences & Wellness', 79, array['feel_better']),
    ('temazcal', '🔥 Temazcal', 'Experiences & Wellness', 80, array['feel_better']),
    ('hot_springs', '♨️ Hot Springs', 'Experiences & Wellness', 81, array['feel_better']),
    ('massage', '💆 Massage', 'Experiences & Wellness', 82, array['feel_better']),
    ('sauna', '🧖 Sauna', 'Experiences & Wellness', 83, array['feel_better']),
    ('barbershop', '💈 Barbershop', 'Experiences & Wellness', 84, array['feel_better']),
    ('hair_salon', '💇 Hair Salon', 'Experiences & Wellness', 85, array['feel_better']),
    ('nail_salon', '💅 Nail Salon', 'Experiences & Wellness', 86, array['feel_better']),
    ('beauty_salon', '💄 Beauty Salon', 'Experiences & Wellness', 87, array['feel_better']),
    ('wellness_center', '🌿 Wellness Center', 'Experiences & Wellness', 88, array['feel_better']),
    ('tattoo_studio', '🖋️ Tattoo Studio', 'Experiences & Wellness', 89, array['feel_better']),
    ('medical_spa', '💉 Medical Spa', 'Experiences & Wellness', 90, array['feel_better']),
    ('museum', '🏛️ Museum', 'Experiences & Wellness', 91, array['go_out']),
    ('art_gallery', '🖼️ Art Gallery', 'Experiences & Wellness', 92, array['go_out']),
    ('aquarium', '🐠 Aquarium', 'Experiences & Wellness', 93, array['go_out']),
    ('zoo', '🦁 Zoo', 'Experiences & Wellness', 94, array['go_out']),
    ('observation_deck', '🌆 Observation Deck', 'Experiences & Wellness', 95, array['go_out']),
    ('winery', '🍷 Winery', 'Experiences & Wellness', 96, array['drinks']),
    ('theater', '🎭 Theater', 'Experiences & Wellness', 97, array['go_out']),
    ('concert_venue', '🎸 Concert Venue', 'Experiences & Wellness', 98, array['night_out']),
    ('botanical_garden', '🌷 Botanical Garden', 'Experiences & Wellness', 99, array['go_out']),
    ('cultural_center', '🎟️ Cultural Center', 'Experiences & Wellness', 100, array['go_out']),
    ('market', '🛒 Market', 'Experiences & Wellness', 101, array['go_out']),
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
