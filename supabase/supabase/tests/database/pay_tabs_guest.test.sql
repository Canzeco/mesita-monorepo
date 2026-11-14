-- MESITA-3707 — Guest pays, waiter verifies. The guest's tap is one guest
-- tab (a replay is the same tab; any refusal leaves nothing); the waiter's
-- one-open rule ignores guest tabs; Verify confirms cash once (place-bound,
-- window-bound, card-aware); cancel and the cron close never lose or double
-- money; only the service role calls it.
-- MESITA-3772 — one open guest payment per guest at any place (paid but
-- unsigned counts; signed, closed and cancelled do not); a card earns its
-- cashback only when the waiter signs, once; the guest closes a payment
-- where money moved, with no cashback; a signed payment cannot be closed.
-- MESITA-3776 — the guest's ticket number: stored as typed, compared
-- normalised; another guest's payment of the same ticket here in 12 hours
-- asks first (p_repeat_ok), the guest's own refuses; waiter tabs, other
-- places and older payments never warn.
-- MESITA-3843 — nothing is final until the waiter signs: a credits-only bill
-- holds its credit; Reject, X and the ten-minute window release it; the
-- signature spends it once; Cash Payments Cashback is Off or 3%.

begin;

create extension if not exists pgtap with schema public;

select plan(102);

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

-- The message a call raises (null when it does not).
create function pg_temp.refusal(q text) returns text language plpgsql as $$
begin
  execute q;
  return null;
exception when others then
  return sqlerrm;
end $$;

create function pg_temp.cashback_rows(t uuid) returns integer language sql as $$
  select count(*)::int from wallet_entries e join wallet_payments w on w.id = e.payment_id
   where w.tab_id = t and e.kind = 'cashback'
$$;

create function pg_temp.spendable(p uuid default '00000000-0000-4000-8000-0000000a3707') returns integer language sql as $$
  select spendable_cents from wallet_balance(p, '00000000-0000-4000-8000-000000013707', 'mxn', false)
$$;

-- ━━━ Shape and access ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select has_column('public', 'pay_tabs', 'origin', 'a tab says who started it');
select ok(
  not has_function_privilege('authenticated', 'public.pay_tab_guest_pay(uuid, uuid, text, boolean, text, integer, integer, integer, integer, integer, integer, uuid, text, integer, timestamptz, text, integer, integer, text, timestamptz, interval, integer, text, boolean)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.pay_tab_verify(uuid, uuid, text, integer, timestamptz)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.pay_tab_verify(uuid, uuid, text, integer, timestamptz)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.pay_tab_guest_remint(uuid, uuid, text, timestamptz)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.pay_tabs_close_guest(timestamptz, integer)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.pay_tab_guest_end(uuid, timestamptz)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.pay_tab_card_cashback(uuid, timestamptz)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.pay_ticket_norm(text)', 'EXECUTE'),
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
select is((select r->>'status' from g1), 'paying', 'a credit-only guest payment waits for the waiter (MESITA-3843)');
select is((select origin from pay_tabs where id = (select (r->>'tab_id')::uuid from g1)), 'guest', 'it is a guest tab');
select is((select status from pay_tabs where id = (select (r->>'tab_id')::uuid from w1)), 'cancelled',
  'the guest''s own waiter tab still waiting for a bill is cancelled');
select is(pg_temp.spendable(), 17000, 'the credit is held: $170MX spendable');

-- The same tap again (a lost answer): the same tab, no second spend, new QR.
select is(
  pay_tab_guest_pay('00000000-0000-4000-8000-0000000a3707', '00000000-0000-4000-8000-000000013707', 'MXN', false,
    repeat('2', 64), 5000, 5000, 0, 0, 0, 0, '00000000-0000-4000-8000-0000000e3701', null, 200)->>'outcome',
  'replayed', 'the same request id replays its tab');
select is(pg_temp.spendable(), 17000, 'and spends nothing again');
select is((select token_hash from pay_tabs where id = (select (r->>'tab_id')::uuid from g1)), repeat('2', 64),
  'the replay''s QR replaces the lost one');

-- MESITA-3772: the paid, unsigned tap 1 is guest A's one open payment.
select throws_like(
  $$select pay_tab_guest_pay('00000000-0000-4000-8000-0000000a3707', '00000000-0000-4000-8000-000000023707', 'MXN', false,
      repeat('0', 63) || '1', 1000, 0, 1000, 0, 0, 0, gen_random_uuid(), null, 200)$$,
  'guest_refused:%too_many_open%', 'a second open guest payment at ANOTHER place is refused');
select is(
  (select (regexp_match(e, 'guest_refused:(.*)$'))[1]::jsonb->>'open_tab_id'
     from (select pg_temp.refusal($$select pay_tab_guest_pay('00000000-0000-4000-8000-0000000a3707', '00000000-0000-4000-8000-000000023707', 'MXN', false,
       repeat('0', 63) || '1', 1000, 0, 1000, 0, 0, 0, gen_random_uuid(), null, 200)$$) as e) x),
  (select r->>'tab_id' from g1), 'the refusal names the open payment');
select is((pay_tab_verify((select (r->>'tab_id')::uuid from g1), '00000000-0000-4000-8000-000000013707', repeat('a', 64))->>'cashback_cents')::int,
  0, 'the waiter signs the credit-only tap 1: credits earn nothing');
select is((select count(*)::int from wallet_entries e join wallet_payments w on w.id = e.payment_id
            where w.tab_id = (select (r->>'tab_id')::uuid from g1) and e.kind = 'spend' and e.amount_cents = -5000),
  1, 'the signature spends the held $50MX once (MESITA-3843)');
select is(pg_temp.spendable(), 17000, 'and the balance is the same: held became spent');

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
select is(pg_temp.spendable(), 7100, 'and the held credit is free again (plus tap 2''s $1MX cashback, Available at once since MESITA-3909)');

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

-- ━━━ MESITA-3772: the card earns only when the waiter signs ━━━━━━━━━━━━━━━━━

-- Tap 6: $200MX by card, 5% card cashback; the card settles before signing.
create temp table g6 on commit drop as
select pay_tab_guest_pay('00000000-0000-4000-8000-0000000a3707', '00000000-0000-4000-8000-000000013707', 'MXN', false,
  repeat('6', 63) || '0', 20000, 0, 0, 0, 20000, 0, '00000000-0000-4000-8000-0000000e3708', null, 200, now(), 'acct_test_3707',
  1000, 500, null, now() + interval '10 minutes') as r;
select is((wallet_settle_payment((select (r->>'card_payment_id')::uuid from g6), 'pi_test_3772')->>'cashback_cents')::int, 0,
  'a card settling on an unsigned guest tab earns nothing yet');
select is(pg_temp.cashback_rows((select (r->>'tab_id')::uuid from g6)), 0, 'and writes no cashback entry');
select is((select status from pay_tabs where id = (select (r->>'tab_id')::uuid from g6)), 'paid', 'the card-only tab reads paid');
select throws_like(
  $$select pay_tab_guest_pay('00000000-0000-4000-8000-0000000a3707', '00000000-0000-4000-8000-000000023707', 'MXN', false,
      repeat('0', 63) || '2', 1000, 0, 1000, 0, 0, 0, gen_random_uuid(), null, 200)$$,
  'guest_refused:%too_many_open%', 'a paid, unsigned card tab still counts as open');
select is(wallet_settle_payment((select (r->>'card_payment_id')::uuid from g6), 'pi_test_3772')->>'outcome', 'already_paid',
  'a second settle is a replay');
select is(pg_temp.cashback_rows((select (r->>'tab_id')::uuid from g6)), 0, 'and still writes nothing');

create temp table v6 on commit drop as
select pay_tab_verify((select (r->>'tab_id')::uuid from g6), '00000000-0000-4000-8000-000000013707', repeat('a', 64)) as r;
select is((select (r->>'cashback_cents')::int from v6), 1000, 'the signature writes 5% of the $200MX card part');
select is(pg_temp.cashback_rows((select (r->>'tab_id')::uuid from g6)), 1, 'as one cashback entry');
select is((select cashback_cents from wallet_payments where id = (select (r->>'card_payment_id')::uuid from g6)), 1000,
  'and the card row says what it earned');
select is(pay_tab_verify((select (r->>'tab_id')::uuid from g6), '00000000-0000-4000-8000-000000013707', repeat('a', 64))->>'outcome',
  'already_verified', 'signing twice moves no money');
select is(pay_tab_card_cashback((select (r->>'tab_id')::uuid from g6)), 0, 'the card cashback is never written twice');
select is(pg_temp.cashback_rows((select (r->>'tab_id')::uuid from g6)), 1, 'one entry, still');
select is(pay_tab_change((select (r->>'tab_id')::uuid from g6), '00000000-0000-4000-8000-0000000a3707', 'close')->>'code',
  'verified', 'a signed tab cannot be closed');
select is(pay_tab_change((select (r->>'tab_id')::uuid from g6), '00000000-0000-4000-8000-0000000a3707', 'cancel')->>'code',
  'verified', 'nor cancelled');

-- Signed, it no longer counts: the next tap opens.
select lives_ok(
  $$select pay_tab_guest_pay('00000000-0000-4000-8000-0000000a3707', '00000000-0000-4000-8000-000000013707', 'MXN', false,
      repeat('9', 64), 1000, 0, 1000, 0, 0, 0, gen_random_uuid(), null, 200)$$,
  'a signed payment no longer counts as open');

-- ━━━ The cron close ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Tap 5: guest B, $40MX credit + $10MX cash, never verified; the window passes.
create temp table g5 on commit drop as
select pay_tab_guest_pay('00000000-0000-4000-8000-0000000b3707', '00000000-0000-4000-8000-000000013707', 'MXN', false,
  repeat('f', 64), 5000, 4000, 1000, 0, 0, 0, '00000000-0000-4000-8000-0000000e3707', null, 200) as r;
select is(pg_temp.spendable('00000000-0000-4000-8000-0000000b3707'), 18000, 'guest B''s $40MX credit is held');
update pay_tabs set expires_at = now() - interval '1 minute'
 where place_id = '00000000-0000-4000-8000-000000013707' and origin = 'guest' and status = 'paying';
select is(pay_tabs_close_guest(), 2, 'the cron closes the two guest tabs past their window');
select is((select status from pay_tabs where token_hash = repeat('9', 64)), 'expired',
  'a cash-only tab nobody verified closes expired, with no cashback');
select is(pay_tab_verify((select id from pay_tabs where token_hash = repeat('9', 64)), '00000000-0000-4000-8000-000000013707', repeat('a', 64))->>'code',
  'expired', 'Verify after the close answers expired');
select ok((select status = 'expired' and end_reason = 'expired' from pay_tabs where token_hash = repeat('f', 64)),
  'a credit + cash tab nobody verified closes expired (MESITA-3843)');
select is(pg_temp.spendable('00000000-0000-4000-8000-0000000b3707'), 22000, 'guest B''s $40MX is released, never spent unsigned');
select is((select coalesce(sum(cashback_cents), 0)::int from wallet_payments where tab_id = (select (r->>'tab_id')::uuid from g5)),
  0, 'and earns no cashback');
select is(pg_temp.spendable(), 8100, 'closing guest A''s cash-only tab moves no credit');

-- ━━━ MESITA-3772: the guest closes ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Tap 7: $150MX, $100MX by card (settled) + $50MX cash; the cron closed tap 9,
-- so this one opens.
create temp table g7 on commit drop as
select pay_tab_guest_pay('00000000-0000-4000-8000-0000000a3707', '00000000-0000-4000-8000-000000013707', 'MXN', false,
  repeat('7', 63) || '0', 15000, 0, 5000, 0, 10000, 0, '00000000-0000-4000-8000-0000000e3709', null, 200, now(), 'acct_test_3707',
  500, 500, null, now() + interval '10 minutes') as r;
select ok((select r->>'tab_id' from g7) is not null, 'a closed tab no longer counts as open');
select is(wallet_settle_payment((select (r->>'card_payment_id')::uuid from g7), 'pi_test_3772b')->>'outcome', 'paid', 'the card part settles');
select is(pay_tab_change((select (r->>'tab_id')::uuid from g7), '00000000-0000-4000-8000-0000000a3707', 'cancel')->>'code',
  'paid_part', 'money moved: cancel is refused');
select is(pay_tab_change((select (r->>'tab_id')::uuid from g7), '00000000-0000-4000-8000-0000000a3707', 'close')->>'outcome',
  'closed', 'the guest closes it');
select ok((select status = 'paid' and expires_at <= now() from pay_tabs where id = (select (r->>'tab_id')::uuid from g7)),
  'it ends now and reads paid');
select is((select stripe_error from wallet_payments where tab_id = (select (r->>'tab_id')::uuid from g7) and part = 'outside'),
  'not_verified', 'its cash part expires unverified');
select is(pg_temp.cashback_rows((select (r->>'tab_id')::uuid from g7)), 0, 'and no cashback is ever written');
select is(pay_tab_verify((select (r->>'tab_id')::uuid from g7), '00000000-0000-4000-8000-000000013707', repeat('a', 64))->>'code',
  'expired', 'the waiter cannot sign a closed payment');
select is(pay_tab_change((select (r->>'tab_id')::uuid from g7), '00000000-0000-4000-8000-0000000a3707', 'close')->>'outcome',
  'closed', 'closing again is the same answer');

-- Tap 8: closed, it no longer counts; closing with nothing moved cancels.
create temp table g8 on commit drop as
select pay_tab_guest_pay('00000000-0000-4000-8000-0000000a3707', '00000000-0000-4000-8000-000000023707', 'MXN', false,
  repeat('8', 63) || '0', 1000, 0, 1000, 0, 0, 0, gen_random_uuid(), null, 200) as r;
select is(pay_tab_change((select (r->>'tab_id')::uuid from g8), '00000000-0000-4000-8000-0000000a3707', 'close')->>'outcome',
  'cancelled', 'closing a payment where nothing moved cancels it');

-- ━━━ MESITA-3776: the ticket number ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

insert into auth.users (id) values ('00000000-0000-4000-8000-0000000c3776');
insert into public.consumers (id) values ('00000000-0000-4000-8000-0000000c3776');

select is(array[pay_ticket_norm('A-0123'), pay_ticket_norm('a123'), pay_ticket_norm('000'), pay_ticket_norm('0012'), pay_ticket_norm('a 12/0-04')],
  array['A123', 'A123', '0', '12', 'A12004'], 'a ticket compares uppercase, without separators or leading zeros');

-- Tap 9: guest A pays $10MX cash on ticket " a-0123 ".
create temp table g9 on commit drop as
select pay_tab_guest_pay('00000000-0000-4000-8000-0000000a3707', '00000000-0000-4000-8000-000000013707', 'MXN', false,
  repeat('9', 63) || '1', 1000, 0, 1000, 0, 0, 0, '00000000-0000-4000-8000-000000e37761', null, 200,
  p_ticket => ' a-0123 ') as r;
select is((select ticket from pay_tabs where id = (select (r->>'tab_id')::uuid from g9)), 'a-0123',
  'the ticket is stored as typed, trimmed');
select ok(
  (select pay_tab_guest_pay('00000000-0000-4000-8000-0000000a3707', '00000000-0000-4000-8000-000000013707', 'MXN', false,
     repeat('9', 63) || '1', 1000, 0, 1000, 0, 0, 0, '00000000-0000-4000-8000-000000e37761', null, 200,
     p_ticket => 'ZZZ')->>'outcome') = 'replayed'
    and (select ticket from pay_tabs where id = (select (r->>'tab_id')::uuid from g9)) = 'a-0123',
  'a retry keeps the first ticket');
select is(
  pay_tab_guest_pay('00000000-0000-4000-8000-0000000a3707', '00000000-0000-4000-8000-000000013707', 'MXN', false,
    repeat('9', 63) || '1', 1000, 0, 1000, 0, 0, 0, '00000000-0000-4000-8000-000000e37761', null, 200,
    p_ticket => 'a-0123')->>'outcome',
  'replayed', 'a retry of the created request does not warn about its own ticket');
select throws_like(
  $$select pay_tab_guest_pay('00000000-0000-4000-8000-0000000b3707', '00000000-0000-4000-8000-000000013707', 'MXN', false,
      repeat('c', 64), 1000, 0, 1000, 0, 0, 0, gen_random_uuid(), null, 200, p_ticket => '12345678901234567')$$,
  'guest_refused:%ticket_invalid%', 'a 17-character ticket is refused');
select throws_like(
  $$select pay_tab_guest_pay('00000000-0000-4000-8000-0000000b3707', '00000000-0000-4000-8000-000000013707', 'MXN', false,
      repeat('c', 64), 1000, 0, 1000, 0, 0, 0, gen_random_uuid(), null, 200, p_ticket => 'A#1')$$,
  'guest_refused:%ticket_invalid%', 'a ticket with a symbol is refused');

-- Guest B types "A123" for the same ticket while A's cash share is unsigned.
select is(
  (select (regexp_match(e, 'guest_refused:(.*)$'))[1]::jsonb
     from (select pg_temp.refusal($$select pay_tab_guest_pay('00000000-0000-4000-8000-0000000b3707', '00000000-0000-4000-8000-000000013707', 'MXN', false,
       repeat('c', 64), 1000, 0, 1000, 0, 0, 0, '00000000-0000-4000-8000-000000e37762', null, 200, p_ticket => 'A123')$$) as e) x),
  '{"code": "ticket_paid"}'::jsonb,
  'an unsigned cash share of "a-0123" makes "A123" ticket_paid, with no time and no amount');
select is(pay_tab_verify((select (r->>'tab_id')::uuid from g9), '00000000-0000-4000-8000-000000013707', repeat('a', 64))->>'outcome',
  'verified', 'the waiter signs guest A''s share');
select throws_like(
  $$select pay_tab_guest_pay('00000000-0000-4000-8000-0000000b3707', '00000000-0000-4000-8000-000000013707', 'MXN', false,
      repeat('c', 64), 1000, 0, 1000, 0, 0, 0, '00000000-0000-4000-8000-000000e37762', null, 200, p_ticket => 'A123')$$,
  'guest_refused:%ticket_paid%', 'another guest''s paid share of the ticket in 12 hours is refused ticket_paid');
select is((select count(*)::int from pay_tabs where pay_request_id = '00000000-0000-4000-8000-000000e37762'), 0,
  'and the refusal leaves no tab');

-- "Yes, my share": the same request id with p_repeat_ok.
create temp table g10 on commit drop as
select pay_tab_guest_pay('00000000-0000-4000-8000-0000000b3707', '00000000-0000-4000-8000-000000013707', 'MXN', false,
  repeat('c', 64), 1000, 0, 1000, 0, 0, 0, '00000000-0000-4000-8000-000000e37762', null, 200,
  p_ticket => 'A123', p_repeat_ok => true) as r;
select is((select r->>'status' from g10), 'paying', 'with p_repeat_ok the share goes through');
select is(
  pay_tab_guest_pay('00000000-0000-4000-8000-0000000b3707', '00000000-0000-4000-8000-000000013707', 'MXN', false,
    repeat('c', 64), 1000, 0, 1000, 0, 0, 0, '00000000-0000-4000-8000-000000e37762', null, 200,
    p_ticket => 'A123', p_repeat_ok => true)->>'outcome',
  'replayed', 'resending the share replays it');
select is((select count(*)::int from pay_tabs where pay_request_id = '00000000-0000-4000-8000-000000e37762'), 1,
  'and the request id made exactly one tab');

-- Guest A tries to pay the same ticket again, even saying it is a share.
select is(
  (select (regexp_match(e, 'guest_refused:(.*)$'))[1]::jsonb
     from (select pg_temp.refusal($$select pay_tab_guest_pay('00000000-0000-4000-8000-0000000a3707', '00000000-0000-4000-8000-000000013707', 'MXN', false,
       repeat('d', 64), 1000, 0, 1000, 0, 0, 0, gen_random_uuid(), null, 200, p_ticket => 'a 0123', p_repeat_ok => true)$$) as e) x),
  jsonb_build_object('code', 'ticket_paid_by_you', 'paid_tab_id', (select r->>'tab_id' from g9)),
  'the guest''s own earlier payment of the ticket refuses ticket_paid_by_you with its id, even with p_repeat_ok');
select lives_ok(
  $$select pay_tab_guest_pay('00000000-0000-4000-8000-0000000a3707', '00000000-0000-4000-8000-000000023707', 'MXN', false,
      repeat('d', 63) || '1', 1000, 0, 1000, 0, 0, 0, gen_random_uuid(), null, 200, p_ticket => 'A123')$$,
  'the same ticket at another place does not warn');

-- A waiter-billed tab here carrying the same free-text ticket.
create temp table w2 on commit drop as
select pay_tab_open('00000000-0000-4000-8000-0000000b3707', '00000000-0000-4000-8000-000000013707',
  repeat('e', 64), 'MXN', false) as r;
update pay_tabs set ticket = 'W-77', status = 'paid', bill_cents = 1000, billed_at = now(), paid_at = now()
 where id = (select (r->>'tab_id')::uuid from w2);
create temp table g11 on commit drop as
select pay_tab_guest_pay('00000000-0000-4000-8000-0000000c3776', '00000000-0000-4000-8000-000000013707', 'MXN', false,
  repeat('e', 63) || '1', 1000, 0, 1000, 0, 0, 0, gen_random_uuid(), null, 200, p_ticket => 'w77') as r;
select is((select r->>'status' from g11), 'paying', 'a waiter-billed tab with the same ticket does not warn');
do $$ begin
  perform pay_tab_change((select (r->>'tab_id')::uuid from g11), '00000000-0000-4000-8000-0000000c3776', 'cancel');
end $$;

create temp table g12 on commit drop as
select pay_tab_guest_pay('00000000-0000-4000-8000-0000000c3776', '00000000-0000-4000-8000-000000013707', 'MXN', false,
  repeat('e', 63) || '2', 1000, 0, 1000, 0, 0, 0, gen_random_uuid(), null, 200) as r;
select ok((select r->>'status' from g12) = 'paying'
          and (select ticket from pay_tabs where id = (select (r->>'tab_id')::uuid from g12)) is null,
  'no ticket is allowed and stores none');
do $$ begin
  perform pay_tab_change((select (r->>'tab_id')::uuid from g12), '00000000-0000-4000-8000-0000000c3776', 'cancel');
end $$;

select lives_ok(
  $$select pay_tab_guest_pay('00000000-0000-4000-8000-0000000c3776', '00000000-0000-4000-8000-000000013707', 'MXN', false,
      repeat('e', 63) || '3', 1000, 0, 1000, 0, 0, 0, gen_random_uuid(), null, 200, now() + interval '13 hours',
      p_ticket => 'A123')$$,
  '13 hours later the ticket no longer warns');


-- ━━━ MESITA-3843: Reject, X and the ten-minute window release everything ━━━━
select ok(not has_function_privilege('authenticated', 'public.pay_tab_reject(uuid, uuid, text, timestamptz)', 'EXECUTE')
          and not has_function_privilege('anon', 'public.pay_tab_reject(uuid, uuid, text, timestamptz)', 'EXECUTE'),
  'client roles cannot reject');
select ok(pg_get_constraintdef((select oid from pg_constraint where conname = 'place_payment_settings_cash_cashback_bps_check')) like '%300%',
  'Cash Payments Cashback is Off or 3%');

-- Guest D holds $220MX Available at the probe place.
insert into auth.users (id) values ('00000000-0000-4000-8000-0000000d3843');
insert into public.consumers (id) values ('00000000-0000-4000-8000-0000000d3843');
insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, application_fee_cents, stripe_checkout_session_id)
values ('00000000-0000-4000-8000-0000000e3843', '00000000-0000-4000-8000-0000000d3843',
        '00000000-0000-4000-8000-000000013707', 20000, 'mxn', 'open', 'acct_test_3707',
        'voucher_200', 2000, 1000, 'cs_test_3843');
do $$ begin
  perform wallet_credit_purchase('00000000-0000-4000-8000-0000000e3843', 'pi_test_3843', now() - interval '1 minute');
end $$;

create temp table h1 on commit drop as
select pay_tab_guest_pay('00000000-0000-4000-8000-0000000d3843', '00000000-0000-4000-8000-000000013707', 'MXN', false,
  repeat('c', 63) || '1', 3000, 3000, 0, 0, 0, 0, gen_random_uuid(), null, 0, p_window => interval '10 minutes') as r;
select is(pg_temp.spendable('00000000-0000-4000-8000-0000000d3843'), 19000, 'a credits-only bill holds its $30MX');
select ok((select expires_at <= now() + interval '10 minutes' from pay_tabs where id = (select (r->>'tab_id')::uuid from h1)),
  'the waiter has ten minutes');
select is(pay_tab_reject((select (r->>'tab_id')::uuid from h1), '00000000-0000-4000-8000-000000023707', repeat('a', 64))->>'code',
  'forbidden', 'another place''s staff cannot reject');
select is(pay_tab_reject((select (r->>'tab_id')::uuid from h1), '00000000-0000-4000-8000-000000013707', repeat('a', 64))->>'outcome',
  'rejected', 'the waiter rejects');
select ok((select status = 'cancelled' and end_reason = 'rejected' from pay_tabs where id = (select (r->>'tab_id')::uuid from h1)),
  'a rejected bill ends cancelled, end_reason rejected');
select is(pg_temp.spendable('00000000-0000-4000-8000-0000000d3843'), 22000, 'Reject releases the held credit');
select is(pay_tab_reject((select (r->>'tab_id')::uuid from h1), '00000000-0000-4000-8000-000000013707', repeat('a', 64))->>'outcome',
  'already_rejected', 'a second Reject moves nothing');
select is(pay_tab_verify((select (r->>'tab_id')::uuid from h1), '00000000-0000-4000-8000-000000013707', repeat('a', 64))->>'code',
  'cancelled', 'a rejected bill cannot be signed');

create temp table h2 on commit drop as
select pay_tab_guest_pay('00000000-0000-4000-8000-0000000d3843', '00000000-0000-4000-8000-000000013707', 'MXN', false,
  repeat('c', 63) || '2', 3000, 3000, 0, 0, 0, 0, gen_random_uuid(), null, 0, p_window => interval '10 minutes') as r;
select is(pay_tab_change((select (r->>'tab_id')::uuid from h2), '00000000-0000-4000-8000-0000000d3843', 'cancel')->>'outcome',
  'cancelled', 'the guest''s X cancels');
select ok((select end_reason = 'cancelled' from pay_tabs where id = (select (r->>'tab_id')::uuid from h2))
          and pg_temp.spendable('00000000-0000-4000-8000-0000000d3843') = 22000,
  'X records why and releases the credit');

create temp table h3 on commit drop as
select pay_tab_guest_pay('00000000-0000-4000-8000-0000000d3843', '00000000-0000-4000-8000-000000013707', 'MXN', false,
  repeat('c', 63) || '3', 3000, 3000, 0, 0, 0, 0, gen_random_uuid(), null, 0, p_window => interval '10 minutes') as r;
select is(pay_tab_verify((select (r->>'tab_id')::uuid from h3), '00000000-0000-4000-8000-000000013707', repeat('a', 64),
          null, now() + interval '11 minutes')->>'code',
  'expired', 'a signature after ten minutes is refused');
update pay_tabs set expires_at = now() - interval '1 minute' where id = (select (r->>'tab_id')::uuid from h3);
do $$ begin perform pay_tabs_close_guest(); end $$;
select ok((select status = 'expired' and end_reason = 'expired' from pay_tabs where id = (select (r->>'tab_id')::uuid from h3))
          and pg_temp.spendable('00000000-0000-4000-8000-0000000d3843') = 22000,
  'expiry releases the credit, spends nothing');

select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'pay_tab_guest_pay'),
  1, 'pay_tab_guest_pay has exactly one overload');

select * from finish();
rollback;
