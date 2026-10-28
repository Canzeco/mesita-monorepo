-- MESITA-2891 (parent MESITA-2826): Mesita Families are inferred by the
-- Description step's model, 1–5 of the forty; the Google category ↔ family
-- dictionary dies; every Google category is either enabled on Mesita or not.
--
-- Pato, 2026-10-27: "Now the list of Mesita Families is infered when the
-- description step is ran. Its infered with an LLM, not a dictionary. The max
-- number of families per place is 5, the min number is 1." · "Kill the Google
-- Categories vs Mesita Families matrix bidirectional dictionary from Atlas.
-- Remove it. Delete it." · "Make a list of the Google Categories that are
-- enabled on Mesita. And also make a list of all the Google Categories that
-- are NOT enabled on Mesita."
--
-- This reverses MESITA-2834 (families = the dictionary of the Google
-- categories) and restores MESITA-2827's stored list, now from the forty
-- families of MESITA-2888.

-- ── 1. Every place keeps the families it shows today ──────────────────
-- The dictionary's answer becomes the stored list (at most five, never
-- Undefined), so nothing a guest sees moves until the next Enrich infers.
update public.place_profiles p
   set family_keys = d.keys[1:5]
  from (
    select id, public.families_for_categories(google_types, category) as keys
      from public.place_profiles
  ) d
 where p.id = d.id
   and p.family_keys is null
   and not ('undefined' = any(d.keys))
   and cardinality(d.keys) > 0;

-- ── 2. Enabled on Mesita: a flag per Google category ──────────────────
-- Seeded from the dictionary it replaces: a category in at least one family
-- is enabled, one in none (Undefined) is not. A place whose main Google
-- category is not enabled gets no families (it reads as Undefined), so
-- Discovery keeps it off every guest surface exactly as before.
alter table public.catalog_membership
  add column if not exists enabled boolean not null default false;

update public.catalog_membership
   set enabled = exists (
     select 1 from unnest(family_keys) as k where k <> 'undefined'
   );

comment on column public.catalog_membership.enabled is
  'MESITA-2891: this Google category is enabled on Mesita. Atlas lists the enabled and the not-enabled ones; a place whose main Google category is not enabled gets no families.';
comment on table public.catalog_membership is
  'Google''s canonical category list (Table A). One row per type; `enabled` says whether Mesita serves it (MESITA-2891). The family dictionary it carried is gone.';

-- ── 3. The view reads the stored list ─────────────────────────────────
-- Same signature, so the profiles view and its INSTEAD OF triggers stay.
create or replace function public.place_family_keys(stored text[], google_types jsonb, fallback text)
returns text[]
language sql
stable
set search_path = public
as $$
  select coalesce(nullif(stored, '{}'::text[]), array['undefined']::text[]);
$$;

comment on function public.place_family_keys(text[], jsonb, text) is
  'MESITA-2891: profiles.family_keys = the stored Mesita Families (1–5, inferred by the Description step), else Undefined. The Google categories no longer decide them; the two trailing arguments are kept for the view''s signature.';

comment on column public.place_profiles.family_keys is
  'MESITA-2891: Mesita Families, 1–5 of the forty, inferred by the Description step''s model on Create and every Enrich. Null = Undefined (no families, or a not-enabled main Google category).';

-- ── 4. The dictionary goes ────────────────────────────────────────────
drop function if exists public.families_for_categories(jsonb, text);
drop function if exists public.families_for_category(text);

alter table public.catalog_membership
  drop constraint if exists catalog_membership_keys_valid,
  drop column if exists family_keys;

alter table public.place_categories
  drop constraint if exists place_categories_family_keys_valid,
  drop column if exists family_keys;

-- The seed a Reset replays (admin_reset_database) stops naming the column.
create or replace function public.seed_place_categories()
returns void
language plpgsql
set search_path = ''
as $$
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
    ('market', '🛒 Market', 'Experiences & Wellness', 101),
    ('undefined', '❓ Undefined', 'Food & Nightlife', 999)
  on conflict (slug) do update set
    label      = excluded.label,
    section    = excluded.section,
    sort_order = excluded.sort_order;
end;
$$;

-- ── 5. Postflight ─────────────────────────────────────────────────────
do $postflight$
begin
  if exists (select 1 from pg_proc where proname in ('families_for_categories', 'families_for_category')) then
    raise exception 'the family dictionary survived (MESITA-2891)';
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name in ('catalog_membership', 'place_categories')
       and column_name = 'family_keys'
  ) then
    raise exception 'a dictionary column survived (MESITA-2891)';
  end if;
  if (select count(*) from public.catalog_membership where enabled) = 0 then
    raise exception 'no Google category is enabled (MESITA-2891)';
  end if;
  if pg_get_viewdef('public.profiles'::regclass) not like '%place_family_keys%' then
    raise exception 'profiles.family_keys no longer reads place_family_keys';
  end if;
  perform public.seed_place_categories();
end
$postflight$;
