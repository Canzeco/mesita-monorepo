-- MESITA-4514 — Fast Update snapshots and the review-growth term inside
-- Popularity. Cold-start order stays in catalog_rank_lanes.test.sql.
begin;

create extension if not exists pgtap with schema public;

select plan(25);

-- Other ready places would join these cohorts. This file's places only.
update public.places set content_state = 'generating'
 where id::text not like '00000000-0000-4000-8000-0000004514%';

insert into public.place_profiles
  (id, google_name, google_place_id, city, family_keys, enrichment_sources, lat, lng,
   google_stars_overall, google_review_count, business_state)
values
  ('00000000-0000-4000-8000-000000451401', 'Flat',    'g-401', 'Edgeville', array['tacos'],    '{}'::jsonb, 25.70, -100.30, 4.0,  10, 'OPERATIONAL'),
  ('00000000-0000-4000-8000-000000451402', 'Down',    'g-402', 'Edgeville', array['tacos'],    '{}'::jsonb, 25.71, -100.30, 4.0,  10, 'OPERATIONAL'),
  ('00000000-0000-4000-8000-000000451403', 'Moved',   'g-403', 'Edgeville', array['tacos'],    '{}'::jsonb, 25.72, -100.30, 4.0,  10, 'OPERATIONAL'),
  ('00000000-0000-4000-8000-000000451404', 'Stale',   'g-404', 'Edgeville', array['tacos'],    '{}'::jsonb, 25.73, -100.30, 4.0,  10, 'OPERATIONAL'),
  ('00000000-0000-4000-8000-000000451405', 'Short',   'g-405', 'Edgeville', array['tacos'],    '{}'::jsonb, 25.74, -100.30, 4.0,  10, 'OPERATIONAL'),
  ('00000000-0000-4000-8000-000000451406', 'P1',      'g-406', 'Growthville', array['tacos'],    '{}'::jsonb, 25.75, -100.30, 5.0,  20, 'OPERATIONAL'),
  ('00000000-0000-4000-8000-000000451407', 'P2',      'g-407', 'Growthville', array['tacos'],    '{}'::jsonb, 25.76, -100.30, 5.0,  40, 'OPERATIONAL'),
  ('00000000-0000-4000-8000-000000451408', 'P3',      'g-408', 'Growthville', array['tacos'],    '{}'::jsonb, 25.77, -100.30, 5.0,  60, 'OPERATIONAL'),
  ('00000000-0000-4000-8000-000000451409', 'P4',      'g-409', 'Growthville', array['tacos'],    '{}'::jsonb, 25.78, -100.30, 5.0,  80, 'OPERATIONAL'),
  ('00000000-0000-4000-8000-000000451410', 'P5',      'g-410', 'Growthville', array['tacos'],    '{}'::jsonb, 25.79, -100.30, 5.0, 100, 'OPERATIONAL'),
  ('00000000-0000-4000-8000-000000451411', 'P6',      'g-411', 'Growthville', array['tacos'],    '{}'::jsonb, 25.80, -100.30, 5.0, 120, 'OPERATIONAL'),
  ('00000000-0000-4000-8000-000000451412', 'P7',      'g-412', 'Growthville', array['tacos'],    '{}'::jsonb, 25.81, -100.30, 5.0, 140, 'OPERATIONAL'),
  ('00000000-0000-4000-8000-000000451413', 'P8',      'g-413', 'Growthville', array['tacos'],    '{}'::jsonb, 25.82, -100.30, 5.0, 160, 'OPERATIONAL'),
  ('00000000-0000-4000-8000-000000451414', 'Coffee',  'g-414', 'Growthville', array['coffee'],   '{}'::jsonb, 25.83, -100.30, 5.0,  10, 'OPERATIONAL'),
  ('00000000-0000-4000-8000-000000451415', 'L1',      'g-415', 'Lonely',      array['sweet'],   '{}'::jsonb, 25.84, -100.30, 4.0,  10, 'OPERATIONAL'),
  ('00000000-0000-4000-8000-000000451416', 'L2',      'g-416', 'Lonely',      array['sweet'],   '{}'::jsonb, 25.85, -100.30, 4.0,  10, 'OPERATIONAL'),
  ('00000000-0000-4000-8000-000000451417', 'L3',      'g-417', 'Lonely',      array['sweet'],   '{}'::jsonb, 25.86, -100.30, 4.0,  10, 'OPERATIONAL'),
  ('00000000-0000-4000-8000-000000451418', 'Hero',    'g-418', 'Rankton',     array['dinner'],'{}'::jsonb, 25.50, -100.31, 4.0, 100, 'OPERATIONAL'),
  ('00000000-0000-4000-8000-000000451419', 'Peer1',   'g-419', 'Rankton',     array['dinner'],'{}'::jsonb, 25.51, -100.31, 5.0, 200, 'OPERATIONAL'),
  ('00000000-0000-4000-8000-000000451420', 'Peer2',   'g-420', 'Rankton',     array['dinner'],'{}'::jsonb, 25.52, -100.31, 5.0, 200, 'OPERATIONAL'),
  ('00000000-0000-4000-8000-000000451421', 'Peer3',   'g-421', 'Rankton',     array['dinner'],'{}'::jsonb, 25.53, -100.31, 5.0, 200, 'OPERATIONAL'),
  ('00000000-0000-4000-8000-000000451422', 'Peer4',   'g-422', 'Rankton',     array['dinner'],'{}'::jsonb, 25.54, -100.31, 5.0, 200, 'OPERATIONAL'),
  ('00000000-0000-4000-8000-000000451423', 'Peer5',   'g-423', 'Rankton',     array['dinner'],'{}'::jsonb, 25.55, -100.31, 5.0, 200, 'OPERATIONAL'),
  ('00000000-0000-4000-8000-000000451424', 'Peer6',   'g-424', 'Rankton',     array['dinner'],'{}'::jsonb, 25.56, -100.31, 5.0, 200, 'OPERATIONAL'),
  ('00000000-0000-4000-8000-000000451425', 'Peer7',   'g-425', 'Rankton',     array['dinner'],'{}'::jsonb, 25.57, -100.31, 5.0, 200, 'OPERATIONAL'),
  ('00000000-0000-4000-8000-000000451426', 'Cold',    'g-426', 'Rankton',     array['dinner'],'{}'::jsonb, 25.50, -100.31, 4.0, 100, 'OPERATIONAL');

insert into public.places (id, slug, state, content_state, currency)
select id, 'mesita-4514-' || right(id::text, 2), 'active', 'ready', 'MXN'
  from public.place_profiles
 where id::text like '00000000-0000-4000-8000-0000004514%';

-- 30 days, 6 days, and two stamps older than the 90-day window.
insert into public.google_review_observations (place_id, google_place_id, observed_at, review_count, stars) values
  ('00000000-0000-4000-8000-000000451401', 'g-401', timestamptz '2026-10-22 00:00:00+00', 10, 4),
  ('00000000-0000-4000-8000-000000451401', 'g-401', timestamptz '2026-11-21 00:00:00+00', 10, 4),
  ('00000000-0000-4000-8000-000000451402', 'g-402', timestamptz '2026-10-22 00:00:00+00', 20, 4),
  ('00000000-0000-4000-8000-000000451402', 'g-402', timestamptz '2026-11-21 00:00:00+00', 10, 4),
  ('00000000-0000-4000-8000-000000451403', 'old-403', timestamptz '2026-10-22 00:00:00+00', 1, 4),
  ('00000000-0000-4000-8000-000000451403', 'old-403', timestamptz '2026-11-21 00:00:00+00', 9, 4),
  ('00000000-0000-4000-8000-000000451404', 'g-404', timestamptz '2026-08-13 00:00:00+00', 1, 4),
  ('00000000-0000-4000-8000-000000451404', 'g-404', timestamptz '2026-08-18 00:00:00+00', 9, 4),
  ('00000000-0000-4000-8000-000000451405', 'g-405', timestamptz '2026-11-15 00:00:00+00', 0, 4),
  ('00000000-0000-4000-8000-000000451405', 'g-405', timestamptz '2026-11-21 00:00:00+00', 2, 4),
  ('00000000-0000-4000-8000-000000451406', 'g-406', timestamptz '2026-10-22 00:00:00+00', 10, 5),
  ('00000000-0000-4000-8000-000000451406', 'g-406', timestamptz '2026-11-21 00:00:00+00', 20, 5),
  ('00000000-0000-4000-8000-000000451407', 'g-407', timestamptz '2026-10-22 00:00:00+00', 20, 5),
  ('00000000-0000-4000-8000-000000451407', 'g-407', timestamptz '2026-11-21 00:00:00+00', 40, 5),
  ('00000000-0000-4000-8000-000000451408', 'g-408', timestamptz '2026-10-22 00:00:00+00', 30, 5),
  ('00000000-0000-4000-8000-000000451408', 'g-408', timestamptz '2026-11-21 00:00:00+00', 60, 5),
  ('00000000-0000-4000-8000-000000451409', 'g-409', timestamptz '2026-10-22 00:00:00+00', 50, 5),
  ('00000000-0000-4000-8000-000000451409', 'g-409', timestamptz '2026-11-21 00:00:00+00', 80, 5),
  ('00000000-0000-4000-8000-000000451410', 'g-410', timestamptz '2026-10-22 00:00:00+00', 60, 5),
  ('00000000-0000-4000-8000-000000451410', 'g-410', timestamptz '2026-11-21 00:00:00+00', 100, 5),
  ('00000000-0000-4000-8000-000000451411', 'g-411', timestamptz '2026-10-22 00:00:00+00', 70, 5),
  ('00000000-0000-4000-8000-000000451411', 'g-411', timestamptz '2026-11-21 00:00:00+00', 120, 5),
  ('00000000-0000-4000-8000-000000451412', 'g-412', timestamptz '2026-10-22 00:00:00+00', 80, 5),
  ('00000000-0000-4000-8000-000000451412', 'g-412', timestamptz '2026-11-21 00:00:00+00', 140, 5),
  ('00000000-0000-4000-8000-000000451413', 'g-413', timestamptz '2026-10-22 00:00:00+00', 90, 5),
  ('00000000-0000-4000-8000-000000451413', 'g-413', timestamptz '2026-11-21 00:00:00+00', 160, 5),
  ('00000000-0000-4000-8000-000000451414', 'g-414', timestamptz '2026-10-22 00:00:00+00', 0, 5),
  ('00000000-0000-4000-8000-000000451414', 'g-414', timestamptz '2026-11-21 00:00:00+00', 80, 5),
  ('00000000-0000-4000-8000-000000451415', 'g-415', timestamptz '2026-10-22 00:00:00+00', 5, 4),
  ('00000000-0000-4000-8000-000000451415', 'g-415', timestamptz '2026-11-21 00:00:00+00', 10, 4),
  ('00000000-0000-4000-8000-000000451416', 'g-416', timestamptz '2026-10-22 00:00:00+00', 5, 4),
  ('00000000-0000-4000-8000-000000451416', 'g-416', timestamptz '2026-11-21 00:00:00+00', 10, 4),
  ('00000000-0000-4000-8000-000000451417', 'g-417', timestamptz '2026-10-22 00:00:00+00', 5, 4),
  ('00000000-0000-4000-8000-000000451417', 'g-417', timestamptz '2026-11-21 00:00:00+00', 10, 4),
  ('00000000-0000-4000-8000-000000451418', 'g-418', timestamptz '2026-10-22 00:00:00+00', 20, 4),
  ('00000000-0000-4000-8000-000000451418', 'g-418', timestamptz '2026-11-21 00:00:00+00', 100, 4),
  ('00000000-0000-4000-8000-000000451419', 'g-419', timestamptz '2026-10-22 00:00:00+00', 190, 5),
  ('00000000-0000-4000-8000-000000451419', 'g-419', timestamptz '2026-11-21 00:00:00+00', 200, 5),
  ('00000000-0000-4000-8000-000000451420', 'g-420', timestamptz '2026-10-22 00:00:00+00', 180, 5),
  ('00000000-0000-4000-8000-000000451420', 'g-420', timestamptz '2026-11-21 00:00:00+00', 200, 5),
  ('00000000-0000-4000-8000-000000451421', 'g-421', timestamptz '2026-10-22 00:00:00+00', 170, 5),
  ('00000000-0000-4000-8000-000000451421', 'g-421', timestamptz '2026-11-21 00:00:00+00', 200, 5),
  ('00000000-0000-4000-8000-000000451422', 'g-422', timestamptz '2026-10-22 00:00:00+00', 160, 5),
  ('00000000-0000-4000-8000-000000451422', 'g-422', timestamptz '2026-11-21 00:00:00+00', 200, 5),
  ('00000000-0000-4000-8000-000000451423', 'g-423', timestamptz '2026-10-22 00:00:00+00', 150, 5),
  ('00000000-0000-4000-8000-000000451423', 'g-423', timestamptz '2026-11-21 00:00:00+00', 200, 5),
  ('00000000-0000-4000-8000-000000451424', 'g-424', timestamptz '2026-10-22 00:00:00+00', 140, 5),
  ('00000000-0000-4000-8000-000000451424', 'g-424', timestamptz '2026-11-21 00:00:00+00', 200, 5),
  ('00000000-0000-4000-8000-000000451425', 'g-425', timestamptz '2026-10-22 00:00:00+00', 130, 5),
  ('00000000-0000-4000-8000-000000451425', 'g-425', timestamptz '2026-11-21 00:00:00+00', 200, 5);

create or replace function pg_temp.kind_of(p_id uuid)
returns text language sql as $$
  select kind from public.discovery_growth_bases(
    false,
    array['tacos', 'coffee', 'sweet', 'dinner'],
    timestamptz '2026-11-21 00:00:00+00')
   where place_id = p_id
$$;

create or replace function pg_temp.base_of(p_id uuid)
returns double precision language sql as $$
  select growth_base from public.discovery_growth_bases(
    false,
    array['tacos', 'coffee', 'sweet', 'dinner'],
    timestamptz '2026-11-21 00:00:00+00')
   where place_id = p_id
$$;

create or replace function pg_temp.rank_ids()
returns jsonb language sql as $$
  select public.catalog_rank_lanes(
    p_lat => 25.50, p_lng => -100.31,
    p_organic_half_km => 1, p_organic_distance_exp => 2, p_organic_stars_exp => 2, p_organic_google_exp => 0.5, p_organic_premier_exp => 0,
    p_ad_half_km => 1, p_ad_distance_exp => 2, p_ad_stars_exp => 2, p_ad_google_exp => 0.5, p_ad_premier_exp => 0,
    p_premier_1 => 2, p_premier_2 => 5,
    p_families => array['dinner'],
    p_known_families => array['dinner'],
    p_require_active => false,
    p_repeat => 1,
    p_ad_floor => 0.2) -> 'ids'
$$;

select has_table('public', 'google_review_observations', 'Fast Update stores one review snapshot per observation');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.google_review_observations'::regclass)
  and has_table_privilege('service_role', 'public.google_review_observations', 'select')
  and has_table_privilege('service_role', 'public.google_review_observations', 'insert')
  and not has_table_privilege('anon', 'public.google_review_observations', 'select')
  and not has_table_privilege('authenticated', 'public.google_review_observations', 'select'),
  'the snapshot table is service role only');

select ok(public.discovery_growth_weight(6.9, 0.5, 'grow') = 0, 'under 7 days carries no growth');
select ok(abs(public.discovery_growth_weight(7, 0.5, 'grow') - 0.20) < 1e-9, '7 days is 20 percent');
select ok(abs(public.discovery_growth_weight(18.5, 0.5, 'grow') - 0.35) < 1e-9, 'halfway from 7 to 30 is 35 percent');
select ok(abs(public.discovery_growth_weight(30, 0.5, 'flat') - 0.50) < 1e-9, '30 days uses the launch cap');
select ok(abs(public.discovery_growth_weight(90, 0.8, 'grow') - 0.80) < 1e-9, 'a stored cap of 0.80 is the later experiment');
select ok(public.discovery_growth_weight(30, 0.5, 'missing') = 0, 'missing history does not take the cap');

select throws_ok(
  $$insert into public.google_review_observations (place_id, google_place_id, observed_at, review_count)
    values ('00000000-0000-4000-8000-000000451401', 'g-401', timestamptz '2026-10-22 00:00:00+00', 10)$$,
  '23505', null,
  'retrying the same observation does not add a row');

select is(pg_temp.kind_of('00000000-0000-4000-8000-000000451401'), 'flat', 'the same count twice is observed zero growth');
select ok(pg_temp.base_of('00000000-0000-4000-8000-000000451401') = 0, 'observed zero growth mixes in zero');

select is(
  (select count(*) from public.google_review_observations where place_id = '00000000-0000-4000-8000-000000451402'),
  2::bigint,
  'a decrease stays in the history');
select is(pg_temp.kind_of('00000000-0000-4000-8000-000000451402'), 'flat', 'a decrease ranks as zero growth');

select is(pg_temp.kind_of('00000000-0000-4000-8000-000000451403'), 'missing', 'a changed Google listing drops the old snapshots');
select is(pg_temp.kind_of('00000000-0000-4000-8000-000000451404'), 'missing', 'snapshots older than 90 days age out');
select is(pg_temp.kind_of('00000000-0000-4000-8000-000000451405'), 'short', 'six days is not enough history');

select ok(abs(pg_temp.base_of('00000000-0000-4000-8000-000000451406') - 100) < 1e-6, 'the slowest unique velocity maps to the smallest base');
select ok(abs(pg_temp.base_of('00000000-0000-4000-8000-000000451408') - 350) < 1e-6, 'tied velocities share the mid quantile');
select ok(abs(pg_temp.base_of('00000000-0000-4000-8000-000000451409') - 350) < 1e-6, 'the other tie maps to the same quantile');
select ok(abs(pg_temp.base_of('00000000-0000-4000-8000-000000451413') - 800) < 1e-6, 'the fastest unique velocity maps to the largest base');

select is(pg_temp.kind_of('00000000-0000-4000-8000-000000451414'), 'grow', 'a thin family uses the city when the city has 8 growers');
select ok(abs(pg_temp.base_of('00000000-0000-4000-8000-000000451414') - 800) < 1e-6, 'the city quantile uses every local established base');
select is(pg_temp.kind_of('00000000-0000-4000-8000-000000451415'), 'fallback', 'fewer than 8 growers in the city scores the established base only');

select ok(
  (
    select min(o) filter (where e #>> '{}' = '00000000-0000-4000-8000-000000451418')
         < min(o) filter (where e #>> '{}' = '00000000-0000-4000-8000-000000451426')
      from jsonb_array_elements(pg_temp.rank_ids()) with ordinality as t(e, o)
  ),
  'a growing place ranks above an equal established place with no history');

select is(pg_temp.rank_ids(), pg_temp.rank_ids(), 'the next page reads the same order');

select * from finish();
rollback;
