-- MESITA-4233 — Pulsing off hides the place: Google's CLOSED_* business
-- status turns an active place paused (Disabled), whichever writer sets it;
-- OPERATIONAL again does not re-enable; archived stays archived.

begin;

create extension if not exists pgtap with schema public;

select plan(6);

insert into public.place_profiles (id, google_name, business_state) values
  ('00000000-0000-4000-8000-000000014233', 'Pulsing Probe', 'OPERATIONAL'),
  ('00000000-0000-4000-8000-000000024233', 'Closed First Probe', 'CLOSED_PERMANENTLY'),
  ('00000000-0000-4000-8000-000000034233', 'Archived Probe', 'OPERATIONAL');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000014233', 'mesita-4233-pulsing', 'active', 'ready', 'MXN'),
  ('00000000-0000-4000-8000-000000024233', 'mesita-4233-closed-first', 'active', 'ready', 'MXN'),
  ('00000000-0000-4000-8000-000000034233', 'mesita-4233-archived', 'archived', 'ready', 'MXN');

select is(
  (select state::text from public.places where id = '00000000-0000-4000-8000-000000014233'),
  'active', 'an OPERATIONAL place stays active');

select is(
  (select state::text from public.places where id = '00000000-0000-4000-8000-000000024233'),
  'paused', 'a place whose profile already says closed starts Disabled');

update public.place_profiles set business_state = 'CLOSED_TEMPORARILY'
 where id = '00000000-0000-4000-8000-000000014233';

select is(
  (select state::text from public.places where id = '00000000-0000-4000-8000-000000014233'),
  'paused', 'Google CLOSED_TEMPORARILY disables the place');

update public.place_profiles set business_state = 'OPERATIONAL'
 where id = '00000000-0000-4000-8000-000000014233';

select is(
  (select state::text from public.places where id = '00000000-0000-4000-8000-000000014233'),
  'paused', 'OPERATIONAL again does not re-enable it (one way)');

update public.places set state = 'active' where id = '00000000-0000-4000-8000-000000014233';
update public.place_profiles set google_name = 'Pulsing Probe Renamed'
 where id = '00000000-0000-4000-8000-000000014233';

select is(
  (select state::text from public.places where id = '00000000-0000-4000-8000-000000014233'),
  'active', 'an operator Enable holds while Google stays OPERATIONAL');

update public.place_profiles set business_state = 'CLOSED_PERMANENTLY'
 where id = '00000000-0000-4000-8000-000000034233';

select is(
  (select state::text from public.places where id = '00000000-0000-4000-8000-000000034233'),
  'archived', 'an archived place stays archived');

select * from finish();

rollback;
