-- MESITA-3544 — Payments Flow v2, step 2: a bill paid outside Mesita. The
-- credit part is held like a card part; the waiter's Received (one RPC, no
-- Stripe) turns it into the spend and writes 2% of the outside part as the
-- same cashback entry kind, Pending one hour; the tip never earns; a second
-- Received writes nothing; an unconfirmed bill expires with nothing born and
-- its hold released; the Stripe cron never takes an outside bill; every paid
-- row names its confirmer; client roles run none of it.

begin;

create extension if not exists pgtap with schema public;

select plan(24);

insert into auth.users (id) values ('00000000-0000-4000-8000-0000000a3544');
insert into public.consumers (id) values ('00000000-0000-4000-8000-0000000a3544');
insert into public.place_profiles (id, google_name) values
  ('00000000-0000-4000-8000-000000013544', 'Outside Probe');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000013544', 'mesita-3544-probe', 'active', 'generating', 'MXN');

-- The guest holds MX$220 Available at the place (a MX$200 voucher and its
-- bonus, the hour already gone).
insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, application_fee_cents, stripe_checkout_session_id)
values ('00000000-0000-4000-8000-0000000d3544', '00000000-0000-4000-8000-0000000a3544',
        '00000000-0000-4000-8000-000000013544', 20000, 'mxn', 'open', 'acct_test_3544',
        'voucher_200', 2000, 1000, 'cs_test_3544');
do $$ begin
  perform wallet_credit_purchase('00000000-0000-4000-8000-0000000d3544', 'pi_test_3544', now() - interval '1 minute');
end $$;

-- ━━━ Shape and access ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select has_column('public', 'wallet_payments', 'outside_cents', 'payments record the part paid outside Mesita');
select has_column('public', 'wallet_payments', 'confirmed_by', 'payments record who confirmed them');

select ok(
  not has_function_privilege('authenticated', 'public.wallet_open_outside(uuid, uuid, integer, integer, integer, text, boolean, uuid, text, text, integer, timestamptz)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.wallet_confirm_outside(uuid, timestamptz)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.wallet_confirm_outside(uuid, timestamptz)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.wallet_expire_outside(timestamptz)', 'EXECUTE'),
  'client roles cannot open, confirm or expire an outside bill'
);

select throws_ok(
  $$insert into public.wallet_payments (consumer_id, place_id, amount_cents, credit_cents, card_cents, outside_cents, currency,
                                        status, stripe_account_id)
    values ('00000000-0000-4000-8000-0000000a3544', '00000000-0000-4000-8000-000000013544', 2000, 0, 1000, 1000, 'mxn',
            'opening', 'acct_test_3544')$$,
  '23514', null,
  'one bill is card or outside, never both'
);

select throws_ok(
  $$insert into public.wallet_payments (consumer_id, place_id, amount_cents, credit_cents, card_cents, outside_cents, currency, status)
    values ('00000000-0000-4000-8000-0000000a3544', '00000000-0000-4000-8000-000000013544', 1000, 0, 0, 999, 'mxn', 'open')$$,
  '23514', null,
  'the amount is credit + card + outside'
);

-- ━━━ Open ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  wallet_open_outside('00000000-0000-4000-8000-0000000a3544', '00000000-0000-4000-8000-000000013544', 30000, 30000, 0,
                      'mxn', false, '00000000-0000-4000-8000-0000000e3544', null, null, 200, now() + interval '10 minutes')->>'code',
  'insufficient',
  'more credit than spendable is insufficient'
);

-- MX$500 bill: MX$220 from credit, MX$280 outside, MX$50 tip outside.
create temp table probe on commit drop as
select (wallet_open_outside('00000000-0000-4000-8000-0000000a3544', '00000000-0000-4000-8000-000000013544', 22000, 28000, 5000,
                            'mxn', false, '00000000-0000-4000-8000-0000000f3544', null, 'T7', 200,
                            now() + interval '10 minutes')->>'payment_id')::uuid as id;

select is(
  (select status from public.wallet_payments where id = (select id from probe)),
  'open',
  'an outside bill opens waiting for the waiter'
);

select is(
  (select held_cents from wallet_balance('00000000-0000-4000-8000-0000000a3544', '00000000-0000-4000-8000-000000013544', 'mxn', false)),
  22000,
  'its credit part is held at once'
);

select is(
  wallet_open_outside('00000000-0000-4000-8000-0000000a3544', '00000000-0000-4000-8000-000000013544', 22000, 28000, 5000,
                      'mxn', false, '00000000-0000-4000-8000-0000000f3544', null, 'T7', 200, now() + interval '10 minutes')->>'outcome',
  'in_progress',
  'the same request replays to the open bill'
);

select is(
  (select count(*)::int from wallet_settle_batch(100) b where b.id = (select id from probe)),
  0,
  'the Stripe cron never takes an outside bill'
);

-- ━━━ The waiter's Received ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  wallet_confirm_outside((select id from probe))->>'cashback_cents',
  '560',
  'Received writes 2% of the outside part (MX$280 → MX$5.60), not of the tip or the credit'
);

select is(
  (select confirmed_by from public.wallet_payments where id = (select id from probe)),
  'waiter',
  'the bill names the waiter as its confirmer'
);

select is(
  (select array_agg(kind || ':' || amount_cents order by amount_cents) from public.wallet_entries
    where payment_id = (select id from probe)),
  array['spend:-22000', 'cashback:560'],
  'the hold became the spend, and the cashback is the same entry kind as a card part''s'
);

select is(
  (select row(available_cents, pending_cents, held_cents)::text
     from wallet_balance('00000000-0000-4000-8000-0000000a3544', '00000000-0000-4000-8000-000000013544', 'mxn', false)),
  '(0,560,0)',
  'the credit is spent, the hold released, the cashback Pending'
);

select is(
  (select available_cents from wallet_balance('00000000-0000-4000-8000-0000000a3544', '00000000-0000-4000-8000-000000013544',
                                              'mxn', false, now() + interval '61 minutes')),
  560,
  'an hour later the cashback spends at the next visit'
);

select is(
  wallet_confirm_outside((select id from probe))->>'outcome',
  'already_paid',
  'a second Received answers already_paid'
);

select is(
  (select count(*)::int from public.wallet_entries where payment_id = (select id from probe)),
  2,
  'and writes nothing'
);

-- ━━━ Nobody confirms ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

insert into public.wallet_payments (id, consumer_id, place_id, amount_cents, credit_cents, outside_cents, currency, status,
                                    outside_cashback_bps, expires_at)
values ('00000000-0000-4000-8000-000000103544', '00000000-0000-4000-8000-0000000a3544', '00000000-0000-4000-8000-000000013544',
        10000, 0, 10000, 'mxn', 'open', 200, now() - interval '1 minute'),
       ('00000000-0000-4000-8000-000000113544', '00000000-0000-4000-8000-0000000a3544', '00000000-0000-4000-8000-000000013544',
        10000, 0, 10000, 'mxn', 'open', 200, now() - interval '1 minute');

select is(
  wallet_confirm_outside('00000000-0000-4000-8000-000000103544')->>'code',
  'expired',
  'a Received after the expiry is refused'
);

select is(
  (select count(*)::int from public.wallet_entries where payment_id = '00000000-0000-4000-8000-000000103544'),
  0,
  'and nothing is born'
);

-- Two statements: a check in the same statement would read the row before
-- the function's update.
select ok(wallet_expire_outside() >= 1, 'the sweep expires outside bills past their expiry');

select is(
  (select status from public.wallet_payments where id = '00000000-0000-4000-8000-000000113544'),
  'expired',
  'an outside bill nobody confirmed closes expired'
);

-- MESITA-3545: a bill the sweep closed is a timeout (expired), not a
-- guest's cancel (closed).
select is(
  wallet_confirm_outside('00000000-0000-4000-8000-000000113544')->>'code',
  'expired',
  'a bill that timed out cannot be confirmed'
);

-- ━━━ Every paid row names its confirmer ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

insert into public.wallet_payments (id, consumer_id, place_id, amount_cents, credit_cents, currency, status, paid_at)
values ('00000000-0000-4000-8000-000000123544', '00000000-0000-4000-8000-0000000a3544', '00000000-0000-4000-8000-000000013544',
        100, 100, 'mxn', 'paid', now());

select is(
  (select confirmed_by from public.wallet_payments where id = '00000000-0000-4000-8000-000000123544'),
  'credit',
  'a credit-only payment is confirmed by the ledger itself'
);

select is(
  wallet_confirm_outside('00000000-0000-4000-8000-000000123544')->>'code',
  'not_outside',
  'Received only confirms an outside bill'
);

select * from finish();

rollback;
