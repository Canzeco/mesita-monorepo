-- MESITA-3563 — Pay at the table T2b: the card part. One card row carries
-- the credit (held), the card bill part and the card tip; a cash bill part
-- is a second row with no credit; a double tap makes one card row; Received
-- waits for the card; a failed card bills the tab again and frees the hold;
-- a settled card pays the tab, 5% back on the card bill part only, never the
-- tip; credits for the bill and the tip by card (InKind) works.

begin;

create extension if not exists pgtap with schema public;

select plan(27);

insert into auth.users (id) values ('00000000-0000-4000-8000-0000000a3563'), ('00000000-0000-4000-8000-0000000b3563');
insert into public.consumers (id) values ('00000000-0000-4000-8000-0000000a3563'), ('00000000-0000-4000-8000-0000000b3563');
insert into public.place_profiles (id, google_name) values ('00000000-0000-4000-8000-000000013563', 'Pay Tab Card Probe');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000013563', 'mesita-3563-probe', 'active', 'generating', 'MXN');

-- Guests A and B each hold $220MX Available here.
insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, application_fee_cents, stripe_checkout_session_id)
values ('00000000-0000-4000-8000-0000000d3563', '00000000-0000-4000-8000-0000000a3563',
        '00000000-0000-4000-8000-000000013563', 20000, 'mxn', 'open', 'acct_test_3563',
        'voucher_200', 2000, 1000, 'cs_test_3563a'),
       ('00000000-0000-4000-8000-0000000e3563', '00000000-0000-4000-8000-0000000b3563',
        '00000000-0000-4000-8000-000000013563', 20000, 'mxn', 'open', 'acct_test_3563',
        'voucher_200', 2000, 1000, 'cs_test_3563b');
do $$ begin
  perform wallet_credit_purchase('00000000-0000-4000-8000-0000000d3563', 'pi_test_3563a', now() - interval '1 minute');
  perform wallet_credit_purchase('00000000-0000-4000-8000-0000000e3563', 'pi_test_3563b', now() - interval '1 minute');
end $$;

create function pg_temp.split(p_consumer uuid, p_tab uuid, p_version int, p_credit int, p_cash_bill int, p_cash_tip int,
  p_card_bill int, p_card_tip int, p_req uuid) returns jsonb language sql as $$
  select pay_tab_open_parts(p_tab, p_consumer, p_version, p_credit, p_cash_bill, p_cash_tip, p_card_bill, p_card_tip,
    p_req, null, 200, 2, now(), 'acct_test_3563', p_card_bill * 500 / 10000, 500, null, now() + interval '10 minutes')
$$;

create function pg_temp.held(p_consumer uuid) returns int language sql as $$
  select held_cents from wallet_balance(p_consumer, '00000000-0000-4000-8000-000000013563', 'mxn', false)
$$;

select ok(
  not has_function_privilege('authenticated', 'public.wallet_open_payment_pi(uuid, text)', 'EXECUTE')
    and not has_function_privilege('authenticated',
      'public.pay_tab_open_parts(uuid, uuid, integer, integer, integer, integer, integer, integer, uuid, text, integer, integer, timestamptz, text, integer, integer, text, timestamptz)',
      'EXECUTE'),
  'client roles cannot open a card part or name its PaymentIntent');

-- Guest A's tab: $300MX bill.
create temp table t on commit drop as
select (pay_tab_open('00000000-0000-4000-8000-0000000a3563', '00000000-0000-4000-8000-000000013563',
  repeat('a', 64), 'MXN', false)->>'tab_id')::uuid as id;
select pay_tab_bill(repeat('a', 64), repeat('e', 64), true, 0, 30000, 4500, 'T3', null);

-- ━━━ Refusals ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(pg_temp.split('00000000-0000-4000-8000-0000000a3563', (select id from t), 1, 0, 30000, 0, 0, 4500, gen_random_uuid())->>'code',
  'card_tip_alone', 'a tip by card with the whole bill in cash has nothing to ride on');
select is(pg_temp.split('00000000-0000-4000-8000-0000000a3563', (select id from t), 1, 25000, 0, 0, 5000, 0, gen_random_uuid())->>'code',
  'insufficient', 'more credit than the guest holds is refused on a card part too');

-- ━━━ Credit + card + cash ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create temp table p1 on commit drop as
select pg_temp.split('00000000-0000-4000-8000-0000000a3563', (select id from t), 1, 22000, 3000, 0, 5000, 4500,
  '00000000-0000-4000-8000-0000000f3563') as r;
select is((select r->>'status' from p1), 'paying', '$220MX credit + $50MX card + $30MX cash, $45MX tip by card opens');
select is(
  (select (credit_cents, card_cents, tip_cents, outside_cents, part, status, cashback_bps, application_fee_cents, stripe_account_id)::text
     from public.wallet_payments where id = (select (r->>'card_payment_id')::uuid from p1)),
  '(22000,5000,4500,0,card,opening,500,250,acct_test_3563)',
  'ONE card row: the credit, the card bill part and the card tip; 5% back and Mesita''s 5% fee on the card bill part');
select is(
  (select (credit_cents, outside_cents, part, status)::text from public.wallet_payments
    where tab_id = (select id from t) and part = 'outside'),
  '(0,3000,outside,open)', 'the cash bill part is its own row with no credit');
select is(pg_temp.held('00000000-0000-4000-8000-0000000a3563'), 22000, 'the credit is held while the card goes through');
select is(
  pg_temp.split('00000000-0000-4000-8000-0000000a3563', (select id from t), 1, 22000, 3000, 0, 5000, 4500,
    '00000000-0000-4000-8000-0000000f3563')->>'card_payment_id',
  (select r->>'card_payment_id' from p1), 'a double tap replays the same card row');
select is((select count(*)::int from public.wallet_payments where tab_id = (select id from t)), 2,
  'and makes no second row');
select is(pay_tab_cash(repeat('a', 64), repeat('e', 64), null)->>'code', 'card_pending',
  'the waiter cannot take the cash before the card went through');

-- ━━━ Naming the PaymentIntent ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(wallet_open_payment_pi((select (r->>'card_payment_id')::uuid from p1), 'pi_test3563one')->>'outcome',
  'opened', 'the PaymentIntent is named and the row reads open');
select is(wallet_open_payment_pi((select (r->>'card_payment_id')::uuid from p1), 'pi_test3563one')->>'outcome',
  'unchanged', 'naming the same PaymentIntent again is a no-op');
select is(wallet_open_payment_pi((select (r->>'card_payment_id')::uuid from p1), 'pi_test3563two')->>'code',
  'not_opening', 'a second PaymentIntent on the row is refused');

-- ━━━ The card fails: billed again, nothing held ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select wallet_release_payment((select (r->>'card_payment_id')::uuid from p1), 'failed', 'card_declined');
select is((select (status, card_bill_cents, cash_bill_cents)::text from public.pay_tabs where id = (select id from t)),
  '(billed,0,0)', 'a failed card bills the tab again so the guest can choose again');
select is((select status from public.wallet_payments where tab_id = (select id from t) and part = 'outside'),
  'expired', 'the cash part of that tap is cancelled');
select is(pg_temp.held('00000000-0000-4000-8000-0000000a3563'), 0, 'and the credit hold is released');
select is(
  pg_temp.split('00000000-0000-4000-8000-0000000a3563', (select id from t), 1, 22000, 3000, 0, 5000, 4500,
    '00000000-0000-4000-8000-0000000f3563')->>'code',
  'closed', 'the failed tap''s request id cannot be reused: a new tap starts over');

-- ━━━ A new tap: credit + card, settled ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create temp table p2 on commit drop as
select pg_temp.split('00000000-0000-4000-8000-0000000a3563', (select id from t), 1, 22000, 0, 0, 8000, 4500,
  gen_random_uuid()) as r;
select wallet_open_payment_pi((select (r->>'card_payment_id')::uuid from p2), 'pi_test3563three');
select is(wallet_settle_payment((select (r->>'card_payment_id')::uuid from p2), 'pi_test3563three')->>'outcome',
  'paid', 'Stripe says succeeded: the card row settles');
select is((select status from public.pay_tabs where id = (select id from t)), 'paid',
  'with no cash owed, the tab reads paid');
select is(
  (select (cashback_cents, confirmed_by)::text from public.wallet_payments where id = (select (r->>'card_payment_id')::uuid from p2)),
  '(400,stripe)', '5% back on the $80MX card bill part only: never the tip, never the credit');
select is(
  (select sum(amount_cents)::int from public.wallet_entries
    where payment_id = (select (r->>'card_payment_id')::uuid from p2) and kind = 'spend'),
  -22000, 'the held credit became the spend');

-- ━━━ Credits for the bill, the tip by card (InKind) ━━━━━━━━━━━━━━━━━━━━━━━━━━

create temp table u on commit drop as
select (pay_tab_open('00000000-0000-4000-8000-0000000b3563', '00000000-0000-4000-8000-000000013563',
  repeat('c', 64), 'MXN', false)->>'tab_id')::uuid as id;
select pay_tab_bill(repeat('c', 64), repeat('e', 64), true, 0, 5000, 1000, null, null);
create temp table p3 on commit drop as
select pg_temp.split('00000000-0000-4000-8000-0000000b3563', (select id from u), 1, 5000, 0, 0, 0, 1000,
  gen_random_uuid()) as r;
select is(
  (select (amount_cents, credit_cents, card_cents, tip_cents, part)::text from public.wallet_payments
    where id = (select (r->>'card_payment_id')::uuid from p3)),
  '(5000,5000,0,1000,card)', 'credits pay the $50MX bill, the card pays the $10MX tip');
select wallet_open_payment_pi((select (r->>'card_payment_id')::uuid from p3), 'pi_test3563four');
select wallet_settle_payment((select (r->>'card_payment_id')::uuid from p3), 'pi_test3563four');
select is(
  (select (status, cashback_cents, confirmed_by)::text from public.wallet_payments where id = (select (r->>'card_payment_id')::uuid from p3)),
  '(paid,0,stripe)', 'confirmed by Stripe, no cashback on a tip');
select is((select status from public.pay_tabs where id = (select id from u)), 'paid', 'and the tab reads paid');

-- ━━━ Card + cash: the card first, then Received ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create temp table w on commit drop as
select (pay_tab_open('00000000-0000-4000-8000-0000000b3563', '00000000-0000-4000-8000-000000013563',
  repeat('d', 64), 'MXN', false)->>'tab_id')::uuid as id;
select pay_tab_bill(repeat('d', 64), repeat('e', 64), true, 0, 6000, 0, null, null);
create temp table p4 on commit drop as
select pg_temp.split('00000000-0000-4000-8000-0000000b3563', (select id from w), 1, 0, 2000, 500, 4000, 0,
  gen_random_uuid()) as r;
select wallet_open_payment_pi((select (r->>'card_payment_id')::uuid from p4), 'pi_test3563five');
select wallet_settle_payment((select (r->>'card_payment_id')::uuid from p4), 'pi_test3563five');
select is((select status from public.pay_tabs where id = (select id from w)), 'paying',
  'the card went through but cash is still owed: the tab waits');
select is(pay_tab_cash(repeat('d', 64), repeat('e', 64), null)->>'outcome', 'paid',
  'Received collects the cash');
select is((select status from public.pay_tabs where id = (select id from w)), 'paid', 'and the tab reads paid');

select * from finish();
rollback;
