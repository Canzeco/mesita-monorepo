-- MESITA-3165 — Premier: subscribe early. Money: a card saved in the last 7
-- days of Refill days becomes the subscription with no period and no charge;
-- day 8 is refused; added days never end it as dormant; it is charged when
-- the cover ends. now() is the transaction's start, so every end is exact.

begin;

create extension if not exists pgtap with schema public;

select plan(16);

insert into public.place_profiles (id, google_name) values
  ('00000000-0000-4000-8000-000000165000', 'Early Day 7'),
  ('00000000-0000-4000-8000-000000165001', 'Early Day 8'),
  ('00000000-0000-4000-8000-000000165002', 'Early Tokyo'),
  ('00000000-0000-4000-8000-000000165003', 'Early Dormant');
update public.place_profiles set timezone = 'Asia/Tokyo' where id = '00000000-0000-4000-8000-000000165002';
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000165000', 'mesita-165000-probe', 'active', 'ready', 'USD'),
  ('00000000-0000-4000-8000-000000165001', 'mesita-165001-probe', 'active', 'ready', 'USD'),
  ('00000000-0000-4000-8000-000000165002', 'mesita-165002-probe', 'active', 'ready', 'USD'),
  ('00000000-0000-4000-8000-000000165003', 'mesita-165003-probe', 'active', 'ready', 'USD');

-- 2X Refill days: 7 left, 8 left, 7 left in Tokyo, 30 left.
select premier_add_days('00000000-0000-4000-8000-000000165000', 1::smallint, 7, 'admin', 'probe@mesita.ai', 'e0');
select premier_add_days('00000000-0000-4000-8000-000000165001', 1::smallint, 8, 'admin', 'probe@mesita.ai', 'e1');
select premier_add_days('00000000-0000-4000-8000-000000165002', 1::smallint, 7, 'admin', 'probe@mesita.ai', 'e2');
select premier_add_days('00000000-0000-4000-8000-000000165003', 1::smallint, 30, 'admin', 'probe@mesita.ai', 'e3');

-- A guest's 2X subscribe-early Checkout (setup) on each, its card saved.
insert into public.place_backings (id, place_id, tier, billing_interval, amount_cents, status, checkout_kind) values
  ('00000000-0000-4000-8000-0000001b5000', '00000000-0000-4000-8000-000000165000', 'boost_2x', 'month', 1000, 'open', 'resume'),
  ('00000000-0000-4000-8000-0000001b5001', '00000000-0000-4000-8000-000000165001', 'boost_2x', 'month', 1000, 'open', 'resume'),
  ('00000000-0000-4000-8000-0000001b5002', '00000000-0000-4000-8000-000000165002', 'boost_2x', 'month', 1000, 'open', 'resume');
-- A 2X subscription that did not start early, covered for two months.
insert into public.place_backings (id, place_id, tier, billing_interval, amount_cents, status, stripe_payment_method_id, queued_at) values
  ('00000000-0000-4000-8000-0000001b5003', '00000000-0000-4000-8000-000000165003', 'boost_2x', 'month', 1000, 'ready', 'pm_probe_165003', now() - interval '2 months');

select ok(
  not has_function_privilege('anon', 'public.premier_run_end(uuid, smallint)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.premier_early_window(uuid, smallint)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.premier_make_payer(uuid, text)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.premier_early_window(uuid, smallint)', 'EXECUTE'),
  'the window helpers and premier_make_payer are service-role only'
);

select is(
  premier_run_end('00000000-0000-4000-8000-000000165000', 1::smallint),
  now() + interval '7 days',
  'the run of 2X days ends in 7 days'
);

-- ━━━ The window ━━━
select is(
  premier_make_payer('00000000-0000-4000-8000-0000001b5001', 'pm_probe_165001') ->> 'result',
  'covered',
  'day 8: the early start is refused (covered)'
);

select is(
  (select status::text from public.place_backings where id = '00000000-0000-4000-8000-0000001b5001'),
  'open',
  'day 8: the pledge never becomes the subscription'
);

select is(
  premier_make_payer('00000000-0000-4000-8000-0000001b5000', 'pm_probe_165000') ->> 'result',
  'ready',
  'day 7: the early start becomes the subscription'
);

select ok(
  (select status = 'ready' and early_start and stripe_payment_method_id = 'pm_probe_165000'
     from public.place_backings where id = '00000000-0000-4000-8000-0000001b5000'),
  'day 7: ready, marked early_start, the card saved'
);

select is(
  (select count(*)::integer from public.place_premier_periods where place_id = '00000000-0000-4000-8000-000000165000'),
  0,
  'day 7: no period and nothing charged now'
);

select is(
  premier_make_payer('00000000-0000-4000-8000-0000001b5002', 'pm_probe_165002') ->> 'early_start',
  'true',
  'the window is counted in the place''s time zone (Asia/Tokyo)'
);

select is(
  premier_claim('00000000-0000-4000-8000-0000001b5000', null, 'boost_2x', 'month', 1000, 0, 0, 1000,
                'pi_probe_165000', null, 'paid', false) ->> 'reason',
  'covered',
  'a claim under the cover is still refused: it would start a paid period now'
);

-- ━━━ Added days never end it ━━━
select is(
  premier_add_days('00000000-0000-4000-8000-000000165000', 1::smallint, 40, 'admin', 'probe@mesita.ai', 'e0b') ->> 'result',
  'ok',
  '40 more days of 2X arrive after the early start'
);

update public.place_backings set queued_at = now() - interval '2 months'
 where id = '00000000-0000-4000-8000-0000001b5000';

select is(
  premier_begin_renewal('00000000-0000-4000-8000-000000165000') ->> 'reason',
  'covered',
  'covered for two months: the early start waits'
);

select ok(
  (select status = 'ready' from public.place_backings where id = '00000000-0000-4000-8000-0000001b5000'),
  'the early start stays ready'
);

-- (A statement reads the rows as they were when it began, so the ended
-- pledge is read in the next one.)
select is(
  premier_begin_renewal('00000000-0000-4000-8000-000000165003') ->> 'reason',
  'dormant',
  'a subscription that did not start early, covered for two months, ends dormant'
);

select is(
  (select ended_reason from public.place_backings where id = '00000000-0000-4000-8000-0000001b5003'),
  'covered',
  'and its reason is covered'
);

-- ━━━ Charged when the cover ends ━━━
select premier_end_mesita_days('00000000-0000-4000-8000-000000165000', 'probe@mesita.ai');

select is(
  premier_begin_renewal('00000000-0000-4000-8000-000000165000') ->> 'action',
  'charge',
  'the cover ended: the next cron run charges the early start'
);

select ok(
  (select count(*) = 1 and bool_and(status = 'charging' and tier = 1 and starts_at = now() and price_cents = 1000
                                    and backing_id = '00000000-0000-4000-8000-0000001b5000')
     from public.place_premier_periods where place_id = '00000000-0000-4000-8000-000000165000'),
  'one 2X month charging from now, on the early start''s card'
);

select * from finish();
rollback;
