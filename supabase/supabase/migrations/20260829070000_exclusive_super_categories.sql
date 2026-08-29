-- Exclusive Super Category partition: each Mesita category maps to exactly
-- one Super; each Google Table A type maps to exactly one Super (or `other`).
-- Tightens atlas_super_slugs_valid to cardinality ≤ 1 and reseeds membership.


-- Data first so existing 2-slug rows clear before the CHECK tightens.
update public.place_categories
   set super_category_slugs = array['restaurants']
 where slug in ('breakfast','brunch');

update public.place_categories
   set super_category_slugs = array['bars_nightlife']
 where slug in ('karaoke','winery');

update public.place_categories
   set super_category_slugs = array['experiences']
 where slug = 'casino';

update public.place_categories
   set super_category_slugs = array['cafes_bakeries']
 where slug = 'board_game_cafe';

update public.place_categories
   set super_category_slugs = array['culture_arts']
 where slug = 'movie_theater';

update public.places p
   set family_keys = nullif(c.super_category_slugs, '{}'::text[])
  from public.place_categories c
 where p.category = c.slug;

update public.places
   set family_keys = family_keys[1:1]
 where family_keys is not null
   and cardinality(family_keys) > 1;

create or replace function public.atlas_super_slugs_valid(slugs text[])
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    slugs is not null
    and cardinality(slugs) <= 1
    and (select count(distinct x) from unnest(slugs) as x) = cardinality(slugs)
    and not exists (
      select 1
      from unnest(slugs) as s
      where not exists (
        select 1 from public.place_super_categories p
        where p.slug = s
      )
    );
$$;

comment on function public.atlas_super_slugs_valid(text[]) is
  'Atlas Super Category arrays: 0–1 unique slugs, each in place_super_categories.';

comment on table public.place_super_categories is
  'Atlas Super Category vocabulary (5–10). Super Categories partition Mesita Categories. Vocabulary. Client roles: SELECT only.';

comment on column public.place_categories.super_category_slugs is
  '0–1 Atlas Super Category slugs. Empty = belongs to none. Partition: never two.';

comment on column public.places.family_keys is
  'Inferred Super Category (0–1). NULL / empty = undefined until contents enrichment.';

create or replace function public.seed_place_categories()
returns void
language plpgsql
set search_path = ''
as $function$
begin
  insert into public.place_categories (slug, label, section, sort_order) values
    ('mexican', '🌮 Mexican', 'Food & Nightlife', 1),
    ('taco', '🌮 Tacos', 'Food & Nightlife', 2),
    ('seafood', '🦐 Seafood', 'Food & Nightlife', 3),
    ('steak_house', '🥩 Steakhouse', 'Food & Nightlife', 4),
    ('italian', '🍝 Italian', 'Food & Nightlife', 5),
    ('pizza', '🍕 Pizza', 'Food & Nightlife', 6),
    ('japanese', '🍱 Japanese', 'Food & Nightlife', 7),
    ('sushi', '🍣 Sushi', 'Food & Nightlife', 8),
    ('ramen', '🍜 Ramen', 'Food & Nightlife', 9),
    ('chinese', '🥡 Chinese', 'Food & Nightlife', 10),
    ('thai', '🌶️ Thai', 'Food & Nightlife', 11),
    ('korean', '🍲 Korean', 'Food & Nightlife', 12),
    ('vietnamese', '🍜 Vietnamese', 'Food & Nightlife', 13),
    ('indian', '🍛 Indian', 'Food & Nightlife', 14),
    ('middle_eastern', '🧆 Middle Eastern', 'Food & Nightlife', 15),
    ('mediterranean', '🫒 Mediterranean', 'Food & Nightlife', 16),
    ('greek', '🥙 Greek', 'Food & Nightlife', 17),
    ('spanish', '🥘 Spanish', 'Food & Nightlife', 18),
    ('french', '🥐 French', 'Food & Nightlife', 19),
    ('american', '🍟 American', 'Food & Nightlife', 20),
    ('argentinian', '🥩 Argentinian', 'Food & Nightlife', 21),
    ('brazilian', '🍖 Brazilian', 'Food & Nightlife', 22),
    ('peruvian', '🐟 Peruvian', 'Food & Nightlife', 23),
    ('asian_fusion', '🥢 Asian Fusion', 'Food & Nightlife', 24),
    ('burger', '🍔 Burgers', 'Food & Nightlife', 25),
    ('sandwich', '🥪 Sandwiches', 'Food & Nightlife', 26),
    ('bbq', '🍖 BBQ', 'Food & Nightlife', 27),
    ('breakfast', '🍳 Breakfast', 'Food & Nightlife', 28),
    ('brunch', '🥞 Brunch', 'Food & Nightlife', 29),
    ('vegan', '🌱 Vegan', 'Food & Nightlife', 30),
    ('vegetarian', '🥬 Vegetarian', 'Food & Nightlife', 31),
    ('salad', '🥗 Salads', 'Food & Nightlife', 33),
    ('fast_food', '🍟 Fast Food', 'Food & Nightlife', 34),
    ('fine_dining', '🍽️ Fine Dining', 'Food & Nightlife', 35),
    ('food_truck', '🚚 Food Truck', 'Food & Nightlife', 36),
    ('food_hall', '🍜 Food Hall', 'Food & Nightlife', 37),
    ('deli', '🥓 Deli', 'Food & Nightlife', 38),
    ('cafe', '☕ Café', 'Food & Nightlife', 39),
    ('coffee_shop', '☕ Coffee Shop', 'Food & Nightlife', 40),
    ('bakery', '🥐 Bakery', 'Food & Nightlife', 41),
    ('dessert_shop', '🍰 Desserts', 'Food & Nightlife', 42),
    ('ice_cream', '🍦 Ice Cream', 'Food & Nightlife', 43),
    ('juice_bar', '🧃 Juice Bar', 'Food & Nightlife', 44),
    ('bar', '🍺 Bar', 'Food & Nightlife', 45),
    ('pub', '🍺 Pub', 'Food & Nightlife', 46),
    ('cocktail_bar', '🍸 Cocktail Bar', 'Food & Nightlife', 47),
    ('wine_bar', '🍷 Wine Bar', 'Food & Nightlife', 48),
    ('brewery', '🍻 Brewery', 'Food & Nightlife', 49),
    ('night_club', '🪩 Nightclub', 'Food & Nightlife', 50),
    ('bowling_alley', '🎳 Bowling', 'Experiences & Wellness', 51),
    ('karaoke', '🎤 Karaoke', 'Experiences & Wellness', 52),
    ('escape_room', '🗝️ Escape Room', 'Experiences & Wellness', 53),
    ('arcade', '🕹️ Arcade', 'Experiences & Wellness', 54),
    ('billiards', '🎱 Billiards', 'Experiences & Wellness', 55),
    ('board_game_cafe', '🎲 Board Game Café', 'Experiences & Wellness', 56),
    ('park', '🌳 Park', 'Experiences & Wellness', 57),
    ('mini_golf', '⛳ Mini Golf', 'Experiences & Wellness', 58),
    ('laser_tag', '🔫 Laser Tag', 'Experiences & Wellness', 59),
    ('axe_throwing', '🪓 Axe Throwing', 'Experiences & Wellness', 60),
    ('trampoline_park', '🤸 Trampoline Park', 'Experiences & Wellness', 61),
    ('go_kart', '🏎️ Go-Karts', 'Experiences & Wellness', 62),
    ('movie_theater', '🎬 Movie Theater', 'Experiences & Wellness', 63),
    ('amusement_park', '🎡 Amusement Park', 'Experiences & Wellness', 64),
    ('water_park', '🌊 Water Park', 'Experiences & Wellness', 65),
    ('casino', '🎰 Casino', 'Experiences & Wellness', 66),
    ('gym', '💪 Gym', 'Experiences & Wellness', 67),
    ('yoga_studio', '🧘 Yoga Studio', 'Experiences & Wellness', 68),
    ('pilates_studio', '🧘 Pilates Studio', 'Experiences & Wellness', 69),
    ('crossfit_box', '🏋️ CrossFit', 'Experiences & Wellness', 70),
    ('climbing_gym', '🧗 Climbing Gym', 'Experiences & Wellness', 71),
    ('padel_club', '🎾 Padel Club', 'Experiences & Wellness', 72),
    ('tennis_club', '🎾 Tennis Club', 'Experiences & Wellness', 73),
    ('golf_course', '⛳ Golf Course', 'Experiences & Wellness', 74),
    ('soccer_field', '⚽ Soccer Field', 'Experiences & Wellness', 75),
    ('swimming_pool', '🏊 Swimming Pool', 'Experiences & Wellness', 76),
    ('dance_studio', '💃 Dance Studio', 'Experiences & Wellness', 77),
    ('martial_arts', '🥋 Martial Arts', 'Experiences & Wellness', 78),
    ('spa', '💆 Spa', 'Experiences & Wellness', 79),
    ('temazcal', '🔥 Temazcal', 'Experiences & Wellness', 80),
    ('hot_springs', '♨️ Hot Springs', 'Experiences & Wellness', 81),
    ('massage', '💆 Massage', 'Experiences & Wellness', 82),
    ('sauna', '🧖 Sauna', 'Experiences & Wellness', 83),
    ('barbershop', '💈 Barbershop', 'Experiences & Wellness', 84),
    ('hair_salon', '💇 Hair Salon', 'Experiences & Wellness', 85),
    ('nail_salon', '💅 Nail Salon', 'Experiences & Wellness', 86),
    ('beauty_salon', '💄 Beauty Salon', 'Experiences & Wellness', 87),
    ('wellness_center', '🌿 Wellness Center', 'Experiences & Wellness', 88),
    ('tattoo_studio', '🖋️ Tattoo Studio', 'Experiences & Wellness', 89),
    ('medical_spa', '💉 Medical Spa', 'Experiences & Wellness', 90),
    ('museum', '🏛️ Museum', 'Experiences & Wellness', 91),
    ('art_gallery', '🖼️ Art Gallery', 'Experiences & Wellness', 92),
    ('aquarium', '🐠 Aquarium', 'Experiences & Wellness', 93),
    ('zoo', '🦁 Zoo', 'Experiences & Wellness', 94),
    ('observation_deck', '🌆 Observation Deck', 'Experiences & Wellness', 95),
    ('winery', '🍷 Winery', 'Experiences & Wellness', 96),
    ('theater', '🎭 Theater', 'Experiences & Wellness', 97),
    ('concert_venue', '🎸 Concert Venue', 'Experiences & Wellness', 98),
    ('botanical_garden', '🌷 Botanical Garden', 'Experiences & Wellness', 99),
    ('cultural_center', '🎟️ Cultural Center', 'Experiences & Wellness', 100),
    ('market', '🛒 Market', 'Experiences & Wellness', 101)
  on conflict (slug) do update set
    label      = excluded.label,
    section    = excluded.section,
    sort_order = excluded.sort_order;

  update public.place_categories set super_category_slugs = '{}'::text[];

  update public.place_categories set super_category_slugs = array['restaurants']
   where slug in (
     'mexican','taco','seafood','steak_house','italian','pizza','japanese','sushi',
     'ramen','chinese','thai','korean','vietnamese','indian','middle_eastern',
     'mediterranean','greek','spanish','french','american','argentinian','brazilian',
     'peruvian','asian_fusion','burger','sandwich','bbq','breakfast','brunch',
     'vegan','vegetarian','salad','fast_food','fine_dining','food_truck','food_hall','deli'
   );

  update public.place_categories set super_category_slugs = array['cafes_bakeries']
   where slug in ('cafe','coffee_shop','bakery','dessert_shop','ice_cream','juice_bar','board_game_cafe');

  update public.place_categories set super_category_slugs = array['bars_nightlife']
   where slug in ('bar','pub','cocktail_bar','wine_bar','brewery','night_club','karaoke','winery');

  update public.place_categories set super_category_slugs = array['experiences']
   where slug in (
     'bowling_alley','escape_room','arcade','billiards','park','mini_golf','laser_tag',
     'axe_throwing','trampoline_park','go_kart','amusement_park','water_park','aquarium',
     'zoo','observation_deck','botanical_garden','market','casino'
   );

  update public.place_categories set super_category_slugs = array['culture_arts']
   where slug in ('museum','art_gallery','theater','concert_venue','cultural_center','movie_theater');

  update public.place_categories set super_category_slugs = array['wellness_spa']
   where slug in (
     'gym','yoga_studio','pilates_studio','crossfit_box','climbing_gym','padel_club',
     'tennis_club','golf_course','soccer_field','swimming_pool','dance_studio',
     'martial_arts','spa','temazcal','hot_springs','massage','sauna','barbershop',
     'hair_salon','nail_salon','beauty_salon','wellness_center','tattoo_studio',
     'medical_spa'
   );

end;
$function$;

comment on function public.seed_place_categories() is
  'Admin/reset seed for place_categories + exclusive Super Category membership. Service-role only.';

select public.seed_place_categories();
