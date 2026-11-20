-- MESITA-4139 — reservation_insert_capped holds the guest lock across the
-- monthly count, the one-live-ticket check and the insert.

begin;

create extension if not exists pgtap with schema public;

select plan(7);

insert into auth.users (id) values ('00000000-0000-4000-8000-0000000a4139');
insert into public.consumers (id) values ('00000000-0000-4000-8000-0000000a4139');
insert into public.place_profiles (id, google_name) values
  ('00000000-0000-4000-8000-000000014139', 'Cap Probe One'),
  ('00000000-0000-4000-8000-000000024139', 'Cap Probe Two');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000014139', 'mesita-4139-probe-one', 'active', 'generating', 'MXN'),
  ('00000000-0000-4000-8000-000000024139', 'mesita-4139-probe-two', 'active', 'generating', 'MXN');

select is(
  (public.reservation_insert_capped(
    '00000000-0000-4000-8000-0000000a4139',
    '00000000-0000-4000-8000-000000014139',
    '41390001',
    now() + interval '2 days',
    2, null, 'call', 'app', 'Ada', 'Lovelace',
    '00000000-0000-4000-8000-0000000c4139',
    30, 'any',
    now() - interval '1 day',
    3,
    now() - interval '4 hours'
  )->>'ok')::boolean,
  true,
  'the first ticket in the month inserts'
);

select is(
  public.reservation_insert_capped(
    '00000000-0000-4000-8000-0000000a4139',
    '00000000-0000-4000-8000-000000014139',
    '41390002',
    now() + interval '3 days',
    2, null, 'call', 'app', 'Ada', 'Lovelace',
    null, 30, 'any',
    now() - interval '1 day',
    3,
    now() - interval '4 hours'
  )->>'code',
  'already_reserved',
  'a second live ticket at the same place is refused'
);

select is(
  (select count(*) from public.reservation_tickets
    where consumer_id = '00000000-0000-4000-8000-0000000a4139'),
  1::bigint,
  'the refused ticket wrote no row'
);

select is(
  public.reservation_insert_capped(
    '00000000-0000-4000-8000-0000000a4139',
    '00000000-0000-4000-8000-000000024139',
    '41390003',
    now() + interval '3 days',
    2, null, 'call', 'app', 'Ada', 'Lovelace',
    null, 30, 'any',
    now() - interval '1 day',
    1,
    now() - interval '4 hours'
  )->>'code',
  'reservation_limit_reached',
  'the cap is counted inside the same call as the insert'
);

select is(
  (public.reservation_insert_capped(
    '00000000-0000-4000-8000-0000000a4139',
    '00000000-0000-4000-8000-000000014139',
    '41390004',
    now() + interval '4 days',
    2, null, 'call', 'app', 'Ada', 'Lovelace',
    '00000000-0000-4000-8000-0000000c4139',
    30, 'any',
    now() - interval '1 day',
    3,
    now() - interval '4 hours'
  )->>'replay')::boolean,
  true,
  'the same request id returns the ticket it already made'
);

-- A meal that already passed does not count as the live ticket.
update public.reservation_tickets
  set reserved_at = now() - interval '2 days'
  where reference_code = '41390001';

select is(
  (public.reservation_insert_capped(
    '00000000-0000-4000-8000-0000000a4139',
    '00000000-0000-4000-8000-000000014139',
    '41390005',
    now() + interval '2 days',
    2, null, 'call', 'app', 'Ada', 'Lovelace',
    null, 30, 'any',
    now() - interval '1 day',
    null,
    now() - interval '4 hours'
  )->>'ok')::boolean,
  true,
  'a passed ticket does not block the next one, and a null cap does not count'
);

select is(
  public.reservation_insert_capped(
    '00000000-0000-4000-8000-0000000a4139',
    '00000000-0000-4000-8000-000000024139',
    '41390001',
    now() + interval '5 days',
    2, null, 'call', 'app', 'Ada', 'Lovelace',
    null, 30, 'any',
    now() - interval '1 day',
    null,
    now() - interval '4 hours'
  )->>'code',
  'reference_taken',
  'a reference code already in use is handed back to the caller to redraw'
);

select * from finish();
rollback;
