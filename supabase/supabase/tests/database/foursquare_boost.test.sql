-- MESITA-4515 — the Foursquare boost and the columns it reads.
begin;

create extension if not exists pgtap with schema public;

select plan(9);

select has_column('public', 'place_profiles', 'foursquare_place_id', 'the matched branch id is stored');
select has_column('public', 'place_profiles', 'foursquare_url', 'the venue link is stored');
select has_column('public', 'place_profiles', 'foursquare_popularity', 'raw popularity is stored');
select has_column('public', 'profiles', 'foursquare_popularity', 'ranking reads popularity from the profiles view');

select ok(abs(public.discovery_foursquare_boost(null, 1, 20) - 1) < 1e-9, 'a missing score is 1x');
select ok(abs(public.discovery_foursquare_boost(0, 1, 20) - 1) < 1e-9, 'a measured zero is 1x');
select ok(abs(public.discovery_foursquare_boost(1, 1, 20) - 2) < 1e-9, 'raw 1 at factor 1 is 2x');
select ok(
  abs(public.discovery_foursquare_boost(0.95, 1, 20) - (1 + power(0.95, 20))) < 1e-9
  and abs(public.discovery_foursquare_boost(1, 0, 20) - 1) < 1e-9,
  '0.95 is about 1.36x and factor 0 is 1x for every raw score');

select ok(
  abs(public.discovery_foursquare_boost(0.5, 1, 0) - 2) < 1e-9
  and abs(public.discovery_foursquare_boost(1, 1, 0) - 2) < 1e-9
  and abs(public.discovery_foursquare_boost(null, 1, 0) - 1) < 1e-9
  and abs(public.discovery_foursquare_boost(0, 1, 0) - 1) < 1e-9,
  'exponent 0 is 2x for any present score, and 1x when the score is missing or zero');

select * from finish();
rollback;
