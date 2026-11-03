-- MESITA-3163 — Premier Refill: premier_add_days and premier_end_mesita_days.
-- Money: days stack 5X first, then 2X, each tier in grant order; a replay
-- never adds twice, even after an end; the paid Subscription pauses for the
-- whole chain. now() is the transaction's start, so every expected end is
-- exact.

begin;

create extension if not exists pgtap with schema public;

select plan(34);

insert into public.place_profiles (id, google_name) values
  ('00000000-0000-4000-8000-000000163000', 'Refill Stack'),
  ('00000000-0000-4000-8000-000000163001', 'Refill Archived'),
  ('00000000-0000-4000-8000-000000163002', 'Refill Disabled'),
  ('00000000-0000-4000-8000-000000163003', 'Refill Paid 5X'),
  ('00000000-0000-4000-8000-000000163004', 'Refill Pledge 5X'),
  ('00000000-0000-4000-8000-000000163005', 'Refill Chain Cover'),
  ('00000000-0000-4000-8000-000000163006', 'Refill Long Pause'),
  ('00000000-0000-4000-8000-000000163007', 'Refill Boundary');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000163000', 'mesita-163000-probe', 'active', 'ready', 'USD'),
  ('00000000-0000-4000-8000-000000163001', 'mesita-163001-probe', 'archived', 'ready', 'USD'),
  ('00000000-0000-4000-8000-000000163002', 'mesita-163002-probe', 'paused', 'ready', 'USD'),
  ('00000000-0000-4000-8000-000000163003', 'mesita-163003-probe', 'active', 'ready', 'USD'),
  ('00000000-0000-4000-8000-000000163004', 'mesita-163004-probe', 'active', 'ready', 'USD'),
  ('00000000-0000-4000-8000-000000163005', 'mesita-163005-probe', 'active', 'ready', 'USD'),
  ('00000000-0000-4000-8000-000000163006', 'mesita-163006-probe', 'active', 'ready', 'USD'),
  ('00000000-0000-4000-8000-000000163007', 'mesita-163007-probe', 'active', 'ready', 'USD');

-- A guest pays 5X; a guest waits to pay 5X; a paid 2X with 20 days left; a
-- monthly 2X subscription 5 days into its period.
insert into public.place_premier_periods (place_id, tier, billing_interval, starts_at, ends_at, status) values
  ('00000000-0000-4000-8000-000000163003', 2, 'month', now() - interval '1 day', now() + interval '29 days', 'paid'),
  ('00000000-0000-4000-8000-000000163005', 1, 'month', now() - interval '10 days', now() + interval '20 days', 'paid');
insert into public.place_backings (id, place_id, tier, billing_interval, amount_cents, status, stripe_payment_method_id, queued_at) values
  ('00000000-0000-4000-8000-0000001b3004', '00000000-0000-4000-8000-000000163004', 'boost_5x', 'month', 10000, 'ready', 'pm_probe_163004', now()),
  ('00000000-0000-4000-8000-0000001b3006', '00000000-0000-4000-8000-000000163006', 'boost_2x', 'month', 1000, 'ready', 'pm_probe_163006', now() - interval '5 days');
insert into public.place_premier_periods (id, place_id, backing_id, tier, billing_interval, starts_at, ends_at, price_cents, status)
values ('00000000-0000-4000-8000-0000001e3006', '00000000-0000-4000-8000-000000163006', '00000000-0000-4000-8000-0000001b3006',
        1, 'month', now() - interval '5 days', now() + interval '25 days', 1000, 'paid');

select ok(
  not has_function_privilege('anon', 'public.premier_add_days(uuid, smallint, integer, text, text, text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.premier_add_days(uuid, smallint, integer, text, text, text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.premier_end_mesita_days(uuid, text)', 'EXECUTE')
    and to_regprocedure('public.premier_grant(uuid, smallint, integer, text)') is null
    and to_regprocedure('public.premier_set_grant(uuid, smallint, integer, text)') is null
    and to_regprocedure('public.premier_end_grant(uuid)') is null,
  'the two Refill writers are service-role only; premier_grant, premier_set_grant and premier_end_grant are gone'
);

-- ━━━ Stacking ━━━
select is(
  premier_add_days('00000000-0000-4000-8000-000000163000', 1::smallint, 30, 'admin', 'probe@mesita.ai', 'a1') ->> 'result',
  'ok',
  'Refill 2X for 30 days on a place with nothing running'
);

select is(
  (select boost_tier from public.places where id = '00000000-0000-4000-8000-000000163000'),
  1::smallint,
  'the Refill is live at once: Premier 2X'
);

select is(
  (select array[(r ->> 'ends_at_5x')::timestamptz, (r ->> 'ends_at_2x')::timestamptz]
     from (select premier_add_days('00000000-0000-4000-8000-000000163000', 2::smallint, 10, 'admin', 'probe@mesita.ai', 'a2') r) x),
  array[now() + interval '10 days', now() + interval '40 days'],
  '5X over a running 2X runs first; the 2X keeps its 30 days after it'
);

select ok(
  (select count(*) = 1 and min(starts_at) = now() + interval '10 days' and min(ends_at) = now() + interval '40 days'
     from public.place_manual_premier
    where place_id = '00000000-0000-4000-8000-000000163000' and request_id = 'a1'),
  'the running 2X row moves in place, never split: one row per request_id'
);

select is(
  (select boost_tier from public.places where id = '00000000-0000-4000-8000-000000163000'),
  2::smallint,
  'with 5X days running the place is Premier 5X'
);

select is(
  (premier_add_days('00000000-0000-4000-8000-000000163000', 1::smallint, 5, 'purchase', null, 'a3') ->> 'ends_at_2x')::timestamptz,
  now() + interval '45 days',
  'a bought 2X pack queues after the admin 2X'
);

select is(
  (select array[(r ->> 'ends_at_5x')::timestamptz, (r ->> 'ends_at_2x')::timestamptz]
     from (select premier_add_days('00000000-0000-4000-8000-000000163000', 2::smallint, 3, 'purchase', null, 'a4') r) x),
  array[now() + interval '13 days', now() + interval '48 days'],
  'a bought 5X queues after the first 5X and before every 2X'
);

select is(
  (select array_agg(request_id order by starts_at) from public.place_manual_premier
    where place_id = '00000000-0000-4000-8000-000000163000' and ends_at > now()),
  array['a2', 'a4', 'a1', 'a3'],
  'the chain: 5X rows in grant order, then 2X rows in grant order, back to back'
);

-- ━━━ Replay ━━━
select is(
  premier_add_days('00000000-0000-4000-8000-000000163000', 1::smallint, 30, 'admin', 'probe@mesita.ai', 'a1') ->> 'replayed',
  'true',
  'the same request_id again is answered replayed'
);

select is(
  (select count(*)::int from public.place_manual_premier where place_id = '00000000-0000-4000-8000-000000163000'),
  4,
  'a replay adds no row'
);

-- ━━━ End Mesita days ━━━
select is(
  premier_end_mesita_days('00000000-0000-4000-8000-000000163000', 'probe@mesita.ai') ->> 'ended_days',
  '40',
  'End Mesita days ends the 30 admin 2X days and the 10 admin 5X days'
);

select is(
  (select array[(r ->> 'ends_at_5x')::timestamptz, (r ->> 'ends_at_2x')::timestamptz]
     from (select premier_refill_ends('00000000-0000-4000-8000-000000163000') r) x),
  array[now() + interval '3 days', now() + interval '8 days'],
  'code and bought days stay and move up: 5X 3 days, then 2X 5 days'
);

select is(
  (select boost_tier from public.places where id = '00000000-0000-4000-8000-000000163000'),
  2::smallint,
  'the code''s 5X runs now'
);

select ok(
  (select r ->> 'replayed' = 'true' and (r ->> 'ends_at_2x')::timestamptz = now() + interval '8 days'
     from (select premier_add_days('00000000-0000-4000-8000-000000163000', 1::smallint, 30, 'admin', 'probe@mesita.ai', 'a1') r) x),
  'a press replayed after End Mesita days is answered replayed and adds nothing'
);

select is(
  (select count(*)::int from public.place_manual_premier where place_id = '00000000-0000-4000-8000-000000163000'),
  4,
  'ended rows are never deleted'
);

select is(
  premier_end_mesita_days('00000000-0000-4000-8000-000000163000', 'probe@mesita.ai') ->> 'ended_days',
  '0',
  'End Mesita days with no admin days left ends 0'
);

-- ━━━ Cap: 366 queued days ━━━
select is(
  premier_add_days('00000000-0000-4000-8000-000000163000', 1::smallint, 359, 'admin', 'probe@mesita.ai', 'a5') ->> 'code',
  'cap_reached',
  'more than 366 queued days is refused'
);

select is(
  premier_add_days('00000000-0000-4000-8000-000000163000', 1::smallint, 358, 'admin', 'probe@mesita.ai', 'a6') ->> 'result',
  'ok',
  'exactly 366 queued days is allowed'
);

-- ━━━ Refusals ━━━
select is(
  premier_add_days('00000000-0000-4000-8000-00000000ffff', 1::smallint, 30, 'admin', 'probe@mesita.ai', 'r1') ->> 'code',
  'not_found',
  'an unknown place is refused not_found'
);

select is(
  premier_add_days('00000000-0000-4000-8000-000000163001', 1::smallint, 30, 'admin', 'probe@mesita.ai', 'r2') ->> 'code',
  'archived',
  'an archived place is refused'
);

select is(
  premier_add_days('00000000-0000-4000-8000-000000163002', 1::smallint, 30, 'admin', 'probe@mesita.ai', 'r3') ->> 'code',
  'unlisted',
  'a Disabled place is refused unlisted'
);

select is(
  premier_add_days('00000000-0000-4000-8000-000000163000', 1::smallint, 0, 'admin', 'probe@mesita.ai', 'r4') ->> 'code',
  'days_invalid',
  'zero days is refused'
);

select is(
  premier_add_days('00000000-0000-4000-8000-000000163000', 1::smallint, 367, 'admin', 'probe@mesita.ai', 'r5') ->> 'code',
  'days_invalid',
  'over 366 days in one add is refused'
);

select is(
  premier_add_days('00000000-0000-4000-8000-000000163003', 1::smallint, 30, 'admin', 'probe@mesita.ai', 'r6') ->> 'code',
  'paid_higher',
  'Refill 2X under a paid 5X is refused paid_higher'
);

select is(
  premier_add_days('00000000-0000-4000-8000-000000163003', 2::smallint, 30, 'admin', 'probe@mesita.ai', 'r7') ->> 'result',
  'ok',
  'Refill 5X on a paid 5X is allowed (it pauses the paid period)'
);

select is(
  premier_add_days('00000000-0000-4000-8000-000000163004', 1::smallint, 30, 'admin', 'probe@mesita.ai', 'r8') ->> 'code',
  'paid_higher',
  'a ready 5X pledge counts as a paid 5X: Refill 2X is refused'
);

select throws_ok(
  $$insert into public.place_manual_premier (place_id, tier, starts_at, ends_at, request_id)
    values ('00000000-0000-4000-8000-000000163000', 1, now() - interval '1 year', now() - interval '1 year', 'a3')$$,
  '23505', null,
  'request_id is unique per place'
);

-- ━━━ Cover: the whole chain pauses the paid period ━━━
select premier_add_days('00000000-0000-4000-8000-000000163005', 2::smallint, 10, 'admin', 'probe@mesita.ai', 'c1');
select premier_add_days('00000000-0000-4000-8000-000000163005', 1::smallint, 20, 'admin', 'probe@mesita.ai', 'c2');

select is(
  (select ends_at from public.place_premier_periods where place_id = '00000000-0000-4000-8000-000000163005' and status = 'paid'),
  now() + interval '50 days',
  'a paid 2X under 5X then 2X days resumes after the last 2X day with its 20 days'
);

select premier_add_days('00000000-0000-4000-8000-000000163005', 1::smallint, 5, 'admin', 'probe@mesita.ai', 'c3');

select ok(
  (select remaining_at_cover_sec = 20 * 86400 and ends_at = now() + interval '55 days'
     from public.place_premier_periods where place_id = '00000000-0000-4000-8000-000000163005' and status = 'paid'),
  'a three-row stack leaves the paid seconds left unchanged and moves the end once more'
);

select premier_end_mesita_days('00000000-0000-4000-8000-000000163005', 'probe@mesita.ai');

select ok(
  (select covered_until = now() and ends_at = now() + interval '55 days'
     from public.place_premier_periods where place_id = '00000000-0000-4000-8000-000000163005' and status = 'paid'),
  'ending the days early keeps the moved end and records when the cover stopped'
);

-- ━━━ A 90-day 5X stack over a monthly 2X ━━━
select premier_add_days('00000000-0000-4000-8000-000000163006', 2::smallint, 30, 'admin', 'probe@mesita.ai', 'd1');
select premier_add_days('00000000-0000-4000-8000-000000163006', 2::smallint, 30, 'admin', 'probe@mesita.ai', 'd2');
select premier_add_days('00000000-0000-4000-8000-000000163006', 2::smallint, 30, 'admin', 'probe@mesita.ai', 'd3');

select is(
  (select ends_at from public.place_premier_periods where id = '00000000-0000-4000-8000-0000001e3006'),
  now() + interval '115 days',
  'the subscription pauses for all 90 days, then runs its 25 days left'
);

select ok(
  premier_begin_renewal('00000000-0000-4000-8000-000000163006') ->> 'action' = 'none'
    and (select status from public.place_backings where id = '00000000-0000-4000-8000-0000001b3006') = 'ready',
  'nothing renews while paused, and the subscription stays ready'
);

-- ━━━ Boundary: the cron flips 5X → 2X when the 5X row ends ━━━
insert into public.place_manual_premier (place_id, tier, starts_at, ends_at, request_id) values
  ('00000000-0000-4000-8000-000000163007', 2, now() - interval '10 days', now(), 'b1'),
  ('00000000-0000-4000-8000-000000163007', 1, now(), now() + interval '5 days', 'b2');
update public.places set boost_tier = 2 where id = '00000000-0000-4000-8000-000000163007';
select recompute_due_place_boosts();

select is(
  (select boost_tier from public.places where id = '00000000-0000-4000-8000-000000163007'),
  1::smallint,
  'at the exact boundary the 5X row has ended and the 2X row runs: the cron flips 2 → 1'
);

select * from finish();

rollback;
