-- MESITA-4931 — the test guest is in nobody's Social; a guest is not one by default.

begin;

create extension if not exists pgtap with schema public;

select plan(4);

select is(
  public.consumer_social_level(jsonb_populate_record(null::public.consumers,
    '{"birth_year": 1990, "social_private": false, "is_test_guest": true}')),
  'private', 'the test guest is private whatever they chose');
select is(
  public.consumer_social_level(jsonb_populate_record(null::public.consumers,
    '{"birth_year": 1990, "social_private": false, "is_test_guest": false}')),
  'public', 'anyone else keeps their own level');
select col_default_is('public', 'consumers', 'is_test_guest', 'false', 'a guest is not a test guest by default');
select ok(
  not has_column_privilege('anon', 'public.places', 'is_test_place', 'SELECT')
    and not has_column_privilege('authenticated', 'public.places', 'is_test_place', 'SELECT')
    and not has_column_privilege('authenticated', 'public.consumers', 'is_test_guest', 'UPDATE'),
  'clients neither read the test place nor write the flag');

select * from finish();
rollback;
