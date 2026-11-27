-- MESITA-4454 — catalog_rank_lanes: the Organic and Inorganic lanes in one
-- statement, and the seed that adds
-- only absent config keys (E3, DX-n). Six fixture places (M-e): 0 reviews,
-- no stars, a 2X, a 5X, a far 2X, and a family filter. No ad floor since
-- MESITA-5029: every Premier place is in the Inorganic lane.
--
begin;

create extension if not exists pgtap with schema public;

select plan(20);

insert into public.place_profiles
  (id, google_name, family_keys, enrichment_sources, lat, lng, google_stars_overall, google_review_count, business_state) values
  ('00000000-0000-4000-8000-000000445401', 'Lanes A', array['tacos'],  '{}'::jsonb, 25.670, -100.30, 4.5, 1000, 'OPERATIONAL'),
  ('00000000-0000-4000-8000-000000445402', 'Lanes B', array['tacos'],  '{}'::jsonb, 25.671, -100.30, 4.0,    0, 'OPERATIONAL'),
  ('00000000-0000-4000-8000-000000445403', 'Lanes C', array['coffee'], '{}'::jsonb, 25.672, -100.30, null,  50, 'OPERATIONAL'),
  ('00000000-0000-4000-8000-000000445404', 'Lanes D', array['dinner'], '{}'::jsonb, 25.679, -100.30, 4.0,  100, 'OPERATIONAL'),
  ('00000000-0000-4000-8000-000000445405', 'Lanes E', array['dinner'], '{}'::jsonb, 25.688, -100.30, 4.8,  500, 'OPERATIONAL'),
  ('00000000-0000-4000-8000-000000445406', 'Lanes F', array['coffee'], '{}'::jsonb, 26.120, -100.30, 4.6,  300, 'OPERATIONAL');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000445401', 'mesita-4454-a', 'active', 'ready', 'MXN'),
  ('00000000-0000-4000-8000-000000445402', 'mesita-4454-b', 'active', 'ready', 'MXN'),
  ('00000000-0000-4000-8000-000000445403', 'mesita-4454-c', 'active', 'ready', 'MXN'),
  ('00000000-0000-4000-8000-000000445404', 'mesita-4454-d', 'active', 'ready', 'MXN'),
  ('00000000-0000-4000-8000-000000445405', 'mesita-4454-e', 'active', 'ready', 'MXN'),
  ('00000000-0000-4000-8000-000000445406', 'mesita-4454-f', 'active', 'ready', 'MXN');
update public.places set boost_tier = 1
 where id in ('00000000-0000-4000-8000-000000445404', '00000000-0000-4000-8000-000000445406');
update public.places set boost_tier = 2 where id = '00000000-0000-4000-8000-000000445405';
-- The seed's places leave the ranked set, so counts are the fixture's own.
update public.places set content_state = 'generating'
 where id::text not like '00000000-0000-4000-8000-0000004454%';

-- One call shape: the recipe rows above; p_ad_floor 0.2 is sent to prove it is ignored.
create or replace function pg_temp.lanes(p_lat double precision, p_lng double precision, p_families text[])
returns jsonb language sql as $$
  select public.catalog_rank_lanes(
    p_lat => p_lat, p_lng => p_lng,
    p_organic_half_km => 1, p_organic_distance_exp => 2, p_organic_stars_exp => 2, p_organic_google_exp => 0.5, p_organic_premier_exp => 0,
    p_ad_half_km => 1, p_ad_distance_exp => 2, p_ad_stars_exp => 2, p_ad_google_exp => 0.5, p_ad_premier_exp => 1,
    p_premier_1 => 2, p_premier_2 => 5,
    p_families => p_families,
    p_known_families => array['tacos', 'coffee', 'dinner'],
    p_require_active => false,
    p_repeat => 1,
    p_ad_floor => 0.2)
$$;

-- Ids as their fixture letters, in order.
create or replace function pg_temp.letters(p jsonb)
returns text language sql as $$
  select coalesce(string_agg(chr(64 + right(e #>> '{}', 1)::int), '' order by o), '')
    from jsonb_array_elements(p) with ordinality as t(e, o)
$$;

-- ━━━ The function and its door ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- MESITA-5030 appends two defaulted Offers exponents. Named calls that omit
-- them still resolve; the stored signature is the full 25.
select has_function('public', 'catalog_rank_lanes',
  array['double precision', 'double precision', 'double precision', 'double precision', 'double precision',
        'double precision', 'double precision', 'double precision', 'double precision', 'double precision',
        'double precision', 'double precision', 'double precision', 'double precision',
        'text[]', 'text[]', 'boolean', 'double precision', 'double precision',
        'double precision', 'double precision', 'double precision', 'double precision',
        'double precision', 'double precision'],
  'catalog_rank_lanes exists with its one signature');

select ok(
  has_function_privilege('service_role', 'public.catalog_rank_lanes(double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, text[], text[], boolean, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision)', 'execute')
  and not has_function_privilege('anon', 'public.catalog_rank_lanes(double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, text[], text[], boolean, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision)', 'execute')
  and not has_function_privilege('authenticated', 'public.catalog_rank_lanes(double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, text[], text[], boolean, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision)', 'execute'),
  'service role only');

-- ━━━ Both lanes from a point ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(pg_temp.letters(pg_temp.lanes(25.67, -100.30, array[]::text[]) -> 'ids'), 'ADEFBC',
  'Organic: the formula orders A, D, E, F; 0 reviews and no stars score 0 and sort last by distance');

select is(
  pg_temp.letters(public.catalog_rank_lanes(
    p_lat => 25.67, p_lng => -100.30,
    p_organic_half_km => 1, p_organic_distance_exp => 2, p_organic_stars_exp => 2, p_organic_google_exp => 0.5, p_organic_premier_exp => 0,
    p_ad_half_km => 1, p_ad_distance_exp => 2, p_ad_stars_exp => 2, p_ad_google_exp => 0.5, p_ad_premier_exp => 1,
    p_premier_1 => 2, p_premier_2 => 5, p_families => array[]::text[],
    p_known_families => array['tacos', 'coffee', 'dinner'], p_require_active => false,
    p_organic_offers_exp => 1, p_ad_offers_exp => 1) -> 'ids'),
  'ABCDEF',
  'Offers exponent 1 and no offer points scores every place 0, so distance orders them');

select is(pg_temp.letters(pg_temp.lanes(25.67, -100.30, array[]::text[]) -> 'premier'), 'EDF',
  'Inorganic: Premier places only, 5X E above 2X D; far F is last, never cut (MESITA-5029)');

select is((pg_temp.lanes(25.67, -100.30, array[]::text[]) ->> 'below_floor')::int, 0,
  'no ad floor: below_floor is always 0, and p_ad_floor 0.2 is ignored');

select is((pg_temp.lanes(25.67, -100.30, array[]::text[]) ->> 'inorganic_total')::int, 3,
  'inorganic_total counts every gated Premier place');

select is((pg_temp.lanes(25.67, -100.30, array[]::text[]) ->> 'read')::int, 6,
  'read counts the gated places');

-- ━━━ No repeat penalty (MESITA-4463) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Under the old penalty, p_repeat 0.001 dropped D (the 2nd dinner) below F
-- (AEFDBC). The argument is ignored now, so the order is the formula's.
select is(
  pg_temp.letters(public.catalog_rank_lanes(
    p_lat => 25.67, p_lng => -100.30,
    p_organic_half_km => 1, p_organic_distance_exp => 2, p_organic_stars_exp => 2, p_organic_google_exp => 0.5, p_organic_premier_exp => 0,
    p_ad_half_km => 1, p_ad_distance_exp => 2, p_ad_stars_exp => 2, p_ad_google_exp => 0.5, p_ad_premier_exp => 1,
    p_premier_1 => 2, p_premier_2 => 5, p_families => array[]::text[],
    p_known_families => array['tacos', 'coffee', 'dinner'], p_require_active => false,
    p_repeat => 0.001, p_ad_floor => 0.2) -> 'ids'),
  'ADEFBC',
  'p_repeat is ignored: two places of a kind keep the formula order');

select ok(
  (select c.discovery_config #> '{params,variety}' is null from public.app_config c where c.id = 1),
  'params.variety is gone from the live config');

-- ━━━ The family filter ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(pg_temp.letters(pg_temp.lanes(25.67, -100.30, array['coffee']) -> 'ids'), 'FC',
  'a family filter gates both lanes: coffee is F then C');

select is(
  jsonb_build_object(
    'premier', pg_temp.lanes(25.67, -100.30, array['coffee']) -> 'premier',
    'below_floor', pg_temp.lanes(25.67, -100.30, array['coffee']) -> 'below_floor',
    'inorganic_total', pg_temp.lanes(25.67, -100.30, array['coffee']) -> 'inorganic_total',
    'read', pg_temp.lanes(25.67, -100.30, array['coffee']) -> 'read'),
  '{"premier": ["00000000-0000-4000-8000-000000445406"], "below_floor": 0, "inorganic_total": 1, "read": 2}'::jsonb,
  'coffee has one Premier place, far away: still an ad (MESITA-5029)');

-- ━━━ No point: Proximity abstains at 1 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(pg_temp.letters(pg_temp.lanes(null, null, array[]::text[]) -> 'premier'), 'EFD',
  'no point: every Premier place, ordered by Popularity × premierFactor');

select is((pg_temp.lanes(null, null, array[]::text[]) ->> 'below_floor')::int, 0,
  'no point: below_floor is 0');

-- ━━━ The seed: absent keys only ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  (select array_agg(k order by k) from public.app_config c,
          jsonb_object_keys(c.discovery_config #> '{params,recipes}') k where c.id = 1),
  array['catalogFamilyInorganic', 'catalogFamilyOrganic', 'catalogNearbyInorganic', 'catalogNearbyOrganic',
        'catalogPopularInorganic', 'catalogPopularOrganic', 'mapInorganic', 'mapOrganic'],
  'the eight recipe rows are seeded');

select is(
  (select jsonb_build_array(
            c.discovery_config #> '{params,recipes,catalogNearbyOrganic}',
            c.discovery_config #> '{params,recipes,mapInorganic}')
     from public.app_config c where c.id = 1),
  '[{"halfKm": 0.1, "distanceExp": 4, "googleExp": 0.33, "premierExp": 0},
    {"halfKm": null, "distanceExp": null, "googleExp": 0.17, "premierExp": 1}]'::jsonb,
  'recipe rows carry the table values; map rows have no distance numbers');

select is(
  (select c.discovery_config #> '{params,mix}' from public.app_config c where c.id = 1),
  '{"temperature": {"nearby": 0.33, "family": 0.5, "popular": 1}, "adEvery": 1}'::jsonb,
  'params.mix is seeded, and its adFloor is gone (MESITA-5029)');

select ok(
  (select public.jsonb_fill_absent(c.discovery_config, c.discovery_config) = c.discovery_config
          and public.jsonb_fill_absent(c.discovery_config #- '{params,recipes,mapOrganic}', c.discovery_config)
              = c.discovery_config
          and public.jsonb_fill_absent(public.jsonb_fill_absent('{"params": {"x": 1}}'::jsonb, c.discovery_config),
                                       c.discovery_config)
              = public.jsonb_fill_absent('{"params": {"x": 1}}'::jsonb, c.discovery_config)
     from public.app_config c where c.id = 1),
  'the seed fills what is absent and a second run changes nothing');

select is(
  (select jsonb_build_array(f #> '{mix,adEvery}', f #> '{recipes,catalogNearbyOrganic,halfKm}')
     from (select public.jsonb_fill_absent(
                    jsonb_set(jsonb_set(c.discovery_config, '{params,mix,adEvery}', '3'),
                              '{params,recipes,catalogNearbyOrganic,halfKm}', '0.7'),
                    c.discovery_config) #> '{params}' as f
             from public.app_config c where c.id = 1) s),
  '[3, 0.7]'::jsonb,
  'a key that exists keeps its value: the seed never overwrites');

select ok(
  not has_function_privilege('anon', 'public.jsonb_fill_absent(jsonb, jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.jsonb_fill_absent(jsonb, jsonb)', 'execute'),
  'no client role can call the seed helper');

select * from finish();
rollback;
