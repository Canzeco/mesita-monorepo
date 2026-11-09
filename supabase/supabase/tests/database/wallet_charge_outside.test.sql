-- MESITA-3545 — Payments Flow v2, step A: the waiter's charge takes a tip;
-- the outside start is capped under the pair lock (credit first, credit
-- covering the bill answers credit_covers, two outside bills a guest a day
-- at a place); a replay never reopens an expired bill; Received tells a
-- cancel from a timeout and caps the place's outside cashback per day; an
-- outside bill refunds whole without Stripe, its cashback taken back.

begin;

create extension if not exists pgtap with schema public;

select plan(27);

insert into auth.users (id) values ('00000000-0000-4000-8000-0000000a3545'), ('00000000-0000-4000-8000-0000000b3545');
insert into public.consumers (id) values ('00000000-0000-4000-8000-0000000a3545'), ('00000000-0000-4000-8000-0000000b3545');
insert into public.place_profiles (id, google_name) values ('00000000-0000-4000-8000-000000013545', 'Charge Outside Probe');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000013545', 'mesita-3545-probe', 'active', 'generating', 'MXN');

-- Guest A holds $220MX Available at the place (a $200MX voucher and its bonus).
insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, application_fee_cents, stripe_checkout_session_id)
values ('00000000-0000-4000-8000-0000000d3545', '00000000-0000-4000-8000-0000000a3545',
        '00000000-0000-4000-8000-000000013545', 20000, 'mxn', 'open', 'acct_test_3545',
        'voucher_200', 2000, 1000, 'cs_test_3545');
do $$ begin
  perform wallet_credit_purchase('00000000-0000-4000-8000-0000000d3545', 'pi_test_3545', now() - interval '1 minute');
end $$;

-- ━━━ Shape and access ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select has_column('public', 'place_charges', 'tip_cents', 'a charge carries the tip staff asked');
select has_column('public', 'wallet_payments', 'charge_amount_cents', 'a payment keeps the waiter''s bill');

select throws_ok(
  $$insert into public.place_charges (place_id, code_hash, token_hash, amount_cents, currency, expires_at, tip_cents)
    values ('00000000-0000-4000-8000-000000013545', 'c-neg', 't-neg', 100, 'mxn', now() + interval '10 minutes', -1)$$,
  '23514', null, 'a negative tip is refused');
select throws_ok(
  $$insert into public.place_charges (place_id, code_hash, token_hash, amount_cents, currency, expires_at, tip_cents)
    values ('00000000-0000-4000-8000-000000013545', 'c-big', 't-big', 100, 'mxn', now() + interval '10 minutes', 10000001)$$,
  '23514', null, 'a tip past the cap is refused');

select ok(
  not has_function_privilege('authenticated', 'public.wallet_open_outside_capped(uuid, uuid, integer, integer, text, boolean, uuid, text, text, integer, timestamptz, integer)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.wallet_refund_outside(uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.wallet_refund_outside(uuid)', 'EXECUTE'),
  'client roles cannot open a capped outside bill or refund one');

-- ━━━ The capped start ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  wallet_open_outside_capped('00000000-0000-4000-8000-0000000a3545', '00000000-0000-4000-8000-000000013545', 20000, 0,
    'mxn', false, '00000000-0000-4000-8000-0000000e3545', null, null, 200, now() + interval '30 minutes', 2)->>'code',
  'credit_covers', 'credit covering the bill leaves nothing to pay outside');

create temp table first on commit drop as
select wallet_open_outside_capped('00000000-0000-4000-8000-0000000a3545', '00000000-0000-4000-8000-000000013545', 45000, 4500,
  'mxn', false, '00000000-0000-4000-8000-0000000f3545', null, 'T1', 200, now() + interval '30 minutes', 2) as r;

select is((select r->>'outcome' from first), 'opened', 'a bill larger than the credit opens');
select is((select (r->>'credit_cents')::int from first), 22000, 'credit first: all of the guest''s $220MX');
select is((select (r->>'outside_cents')::int from first), 23000, 'the rest is paid outside');
select is(
  wallet_open_outside_capped('00000000-0000-4000-8000-0000000a3545', '00000000-0000-4000-8000-000000013545', 45000, 4500,
    'mxn', false, '00000000-0000-4000-8000-0000000f3545', null, 'T1', 200, now() + interval '30 minutes', 2)->>'outcome',
  'in_progress', 'the same request replays to the open bill');

-- A second bill today (no credit left: all outside), then the limit.
select is(
  wallet_open_outside_capped('00000000-0000-4000-8000-0000000a3545', '00000000-0000-4000-8000-000000013545', 10000, 0,
    'mxn', false, '00000000-0000-4000-8000-000000103545', null, null, 200, now() + interval '30 minutes', 2)->>'outcome',
  'opened', 'a second outside bill the same day opens');
select is(
  wallet_open_outside_capped('00000000-0000-4000-8000-0000000a3545', '00000000-0000-4000-8000-000000013545', 10000, 0,
    'mxn', false, '00000000-0000-4000-8000-000000113545', null, null, 200, now() + interval '30 minutes', 2)->>'code',
  'outside_limit', 'a third one the same day answers outside_limit');

-- ━━━ A replay never reopens an expired bill ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

update public.wallet_payments set status = 'expired', stripe_error = 'cancelled'
 where request_id = '00000000-0000-4000-8000-000000103545';
select is(
  wallet_open_outside('00000000-0000-4000-8000-0000000a3545', '00000000-0000-4000-8000-000000013545', 0, 10000, 0,
    'mxn', false, '00000000-0000-4000-8000-000000103545', null, null, 200, now() + interval '30 minutes')->>'code',
  'closed', 'a replay of a cancelled bill answers closed');
select is((select status from public.wallet_payments where request_id = '00000000-0000-4000-8000-000000103545'),
  'expired', 'and it stays closed');

-- ━━━ Received: a cancel is not a timeout ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  wallet_confirm_outside((select id from public.wallet_payments where request_id = '00000000-0000-4000-8000-000000103545'))->>'code',
  'closed', 'Received after the guest cancelled reads closed');

insert into public.wallet_payments (id, consumer_id, place_id, amount_cents, credit_cents, outside_cents, currency, status,
                                    outside_cashback_bps, expires_at)
values ('00000000-0000-4000-8000-000000123545', '00000000-0000-4000-8000-0000000b3545', '00000000-0000-4000-8000-000000013545',
        10000, 0, 10000, 'mxn', 'expired', 200, now() - interval '1 minute');
select is(
  wallet_confirm_outside('00000000-0000-4000-8000-000000123545')->>'code',
  'expired', 'Received after the 30 minutes reads expired');

-- ━━━ Received: the place's daily ceiling ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- $499MX of outside cashback already confirmed at this place today.
insert into public.wallet_payments (id, consumer_id, place_id, amount_cents, credit_cents, outside_cents, currency, status,
                                    outside_cashback_bps, cashback_cents, paid_at, confirmed_by)
values ('00000000-0000-4000-8000-000000133545', '00000000-0000-4000-8000-0000000b3545', '00000000-0000-4000-8000-000000013545',
        2495000, 0, 2495000, 'mxn', 'paid', 200, 49900, now() - interval '2 hours', 'waiter');

select is(
  wallet_confirm_outside((select (r->>'payment_id')::uuid from first))->>'cashback_cents',
  '100', 'past the daily ceiling the bill still confirms, with what is left of it');
select is(
  (select status from public.wallet_payments where id = (select (r->>'payment_id')::uuid from first)),
  'paid', 'and it is paid');

-- ━━━ Refunding an outside bill ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create temp table refund on commit drop as
select wallet_refund_outside((select (r->>'payment_id')::uuid from first)) as r;
select is((select r->>'status' from refund), 'refunded', 'an outside bill refunds whole');
select is((select (r->>'credit_refunded_cents')::int from refund), 22000, 'its credit part comes back');
select is((select (r->>'cashback_reversed_cents')::int from refund), 100, 'its cashback is taken back');
select is(
  (select row(available_cents, pending_cents)::text
     from wallet_balance('00000000-0000-4000-8000-0000000a3545', '00000000-0000-4000-8000-000000013545', 'mxn', false)),
  '(21900,100)', 'the guest holds the $220MX again: the cashback''s Pending $1MX and its reversal net to zero');
select is(
  wallet_refund_outside((select (r->>'payment_id')::uuid from first))->>'outcome',
  'already_refunded', 'a second refund changes nothing');

-- A bill with no credit part refunds too (only its cashback goes).
insert into public.wallet_payments (id, consumer_id, place_id, amount_cents, credit_cents, outside_cents, currency, status,
                                    outside_cashback_bps, cashback_cents, paid_at, confirmed_by)
values ('00000000-0000-4000-8000-000000143545', '00000000-0000-4000-8000-0000000b3545', '00000000-0000-4000-8000-000000013545',
        10000, 0, 10000, 'mxn', 'paid', 200, 200, now(), 'waiter');
insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
values ('00000000-0000-4000-8000-0000000b3545', '00000000-0000-4000-8000-000000013545', 'cashback', 200, 'mxn',
        '00000000-0000-4000-8000-000000143545', false, now() + interval '1 hour');
select is(wallet_refund_outside('00000000-0000-4000-8000-000000143545')->>'status', 'refunded',
  'a bill with no credit part refunds');
select is(
  (select coalesce(sum(amount_cents), 0)::int from public.wallet_entries where payment_id = '00000000-0000-4000-8000-000000143545'),
  0, 'its Pending cashback is taken back');

select is(wallet_refund_outside('00000000-0000-4000-8000-000000123545')->>'code', 'not_paid',
  'an unconfirmed bill has nothing to refund');
insert into public.wallet_payments (id, consumer_id, place_id, amount_cents, credit_cents, currency, status, paid_at)
values ('00000000-0000-4000-8000-000000153545', '00000000-0000-4000-8000-0000000b3545', '00000000-0000-4000-8000-000000013545',
        100, 100, 'mxn', 'paid', now());
select is(wallet_refund_outside('00000000-0000-4000-8000-000000153545')->>'code', 'not_outside',
  'a credit-only payment never goes through it');

select * from finish();

rollback;
