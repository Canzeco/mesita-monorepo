-- MESITA-3305 — W2b: the card part of a payment. wallet_hold_payment holds
-- the credit part and replays by request_id; wallet_settle_payment turns the
-- hold into the spend and writes 5% of the card part as cashback an hour
-- later, once, and never re-reads the switch; wallet_release_payment frees
-- the hold without an entry; wallet_refund_payment attributes refunds card
-- first then tip and takes back the cashback's refunded share; a needs_review
-- row that was never paid is outside every balance and wallet_reopen_settle
-- sends it back to the cron; the settle-wallet job exists; nobody but the
-- service role runs any of it.

begin;

create extension if not exists pgtap with schema public;

select plan(39);

insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000a3305'),
  ('00000000-0000-4000-8000-0000000b3305');
insert into public.consumers (id) values
  ('00000000-0000-4000-8000-0000000a3305'),
  ('00000000-0000-4000-8000-0000000b3305');
insert into public.place_profiles (id, google_name) values
  ('00000000-0000-4000-8000-000000013305', 'Card Probe');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000013305', 'mesita-3305-probe', 'active', 'generating', 'MXN');

-- Guest A holds MX$220 Available at the place (a MX$200 voucher plus its
-- bonus, the hour already gone).
insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, application_fee_cents, stripe_checkout_session_id)
values ('00000000-0000-4000-8000-0000000d3305', '00000000-0000-4000-8000-0000000a3305',
        '00000000-0000-4000-8000-000000013305', 20000, 'mxn', 'open', 'acct_test_3305',
        'voucher_200', 2000, 1000, 'cs_test_3305');
do $$ begin
  perform wallet_credit_purchase('00000000-0000-4000-8000-0000000d3305', 'pi_test_3305', now() - interval '1 minute');
end $$;

-- ━━━ Shape and access ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select has_column('public', 'wallet_payments', 'cashback_bps', 'payments store the cashback rate at start');
select has_column('public', 'wallet_payments', 'expires_at', 'payments store the Checkout expiry');
select has_column('public', 'wallet_payments', 'tip_refunded_cents', 'payments attribute refunds to the tip');
select has_column('public', 'stripe_connect_events', 'processed_at', 'events record when their work committed');

select ok(
  not has_function_privilege('authenticated', 'public.wallet_hold_payment(uuid, uuid, integer, integer, integer, text, boolean, uuid, text, text, text, integer, integer, timestamptz)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.wallet_settle_payment(uuid, text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.wallet_release_payment(uuid, text, text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.wallet_settle_batch(integer)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.wallet_give_up(text, uuid, text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.wallet_reopen_settle(text, uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.wallet_place_outstanding(uuid, text, boolean)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.place_charges_sweep()', 'EXECUTE'),
  'client roles cannot run any W2b function'
);

select is(
  (select count(*)::int from cron.job where jobname = 'settle-wallet'),
  1,
  'the settle-wallet cron job is scheduled'
);

-- A refund may now reach card + tip, and a needs_review row may lack paid_at.
select lives_ok(
  $$insert into public.wallet_payments (consumer_id, place_id, amount_cents, credit_cents, card_cents, tip_cents, currency, status,
                                        stripe_account_id, paid_at, refunded_cents, tip_refunded_cents)
    values ('00000000-0000-4000-8000-0000000b3305', '00000000-0000-4000-8000-000000013305', 500, 0, 500, 300, 'mxn', 'refunded',
            'acct_test_3305', now(), 800, 300)$$,
  'a refund ceiling of card + tip holds'
);
select throws_ok(
  $$insert into public.wallet_payments (consumer_id, place_id, amount_cents, credit_cents, card_cents, tip_cents, currency, status,
                                        stripe_account_id, paid_at, refunded_cents)
    values ('00000000-0000-4000-8000-0000000b3305', '00000000-0000-4000-8000-000000013305', 500, 0, 500, 300, 'mxn', 'refunded',
            'acct_test_3305', now(), 801)$$,
  '23514', null,
  'and one centavo past it is refused'
);
select lives_ok(
  $$insert into public.wallet_payments (consumer_id, place_id, amount_cents, credit_cents, card_cents, currency, status, stripe_account_id)
    values ('00000000-0000-4000-8000-0000000b3305', '00000000-0000-4000-8000-000000013305', 500, 0, 500, 'mxn', 'needs_review', 'acct_test_3305')$$,
  'a needs_review row may have no paid_at (the cron gave up)'
);
select throws_ok(
  $$insert into public.wallet_payments (consumer_id, place_id, amount_cents, credit_cents, card_cents, currency, status, stripe_account_id, paid_at)
    values ('00000000-0000-4000-8000-0000000b3305', '00000000-0000-4000-8000-000000013305', 500, 0, 500, 'mxn', 'open', 'acct_test_3305', now())$$,
  '23514', null,
  'an open row still never has a paid_at'
);

-- ━━━ The hold ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- MX$20 from credit, MX$5 by card, a MX$10 tip, 5% cashback, fee 25.
create temp table hold as
  select wallet_hold_payment('00000000-0000-4000-8000-0000000a3305', '00000000-0000-4000-8000-000000013305', 2000, 500, 1000,
                             'MXN', false, '00000000-0000-4000-8000-00000000a001', 'aaaaaaaaaaaaaaaaaaaaa1', 'T-7',
                             'acct_test_3305', 25, 500, now() + interval '31 minutes') as r;

select is((select r ->> 'outcome' from hold), 'held', 'the credit part is held');

select is(
  (select status || ':' || amount_cents || ':' || credit_cents || ':' || card_cents || ':' || tip_cents || ':' || cashback_bps
          || ':' || application_fee_cents || ':' || currency || ':' || coalesce(paid_at::text, 'unpaid')
     from public.wallet_payments where id = (select (r ->> 'payment_id')::uuid from hold)),
  'opening:2500:2000:500:1000:500:25:mxn:unpaid',
  'the row is opening with every part, the rate and the fee, and no paid_at'
);

select is(
  (select spendable_cents from wallet_balance('00000000-0000-4000-8000-0000000a3305', '00000000-0000-4000-8000-000000013305', 'mxn', false)),
  20000,
  'the hold takes MX$20 of the MX$220 out of spendable'
);

select is(
  wallet_hold_payment('00000000-0000-4000-8000-0000000a3305', '00000000-0000-4000-8000-000000013305', 2000, 500, 1000,
                      'MXN', false, '00000000-0000-4000-8000-00000000a001', 'aaaaaaaaaaaaaaaaaaaaa2', null,
                      'acct_test_3305', 25, 500, now() + interval '31 minutes') ->> 'outcome',
  'in_progress',
  'the same tap again while the Checkout is open answers in_progress'
);

select is(
  wallet_hold_payment('00000000-0000-4000-8000-0000000a3305', '00000000-0000-4000-8000-000000013305', 3000, 500, 0,
                      'MXN', false, '00000000-0000-4000-8000-00000000a001', 'aaaaaaaaaaaaaaaaaaaaa3', null,
                      'acct_test_3305', 25, 500, now() + interval '31 minutes') ->> 'code',
  'taken',
  'the same request_id with another amount is taken'
);

select is(
  wallet_hold_payment('00000000-0000-4000-8000-0000000a3305', '00000000-0000-4000-8000-000000013305', 30000, 500, 0,
                      'MXN', false, '00000000-0000-4000-8000-00000000a002', 'aaaaaaaaaaaaaaaaaaaaa4', null,
                      'acct_test_3305', 25, 500, now() + interval '31 minutes'),
  '{"ok": false, "code": "insufficient", "spendable_cents": 20000}'::jsonb,
  'more credit than spendable is insufficient, counting the hold'
);

select is(
  wallet_hold_payment('00000000-0000-4000-8000-0000000a3305', '00000000-0000-4000-8000-000000013305', 2000, 0, 0,
                      'MXN', false, '00000000-0000-4000-8000-00000000a003', 'aaaaaaaaaaaaaaaaaaaaa5', null,
                      'acct_test_3305', 0, 500, now() + interval '31 minutes') ->> 'code',
  'amount_required',
  'a hold needs a card part (credit-only is wallet_pay_credit)'
);

select is(
  wallet_open_payment((select (r ->> 'payment_id')::uuid from hold), 'cs_card_3305') ->> 'ok',
  'true',
  'the row takes its session and reads open'
);

-- ━━━ Settling ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- The switch flips after start: nothing changes, the rate is on the row.
insert into public.place_payment_settings (place_id, card_cashback_bps) values ('00000000-0000-4000-8000-000000013305', null);

create temp table settled as
  select wallet_settle_payment((select (r ->> 'payment_id')::uuid from hold), 'pi_card_3305') as r;

select is(
  (select r ->> 'outcome' || ':' || (r ->> 'cashback_cents') || ':' || (r ->> 'proof_token') from settled),
  'paid:25:aaaaaaaaaaaaaaaaaaaaa1',
  'settle pays it, writes 5% of the MX$5 card part as cashback and answers the proof token'
);

select is(
  (select string_agg(kind || ':' || amount_cents || ':' || (available_at <= now())::text, ',' order by kind)
     from public.wallet_entries where payment_id = (select (r ->> 'payment_id')::uuid from hold)),
  'cashback:25:false,spend:-2000:true',
  'one spend entry Available at once and one cashback entry Pending'
);

select ok(
  (select available_at between paid_at + interval '29 minutes' and paid_at + interval '31 minutes'
     from public.wallet_entries e join public.wallet_payments p on p.id = e.payment_id
    where e.kind = 'cashback' and p.id = (select (r ->> 'payment_id')::uuid from hold)),
  'the cashback lands 30 minutes after paid_at (MESITA-3835)'
);

select is(
  wallet_settle_payment((select (r ->> 'payment_id')::uuid from hold), 'pi_card_3305') ->> 'outcome',
  'already_paid',
  'a second delivery answers already_paid'
);

select is(
  (select count(*)::int from public.wallet_entries where payment_id = (select (r ->> 'payment_id')::uuid from hold)),
  2,
  'and writes nothing more'
);

select is(
  (select available_cents || ':' || pending_cents || ':' || spendable_cents
     from wallet_balance('00000000-0000-4000-8000-0000000a3305', '00000000-0000-4000-8000-000000013305', 'mxn', false)),
  '20000:25:20000',
  'MX$200 Available, the cashback Pending, nothing held'
);

select is(
  wallet_release_payment((select (r ->> 'payment_id')::uuid from hold), 'expired') ->> 'outcome',
  'unchanged',
  'releasing a paid row changes nothing'
);

-- ━━━ Refunds: card first, then tip; the cashback''s refunded share ━━━━━━━━━━

-- Half the card part back: half the cashback (12 of 25, rounded down) reversed.
select is(
  wallet_refund_payment((select (r ->> 'payment_id')::uuid from hold), 250),
  jsonb_build_object('ok', true, 'outcome', 'applied', 'delta_cents', 250, 'card_refunded_cents', 250, 'tip_refunded_cents', 0,
                     'reversed_cents', 12, 'uncovered_cents', 0, 'status', 'partly_refunded'),
  'a partial refund of the card part reverses its share of the cashback and reads partly_refunded'
);

-- Everything back, card and tip: the rest of the cashback, refunded.
select is(
  wallet_refund_payment((select (r ->> 'payment_id')::uuid from hold), 1500),
  jsonb_build_object('ok', true, 'outcome', 'applied', 'delta_cents', 1250, 'card_refunded_cents', 500, 'tip_refunded_cents', 1000,
                     'reversed_cents', 13, 'uncovered_cents', 0, 'status', 'refunded'),
  'a full refund of card and tip takes the rest of the cashback and reads refunded'
);

select is(
  (select refunded_cents || ':' || tip_refunded_cents || ':' || status
     from public.wallet_payments where id = (select (r ->> 'payment_id')::uuid from hold)),
  '1500:1000:refunded',
  'the row stores the cumulative refund and the tip''s part'
);

select is(
  wallet_refund_payment((select (r ->> 'payment_id')::uuid from hold), 1500) ->> 'outcome',
  'already_applied',
  'the same cumulative amount again applies nothing'
);

-- A cashback already spent cannot be reversed: uncovered, needs_review.
-- The entries table is append-only, so the paid payment and its cashback
-- entry (Available an hour ago) are written directly, then the cashback is
-- spent before the refund arrives.
insert into public.wallet_payments (id, consumer_id, place_id, amount_cents, credit_cents, card_cents, tip_cents, currency, status,
                                    stripe_account_id, cashback_bps, cashback_cents, request_id, paid_at)
values ('00000000-0000-4000-8000-0000000e3305', '00000000-0000-4000-8000-0000000b3305', '00000000-0000-4000-8000-000000013305',
        10000, 0, 10000, 0, 'mxn', 'paid', 'acct_test_3305', 500, 500, '00000000-0000-4000-8000-00000000b001', now() - interval '2 hours');
insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
values ('00000000-0000-4000-8000-0000000b3305', '00000000-0000-4000-8000-000000013305', 'cashback', 500, 'mxn',
        '00000000-0000-4000-8000-0000000e3305', false, now() - interval '1 hour');
do $$ begin
  perform wallet_pay_credit('00000000-0000-4000-8000-0000000b3305', '00000000-0000-4000-8000-000000013305', 500, 'mxn', false,
                            '00000000-0000-4000-8000-00000000b002', 'bbbbbbbbbbbbbbbbbbbbb1', null);
end $$;

select is(
  wallet_refund_payment('00000000-0000-4000-8000-0000000e3305', 10000),
  jsonb_build_object('ok', true, 'outcome', 'applied', 'delta_cents', 10000, 'card_refunded_cents', 10000, 'tip_refunded_cents', 0,
                     'reversed_cents', 0, 'uncovered_cents', 500, 'status', 'needs_review'),
  'a full refund after the cashback was spent writes it as uncovered and reads needs_review'
);

select is(
  (select available_cents from wallet_balance('00000000-0000-4000-8000-0000000b3305', '00000000-0000-4000-8000-000000013305', 'mxn', false)),
  0,
  'and the balance never goes below zero'
);

-- ━━━ The cron''s give-up and the operator''s reopen ━━━━━━━━━━━━━━━━━━━━━━━━━━━

insert into public.wallet_payments (id, consumer_id, place_id, amount_cents, credit_cents, card_cents, currency, status,
                                    stripe_account_id, stripe_checkout_session_id, request_id, settle_tries)
values ('00000000-0000-4000-8000-0000000f3305', '00000000-0000-4000-8000-0000000b3305', '00000000-0000-4000-8000-000000013305',
        700, 0, 700, 'mxn', 'open', 'acct_test_3305', 'cs_gone_3305', '00000000-0000-4000-8000-00000000b003', 48);

select is(
  (select count(*)::int from wallet_settle_batch(10) where id = '00000000-0000-4000-8000-0000000f3305' and settle_tries = 49),
  1,
  'the batch hands the open row out with its tries bumped'
);

select is(
  wallet_give_up('payment', '00000000-0000-4000-8000-0000000f3305', 'resource_missing') ->> 'outcome',
  'needs_review',
  'the cron gives the row up'
);

select is(
  (select status || ':' || stripe_error || ':' || coalesce(paid_at::text, 'unpaid')
     from public.wallet_payments where id = '00000000-0000-4000-8000-0000000f3305'),
  'needs_review:resource_missing:unpaid',
  'a given-up row is needs_review with Stripe''s code and no paid_at'
);

select is(
  (select count(*)::int from wallet_settle_batch(10) where id = '00000000-0000-4000-8000-0000000f3305'),
  0,
  'and the batch no longer hands it out'
);

select is(
  wallet_reopen_settle('payment', '00000000-0000-4000-8000-0000000f3305'),
  '{"ok": true, "outcome": "reopened"}'::jsonb,
  'the operator reopens it'
);

select is(
  (select status || ':' || settle_tries || ':' || coalesce(stripe_error, 'none')
     from public.wallet_payments where id = '00000000-0000-4000-8000-0000000f3305'),
  'open:0:none',
  'back to open with zero tries, so the next tick re-reads it'
);

select is(
  wallet_reopen_settle('payment', '00000000-0000-4000-8000-0000000e3305') ->> 'code',
  'not_reopenable',
  'a paid needs_review row (an uncovered refund) is not the cron''s to re-read'
);

select is(
  wallet_place_outstanding('00000000-0000-4000-8000-000000013305', 'MXN', false),
  (select sum(amount_cents)::int from public.wallet_entries where place_id = '00000000-0000-4000-8000-000000013305' and livemode = false),
  'the place''s outstanding credit is the sum of its entries across guests'
);

select * from finish();

rollback;
