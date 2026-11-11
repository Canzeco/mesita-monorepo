-- MESITA-3707 — Guest pays, waiter verifies. The guest's tap is one guest
-- tab (a replay is the same tab; any refusal leaves nothing; at most three
-- paying here); the waiter's one-open rule ignores guest tabs; Verify
-- confirms cash once (place-bound, window-bound, card-aware); cancel and the
-- cron close never lose or double money; only the service role calls it.

begin;

create extension if not exists pgtap with schema public;

select plan(40);

insert into auth.users (id) values ('00000000-0000-4000-8000-0000000a3707'), ('00000000-0000-4000-8000-0000000b3707');
insert into public.consumers (id) values ('00000000-0000-4000-8000-0000000a3707'), ('00000000-0000-4000-8000-0000000b3707');
insert into public.place_profiles (id, google_name) values
  ('00000000-0000-4000-8000-000000013707', 'Guest Pay Probe'),
  ('00000000-0000-4000-8000-000000023707', 'Guest Pay Other');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000013707', 'mesita-3707-probe', 'active', 'generating', 'MXN'),
  ('00000000-0000-4000-8000-000000023707', 'mesita-3707-other', 'active', 'generating', 'MXN');

-- Guest A holds $220MX Available at the probe place.
insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, application_fee_cents, stripe_checkout_session_id)
values ('00000000-0000-4000-8000-0000000d3707', '00000000-0000-4000-8000-0000000a3707',
        '00000000-0000-4000-8000-000000013707', 20000, 'mxn', 'open', 'acct_test_3707',
        'voucher_200', 2000, 1000, 'cs_test_3707');
insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, application_fee_cents, stripe_checkout_session_id)
values ('00000000-0000-4000-8000-0000000f3707', '00000000-0000-4000-8000-0000000b3707',
        '00000000-0000-4000-8000-000000013707', 20000, 'mxn', 'open', 'acct_test_3707',
        'voucher_200', 2000, 1000, 'cs_test_3707b');
do $$ begin
  perform wallet_credit_purchase('00000000-0000-4000-8000-0000000d3707', 'pi_test_3707', now() - interval '1 minute');
  perform wallet_credit_purchase('00000000-0000-4000-8000-0000000f3707', 'pi_test_3707b', now() - interval '1 minute');
end $$;

create function pg_temp.spendable(p uuid default '00000000-0000-4000-8000-0000000a3707') returns integer language sql as $$
  select spendable_cents from wallet_balance(p, '00000000-0000-4000-8000-000000013707', 'mxn', false)
$$;

-- ━━━ Shape and access ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select has_column('public', 'pay_tabs', 'origin', 'a tab says who started it');
select ok(
  not has_function_privilege('authenticated', 'public.pay_tab_guest_pay(uuid, uuid, text, boolean, text, integer, integer, integer, integer, integer, integer, uuid, text, integer, timestamptz, text, integer, integer, text, timestamptz, interval, integer)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.pay_tab_verify(uuid, uuid, text, integer, timestamptz)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.pay_tab_verify(uuid, uuid, text, integer, timestamptz)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.pay_tab_guest_remint(uuid, uuid, text, timestamptz)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.pay_tabs_close_guest(timestamptz, integer)', 'EXECUTE'),
  'client roles cannot call the guest pay functions');

-- ━━━ The guest's tap ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- A waiter tab still waiting for its bill, opened earlier by guest A here.
create temp table w1 on commit drop as
select pay_tab_open('00000000-0000-4000-8000-0000000a3707', '00000000-0000-4000-8000-000000013707',
  repeat('0', 64), 'MXN', false) as r;

-- Tap 1: $50MX all by credit.
create temp table g1 on commit drop as
select pay_tab_guest_pay('00000000-0000-4000-8000-0000000a3707', '00000000-0000-4000-8000-000000013707', 'MXN', false,
  repeat('1', 64), 5000, 5000, 0, 0, 0, 0, '00000000-0000-4000-8000-0000000e3701', null, 200) as r;
select is((select r->>'status' from g1), 'paid', 'a credit-only guest payment is paid at once');
select is((select origin from pay_tabs where id = (select (r->>'tab_id')::uuid from g1)), 'guest', 'it is a guest tab');
select is((select status from pay_tabs where id = (select (r->>'tab_id')::uuid from w1)), 'cancelled',
  'the guest''s own waiter tab still waiting for a bill is cancelled');
select is(pg_temp.spendable(), 17000, 'the credit is spent: $170MX left');

-- The same tap again (a lost answer): the same tab, no second spend, new QR.
select is(
  pay_tab_guest_pay('00000000-0000-4000-8000-0000000a3707', '00000000-0000-4000-8000-000000013707', 'MXN', false,
    repeat('2', 64), 5000, 5000, 0, 0, 0, 0, '00000000-0000-4000-8000-0000000e3701', null, 200)->>'outcome',
  'replayed', 'the same request id replays its tab');
select is(pg_temp.spendable(), 17000, 'and spends nothing again');
select is((select token_hash from pay_tabs where id = (select (r->>'tab_id')::uuid from g1)), repeat('2', 64),
  'the replay''s QR replaces the lost one');

-- A refused tap leaves nothing.
select throws_like(
  $$select pay_tab_guest_pay('00000000-0000-4000-8000-0000000a3707', '00000000-0000-4000-8000-000000013707', 'MXN', false,
      repeat('3', 64), 99000, 99000, 0, 0, 0, 0, '00000000-0000-4000-8000-0000000e3702', null, 200)$$,
  'guest_refused:%insufficient%', 'more credit than spendable is refused');
select is((select count(*)::int from pay_tabs where token_hash = repeat('3', 64)), 0, 'and no tab survives the refusal');
select throws_like(
  $$select pay_tab_guest_pay('00000000-0000-4000-8000-0000000a3707', '00000000-0000-4000-8000-000000013707', 'MXN', false,
      repeat('4', 64), 10000, 0, 10000, 0, 0, 2000, '00000000-0000-4000-8000-0000000e3703', null, 200, now(), 'acct_test_3707',
      0, 500, null, now() + interval '10 minutes')$$,
  'guest_refused:%card_tip_alone%', 'a tip by card with the whole bill in cash is refused');

-- Tap 2: $150MX bill, $100MX credit held + $50MX cash, $10MX cash tip.
create temp table g2 on commit drop as
select pay_tab_guest_pay('00000000-0000-4000-8000-0000000a3707', '00000000-0000-4000-8000-000000013707', 'MXN', false,
  repeat('5', 64), 15000, 10000, 5000, 1000, 0, 0, '00000000-0000-4000-8000-0000000e3704', null, 200) as r;
select is((select r->>'status' from g2), 'paying', 'credit + cash waits for the waiter');
select ok(
  (select expires_at from pay_tabs where id = (select (r->>'tab_id')::uuid from g2)) > now() + interval '2 hours 59 minutes'
    and (select w.expires_at = t.expires_at from wallet_payments w join pay_tabs t on t.id = w.tab_id
          where w.tab_id = (select (r->>'tab_id')::uuid from g2) and w.part = 'outside'),
  'the tab and its cash row share one three-hour window');
select is(pg_temp.spendable(), 7000, 'the $100MX credit is held');

-- A second open guest tab at the same place is fine; the waiter's rule is theirs.
select lives_ok(
  $$select pay_tab_open('00000000-0000-4000-8000-0000000a3707', '00000000-0000-4000-8000-000000013707',
      repeat('6', 64), 'MXN', false)$$,
  'a waiter tab can open next to a paying guest tab');
select is(
  (select status from pay_tabs where id = (select (r->>'tab_id')::uuid from g2)), 'paying',
  'and the waiter''s open leaves the guest tab untouched');

-- ━━━ Verify ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(pay_tab_verify((select (r->>'tab_id')::uuid from g2), '00000000-0000-4000-8000-000000023707', repeat('a', 64))->>'code',
  'forbidden', 'a staff phone of another place cannot verify');
select is(pay_tab_verify((select (r->>'tab_id')::uuid from g2), '00000000-0000-4000-8000-000000013707', repeat('a', 64), 4000)->>'code',
  'short', 'less cash than the cash bill part is short and writes nothing');
select is(pay_tab_change((select (r->>'tab_id')::uuid from g2), '00000000-0000-4000-8000-0000000a3707', 'change')->>'code',
  'guest_tab', 'a guest tab is never billed again');

create temp table v2 on commit drop as
select pay_tab_verify((select (r->>'tab_id')::uuid from g2), '00000000-0000-4000-8000-000000013707', repeat('a', 64)) as r;
select is((select r->>'outcome' from v2), 'verified', 'the waiter verifies the cash');
select is((select (r->>'cashback_cents')::int from v2), 100, '2% of the $50MX cash bill part comes back');
select is((select status from pay_tabs where id = (select (r->>'tab_id')::uuid from g2)), 'paid', 'the tab is paid');
select ok((select r->>'outcome' = 'already_verified' and (r->>'same_phone')::boolean
           from (select pay_tab_verify((select (r->>'tab_id')::uuid from g2), '00000000-0000-4000-8000-000000013707', repeat('a', 64)) as r) x),
  'a second Verify moves no money and knows it was this phone');
select is((select (pay_tab_verify((select (r->>'tab_id')::uuid from g2), '00000000-0000-4000-8000-000000013707', repeat('b', 64))->>'same_phone')::boolean),
  false, 'another phone reads it was verified elsewhere');
select is(pay_tab_change((select (r->>'tab_id')::uuid from g2), '00000000-0000-4000-8000-0000000a3707', 'cancel')->>'code',
  'verified', 'a verified tab cannot be cancelled');

-- ━━━ Cancel, card in flight, the cap ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Tap 3: $30MX credit + $20MX cash, then cancelled: the hold comes back.
create temp table g3 on commit drop as
select pay_tab_guest_pay('00000000-0000-4000-8000-0000000a3707', '00000000-0000-4000-8000-000000013707', 'MXN', false,
  repeat('7', 64), 5000, 3000, 2000, 0, 0, 0, '00000000-0000-4000-8000-0000000e3705', null, 200) as r;
select is(pay_tab_change((select (r->>'tab_id')::uuid from g3), '00000000-0000-4000-8000-0000000a3707', 'cancel')->>'outcome',
  'cancelled', 'the guest cancels before anything moved');
select is(pg_temp.spendable(), 7000, 'and the held credit is free again');

-- Tap 4: by card (the card row stays opening, as before the PaymentIntent).
create temp table g4 on commit drop as
select pay_tab_guest_pay('00000000-0000-4000-8000-0000000a3707', '00000000-0000-4000-8000-000000013707', 'MXN', false,
  repeat('8', 64), 20000, 0, 0, 0, 20000, 0, '00000000-0000-4000-8000-0000000e3706', null, 200, now(), 'acct_test_3707',
  1000, 500, null, now() + interval '10 minutes') as r;
select is(pay_tab_verify((select (r->>'tab_id')::uuid from g4), '00000000-0000-4000-8000-000000013707', repeat('a', 64))->>'code',
  'card_pending', 'Verify waits for a card still going through');
select is(pay_tab_change((select (r->>'tab_id')::uuid from g4), '00000000-0000-4000-8000-0000000a3707', 'cancel')->>'code',
  'card_pending', 'and so does cancel');
update wallet_payments set status = 'failed' where tab_id = (select (r->>'tab_id')::uuid from g4) and part = 'card';
select is((select status from pay_tabs where id = (select (r->>'tab_id')::uuid from g4)), 'cancelled',
  'a guest tab whose card fails with nothing paid is cancelled, never billed again');

-- Three paying guest tabs here is the most.
do $$ begin
  perform pay_tab_guest_pay('00000000-0000-4000-8000-0000000a3707', '00000000-0000-4000-8000-000000013707', 'MXN', false,
    repeat('9', 64), 1000, 0, 1000, 0, 0, 0, gen_random_uuid(), null, 200);
  perform pay_tab_guest_pay('00000000-0000-4000-8000-0000000a3707', '00000000-0000-4000-8000-000000013707', 'MXN', false,
    repeat('c', 64), 1000, 0, 1000, 0, 0, 0, gen_random_uuid(), null, 200);
  perform pay_tab_guest_pay('00000000-0000-4000-8000-0000000a3707', '00000000-0000-4000-8000-000000013707', 'MXN', false,
    repeat('d', 64), 1000, 0, 1000, 0, 0, 0, gen_random_uuid(), null, 200);
end $$;
select throws_like(
  $$select pay_tab_guest_pay('00000000-0000-4000-8000-0000000a3707', '00000000-0000-4000-8000-000000013707', 'MXN', false,
      repeat('e', 64), 1000, 0, 1000, 0, 0, 0, gen_random_uuid(), null, 200)$$,
  'guest_refused:%too_many_open%', 'a fourth paying guest tab here is refused');

-- ━━━ The cron close ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Tap 5: guest B, $40MX credit + $10MX cash, never verified; the window passes.
create temp table g5 on commit drop as
select pay_tab_guest_pay('00000000-0000-4000-8000-0000000b3707', '00000000-0000-4000-8000-000000013707', 'MXN', false,
  repeat('f', 64), 5000, 4000, 1000, 0, 0, 0, '00000000-0000-4000-8000-0000000e3707', null, 200) as r;
select is(pg_temp.spendable('00000000-0000-4000-8000-0000000b3707'), 18000, 'guest B''s $40MX credit is held');
update pay_tabs set expires_at = now() - interval '1 minute'
 where place_id = '00000000-0000-4000-8000-000000013707' and origin = 'guest' and status = 'paying';
select is(pay_tabs_close_guest(), 4, 'the cron closes the four guest tabs past their window');
select is((select status from pay_tabs where token_hash = repeat('9', 64)), 'expired',
  'a cash-only tab nobody verified closes expired, with no cashback');
select is(pay_tab_verify((select id from pay_tabs where token_hash = repeat('c', 64)), '00000000-0000-4000-8000-000000013707', repeat('a', 64))->>'code',
  'expired', 'Verify after the close answers expired');
select is((select status from pay_tabs where token_hash = repeat('f', 64)), 'paid',
  'a credit + cash tab nobody verified closes paid: the declared credit is spent');
select is(pg_temp.spendable('00000000-0000-4000-8000-0000000b3707'), 18000, 'guest B''s $40MX is spent, not given back');
select is((select coalesce(sum(cashback_cents), 0)::int from wallet_payments where tab_id = (select (r->>'tab_id')::uuid from g5)),
  0, 'and earns no cashback');
select is(pg_temp.spendable(), 7000, 'closing guest A''s cash-only tabs moves no credit');

select * from finish();
rollback;
