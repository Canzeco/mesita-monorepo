-- MESITA-3167 — Premier codes: premier_redeem_code. Money: a 100% code
-- adds its Refill days once per place, never past its uses, never after it
-- expires or is revoked; a refused redemption uses nothing; revoking keeps
-- the days already redeemed; 10 tries per user per hour. now() is the
-- transaction's start, so every expected end is exact. Hashes stand in for
-- HMACs (the EF computes them).

begin;

create extension if not exists pgtap with schema public;

select plan(27);

insert into public.place_profiles (id, google_name) values
  ('00000000-0000-4000-8000-000000167000', 'Code Fresh'),
  ('00000000-0000-4000-8000-000000167001', 'Code Second'),
  ('00000000-0000-4000-8000-000000167002', 'Code Archived'),
  ('00000000-0000-4000-8000-000000167003', 'Code Paid 5X'),
  ('00000000-0000-4000-8000-000000167004', 'Code Third'),
  ('00000000-0000-4000-8000-000000167005', 'Code Paid 2X');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000167000', 'mesita-167000-probe', 'active', 'ready', 'USD'),
  ('00000000-0000-4000-8000-000000167001', 'mesita-167001-probe', 'active', 'ready', 'USD'),
  ('00000000-0000-4000-8000-000000167002', 'mesita-167002-probe', 'archived', 'ready', 'USD'),
  ('00000000-0000-4000-8000-000000167003', 'mesita-167003-probe', 'active', 'ready', 'USD'),
  ('00000000-0000-4000-8000-000000167004', 'mesita-167004-probe', 'active', 'ready', 'USD'),
  ('00000000-0000-4000-8000-000000167005', 'mesita-167005-probe', 'active', 'ready', 'USD');

-- A guest pays 5X; another pays 2X, 10 days into a monthly period.
insert into public.place_premier_periods (place_id, tier, billing_interval, starts_at, ends_at, status) values
  ('00000000-0000-4000-8000-000000167003', 2, 'month', now() - interval '1 day', now() + interval '29 days', 'paid'),
  ('00000000-0000-4000-8000-000000167005', 1, 'month', now() - interval '10 days', now() + interval '20 days', 'paid');

insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000a3167'),
  ('00000000-0000-4000-8000-0000000b3167'),
  ('00000000-0000-4000-8000-0000000c3167'),
  ('00000000-0000-4000-8000-0000000d3167');

-- A: 5X 30 days, 2 uses · B: expired · C: 2X 10 days, 1 use · D: 2X 20 days, 5 uses (revoked below) · F: 2X 5 days.
insert into public.premier_codes (id, code_hash, last4, tier, days, max_redemptions, expires_at, created_by) values
  ('00000000-0000-4000-8000-00000c0de00a', repeat('a', 64), 'AAAA', 2, 30, 2, null, 'probe@mesita.ai'),
  ('00000000-0000-4000-8000-00000c0de00b', repeat('b', 64), 'BBBB', 2, 30, 9, now() - interval '1 minute', 'probe@mesita.ai'),
  ('00000000-0000-4000-8000-00000c0de00c', repeat('c', 64), 'CCCC', 1, 10, 1, now() + interval '30 days', 'probe@mesita.ai'),
  ('00000000-0000-4000-8000-00000c0de00d', repeat('d', 64), 'DDDD', 1, 20, 5, null, 'probe@mesita.ai'),
  ('00000000-0000-4000-8000-00000c0de00f', repeat('f', 64), 'FFFF', 1, 5, 5, null, 'probe@mesita.ai');

-- ━━━ Locked down ━━━
select ok(
  not has_function_privilege('anon', 'public.premier_redeem_code(text, uuid, uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.premier_redeem_code(text, uuid, uuid)', 'EXECUTE')
    and (select bool_and(relrowsecurity) from pg_class
          where oid in ('public.premier_codes'::regclass, 'public.premier_code_redemptions'::regclass,
                        'public.premier_code_attempts'::regclass))
    and not has_table_privilege('authenticated', 'public.premier_codes', 'SELECT')
    and not has_table_privilege('anon', 'public.premier_code_redemptions', 'SELECT')
    and not has_table_privilege('authenticated', 'public.premier_code_attempts', 'SELECT'),
  'the redeemer is service-role only; the three code tables are EF-only'
);

-- ━━━ Redeem ━━━
select is(
  (select array[r ->> 'result', r ->> 'tier', r ->> 'days', (r ->> 'ends_at_5x')]
     from (select premier_redeem_code(repeat('a', 64), '00000000-0000-4000-8000-000000167000',
                                      '00000000-0000-4000-8000-0000000a3167') r) x),
  array['ok', '2', '30', to_jsonb(now() + interval '30 days') #>> '{}'],
  'a 5X code adds 30 days of 5X from now'
);

select ok(
  (select count(*) = 1 and bool_and(source = 'code' and tier = 2
                                     and request_id = 'code:' || repeat('a', 64) || ':00000000-0000-4000-8000-000000167000'
                                     and granted_by = '00000000-0000-4000-8000-0000000a3167')
     from public.place_manual_premier where place_id = '00000000-0000-4000-8000-000000167000'),
  'the days are one Refill row, source code, replay key code:<hmac>:<place_id>, by the user'
);

select is(
  (select boost_tier from public.places where id = '00000000-0000-4000-8000-000000167000'),
  2::smallint,
  'the place is Premier 5X at once'
);

select is(
  (select count(*)::integer from public.premier_code_redemptions where code_id = '00000000-0000-4000-8000-00000c0de00a'),
  1,
  'the use is counted'
);

select is(
  (premier_add_days('00000000-0000-4000-8000-000000167000', 2::smallint, 30, 'code', 'probe',
                    'code:' || repeat('a', 64) || ':00000000-0000-4000-8000-000000167000') ->> 'replayed'),
  'true',
  'the replay key holds: the same code on the same place through premier_add_days adds nothing'
);

-- ━━━ Refusals use nothing ━━━
select is(
  premier_redeem_code(repeat('a', 64), '00000000-0000-4000-8000-000000167000', '00000000-0000-4000-8000-0000000b3167') ->> 'code',
  'code_used_here',
  'a code redeems once per place, whoever tries it'
);

select is(
  (select count(*)::integer from public.place_manual_premier where place_id = '00000000-0000-4000-8000-000000167000'),
  1,
  'code_used_here added no days'
);

select is(
  premier_redeem_code(repeat('e', 64), '00000000-0000-4000-8000-000000167001', '00000000-0000-4000-8000-0000000b3167') ->> 'code',
  'code_unknown',
  'an unknown hash is code_unknown'
);

select is(
  premier_redeem_code(repeat('b', 64), '00000000-0000-4000-8000-000000167001', '00000000-0000-4000-8000-0000000b3167') ->> 'code',
  'code_expired',
  'a code past expires_at is code_expired'
);

select is(
  premier_redeem_code(repeat('c', 64), '00000000-0000-4000-8000-000000167001', '00000000-0000-4000-8000-0000000b3167') ->> 'result',
  'ok',
  'a one-use 2X code redeems on its first place'
);

select is(
  premier_redeem_code(repeat('c', 64), '00000000-0000-4000-8000-000000167004', '00000000-0000-4000-8000-0000000b3167') ->> 'code',
  'code_exhausted',
  'its second place is refused: code_exhausted'
);

select ok(
  (select count(*) = 1 from public.premier_code_redemptions where code_id = '00000000-0000-4000-8000-00000c0de00c')
    and not exists (select 1 from public.place_manual_premier where place_id = '00000000-0000-4000-8000-000000167004'),
  'code_exhausted used nothing and added no days'
);

select is(
  premier_redeem_code(repeat('a', 64), '00000000-0000-4000-8000-000000167002', '00000000-0000-4000-8000-0000000b3167') ->> 'code',
  'archived',
  'premier_add_days refusals pass through: an archived place'
);

select is(
  premier_redeem_code(repeat('f', 64), '00000000-0000-4000-8000-000000167003', '00000000-0000-4000-8000-0000000b3167') ->> 'code',
  'paid_higher',
  'a 2X code on a place paid at 5X is paid_higher'
);

select ok(
  (select count(*) = 1 from public.premier_code_redemptions where code_id = '00000000-0000-4000-8000-00000c0de00a')
    and not exists (select 1 from public.premier_code_redemptions where code_id = '00000000-0000-4000-8000-00000c0de00f'),
  'refusals from premier_add_days used nothing'
);

-- ━━━ Pause ━━━
select is(
  (select array[r ->> 'paused_tier', r ->> 'paused_until']
     from (select premier_redeem_code(repeat('a', 64), '00000000-0000-4000-8000-000000167005',
                                      '00000000-0000-4000-8000-0000000c3167') r) x),
  array['1', to_jsonb(now() + interval '30 days') #>> '{}'],
  'a 5X code over a paid 2X answers the pause: 2X until the days end'
);

select is(
  premier_redeem_code(repeat('a', 64), '00000000-0000-4000-8000-000000167004', '00000000-0000-4000-8000-0000000c3167') ->> 'code',
  'code_exhausted',
  'two uses of A, then exhausted'
);

-- ━━━ Revoke keeps redeemed days (CEO D5) ━━━
select is(
  premier_redeem_code(repeat('d', 64), '00000000-0000-4000-8000-000000167001', '00000000-0000-4000-8000-0000000c3167') ->> 'result',
  'ok',
  'D redeems before it is revoked'
);

update public.premier_codes set expires_at = now(), revoked_at = now() where id = '00000000-0000-4000-8000-00000c0de00d';

select is(
  premier_redeem_code(repeat('d', 64), '00000000-0000-4000-8000-000000167004', '00000000-0000-4000-8000-0000000c3167') ->> 'code',
  'code_expired',
  'a revoked code is refused as expired'
);

select is(
  (select ends_at from public.place_manual_premier
    where place_id = '00000000-0000-4000-8000-000000167001'
      and request_id = 'code:' || repeat('d', 64) || ':00000000-0000-4000-8000-000000167001'),
  now() + interval '30 days',
  'the days D already gave keep running after the revoke (after C''s 10 days)'
);

-- ━━━ 10 tries per user per hour ━━━
insert into public.premier_code_attempts (user_id, at)
select '00000000-0000-4000-8000-0000000d3167', now() - interval '61 minutes' from generate_series(1, 10);

select is(
  premier_redeem_code(repeat('e', 64), '00000000-0000-4000-8000-000000167004', '00000000-0000-4000-8000-0000000d3167') ->> 'code',
  'code_unknown',
  'tries older than an hour do not count'
);

insert into public.premier_code_attempts (user_id, at)
select '00000000-0000-4000-8000-0000000d3167', now() - interval '10 minutes' from generate_series(1, 8);

select is(
  premier_redeem_code(repeat('e', 64), '00000000-0000-4000-8000-000000167004', '00000000-0000-4000-8000-0000000d3167') ->> 'code',
  'code_unknown',
  'the 10th try in the hour is still checked'
);

select is(
  (select array[r ->> 'code', r ->> 'retry_after']
     from (select premier_redeem_code(repeat('f', 64), '00000000-0000-4000-8000-000000167004',
                                      '00000000-0000-4000-8000-0000000d3167') r) x),
  array['rate_limited', to_jsonb(now() - interval '10 minutes' + interval '1 hour') #>> '{}'],
  'the 11th is rate_limited, even with a good code; retry_after is when the oldest counted try ages out'
);

select ok(
  not exists (select 1 from public.premier_code_redemptions where code_id = '00000000-0000-4000-8000-00000c0de00f')
    and not exists (select 1 from public.place_manual_premier where place_id = '00000000-0000-4000-8000-000000167004'),
  'a rate-limited try used nothing'
);

select is(
  (select count(*)::integer from public.premier_code_attempts
    where user_id = '00000000-0000-4000-8000-0000000d3167' and at > now() - interval '1 hour'),
  10,
  'a rate-limited try is not counted'
);

select is(
  premier_redeem_code(repeat('e', 64), '00000000-0000-4000-8000-000000167004', '00000000-0000-4000-8000-0000000c3167') ->> 'code',
  'code_unknown',
  'the limit is per user: another user still tries'
);

select * from finish();

rollback;
