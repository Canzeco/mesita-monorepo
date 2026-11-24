-- MESITA-4820: the official twenty-five families.
--
-- Pato, 2026-11-23: "write the 25 families, the new official mesita families.
-- and update current instances". Restaurants and Brunch join; Mexican goes;
-- Wings folds into American; `night_out` reads Club. Restaurants is added to
-- every stored list whose main Google category is a restaurant (the same fact
-- `isRestaurantType` reads), so no place empties when Mexican leaves. Brunch
-- and the tightened meanings reach places through admin-web-repick-families.

create or replace function public.seed_place_families()
returns void
language plpgsql
set search_path to ''
as $function$
begin
  update public.place_families set sort_order = sort_order + 1000 where true;
  insert into public.place_families (slug, label, emoji, sort_order) values
    ('restaurants', 'Restaurants', '🍽️', 1),
    ('coffee', 'Coffee', '☕', 2),
    ('drinks', 'Bar', '🍻', 3),
    ('breakfast', 'Breakfast', '🍳', 4),
    ('brunch', 'Brunch', '🥞', 5),
    ('dinner', 'Dinner', '🌙', 6),
    ('quick_bite', 'Quick', '⚡', 7),
    ('tacos', 'Tacos', '🌮', 8),
    ('seafood', 'Seafood', '🦐', 9),
    ('asian', 'Asian', '🍥', 10),
    ('european', 'European', '🥨', 11),
    ('fancy', 'Fancy', '🥂', 12),
    ('steak', 'Steak', '🥩', 13),
    ('japanese', 'Japanese', '🍱', 14),
    ('american', 'American', '🍟', 15),
    ('healthy', 'Healthy', '🥗', 16),
    ('italian', 'Italian', '🍝', 17),
    ('sushi', 'Sushi', '🍣', 18),
    ('pizza', 'Pizza', '🍕', 19),
    ('burgers', 'Burgers', '🍔', 20),
    ('arabic', 'Arabic', '🧆', 21),
    ('sweet', 'Dessert', '🍰', 22),
    ('night_out', 'Club', '🪩', 23),
    ('fun', 'Fun', '🎯', 24),
    ('casino', 'Casino', '🎰', 25),
    ('undefined', 'Undefined', '·', 999)
  on conflict (slug) do update set
    label = excluded.label,
    emoji = excluded.emoji,
    sort_order = excluded.sort_order;
  delete from public.place_families
   where slug not in ('restaurants','coffee','drinks','breakfast','brunch','dinner','quick_bite','tacos','seafood','asian','european','fancy','steak','japanese','american','healthy','italian','sushi','pizza','burgers','arabic','sweet','night_out','fun','casino','undefined');
end;
$function$;

-- The seed runs first so the taxonomy trigger knows the new slugs.
select public.seed_place_families();

update public.place_profiles p
   set family_keys = n.keys
  from (
    select q.id, (
      select (array_agg(f.slug order by f.ord))[1:7]
        from (
          select x.slug, min(x.ord) as ord
            from (
              select 'restaurants' as slug, 0::bigint as ord
               where coalesce(nullif(btrim(q.google_types ->> 0), ''), q.category) = any (array['afghani_restaurant','african_restaurant','american_restaurant','argentinian_restaurant','asian_fusion_restaurant','asian_restaurant','australian_restaurant','austrian_restaurant','bangladeshi_restaurant','barbecue_restaurant','basque_restaurant','bavarian_restaurant','belgian_restaurant','bistro','brazilian_restaurant','breakfast_restaurant','british_restaurant','brunch_restaurant','buffet_restaurant','burmese_restaurant','burrito_restaurant','cajun_restaurant','californian_restaurant','cambodian_restaurant','cantonese_restaurant','caribbean_restaurant','chicken_restaurant','chicken_wings_restaurant','chilean_restaurant','chinese_noodle_restaurant','chinese_restaurant','colombian_restaurant','croatian_restaurant','cuban_restaurant','czech_restaurant','danish_restaurant','deli','dim_sum_restaurant','diner','dumpling_restaurant','dutch_restaurant','eastern_european_restaurant','ethiopian_restaurant','european_restaurant','falafel_restaurant','family_restaurant','fast_food_restaurant','filipino_restaurant','fine_dining_restaurant','fish_and_chips_restaurant','fondue_restaurant','french_restaurant','fusion_restaurant','gastropub','german_restaurant','greek_restaurant','gyro_restaurant','halal_restaurant','hamburger_restaurant','hawaiian_restaurant','hot_dog_restaurant','hot_pot_restaurant','hungarian_restaurant','indian_restaurant','indonesian_restaurant','irish_restaurant','israeli_restaurant','italian_restaurant','japanese_curry_restaurant','japanese_izakaya_restaurant','japanese_restaurant','kebab_shop','korean_barbecue_restaurant','korean_restaurant','latin_american_restaurant','lebanese_restaurant','malaysian_restaurant','mediterranean_restaurant','mexican_restaurant','middle_eastern_restaurant','mongolian_barbecue_restaurant','moroccan_restaurant','noodle_shop','north_indian_restaurant','oyster_bar_restaurant','pakistani_restaurant','persian_restaurant','peruvian_restaurant','pizza_restaurant','polish_restaurant','portuguese_restaurant','ramen_restaurant','restaurant','romanian_restaurant','russian_restaurant','salad_shop','sandwich_shop','scandinavian_restaurant','seafood_restaurant','shawarma_restaurant','snack_bar','soul_food_restaurant','soup_restaurant','south_american_restaurant','south_indian_restaurant','southwestern_us_restaurant','spanish_restaurant','sri_lankan_restaurant','steak_house','sushi_restaurant','swiss_restaurant','taco_restaurant','taiwanese_restaurant','tapas_restaurant','tex_mex_restaurant','thai_restaurant','tibetan_restaurant','tonkatsu_restaurant','turkish_restaurant','ukrainian_restaurant','vegan_restaurant','vegetarian_restaurant','vietnamese_restaurant','western_restaurant','yakiniku_restaurant','yakitori_restaurant','bar_and_grill'])
              union all
              select case k.slug when 'chicken' then 'american' else k.slug end, k.ord
                from unnest(q.family_keys) with ordinality as k(slug, ord)
               where k.slug <> 'mexican'
            ) x
           group by x.slug
        ) f
    ) as keys
    from public.place_profiles q
   where q.family_keys is not null
  ) n
 where n.id = p.id
   and n.keys is distinct from p.family_keys;

-- Postflight.
do $$
declare
  n int;
begin
  select count(*) into n from public.place_families;
  if n <> 26 then
    raise exception 'place_families holds % rows, expected 25 families plus Undefined', n;
  end if;
  select count(*) into n from public.place_profiles
   where family_keys && array['mexican', 'chicken']::text[];
  if n <> 0 then
    raise exception '% places still store Mexican or Wings', n;
  end if;
end;
$$;
