-- MESITA-3856 — a guest's card is held, not charged, until the waiter signs.
-- The bank's hold starts the bill's ten minutes; Sign marks the bill signing
-- (X, Reject and the cron wait) and the captured card's settle finishes the
-- signature with its cashback; a failed capture ends the bill with nothing
-- charged and the credit released; X, Reject and expiry end a held bill and
-- list its hold for cancelling; a hold that lands after its bill ended is let
-- go; only the service role calls any of it.

begin;

create extension if not exists pgtap with schema public;

select plan(31);

insert into auth.users (id) values ('00000000-0000-4000-8000-0000000a3856');
insert into public.consumers (id) values ('00000000-0000-4000-8000-0000000a3856');
insert into public.place_profiles (id, google_name) values ('00000000-0000-4000-8000-000000013856', 'Card Hold Probe'),
  ('00000000-0000-4000-8000-000000023856', 'Card Hold Other');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000013856', 'mesita-3856-probe', 'active', 'generating', 'MXN'),
  ('00000000-0000-4000-8000-000000023856', 'mesita-3856-other', 'active', 'generating', 'MXN');
insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, application_fee_cents, stripe_checkout_session_id)
values ('00000000-0000-4000-8000-0000000d3856', '00000000-0000-4000-8000-0000000a3856',
        '00000000-0000-4000-8000-000000013856', 20000, 'mxn', 'open', 'acct_test_3856',
        'voucher_200', 2000, 1000, 'cs_test_3856');
do $$ begin
  perform wallet_credit_purchase('00000000-0000-4000-8000-0000000d3856', 'pi_test_3856_buy', now() - interval '1 minute');
end $$;

create function pg_temp.available() returns integer language sql as $$
  select available_cents from wallet_balance('00000000-0000-4000-8000-0000000a3856', '00000000-0000-4000-8000-000000013856', 'mxn', false)
$$;
create function pg_temp.spendable() returns integer language sql as $$
  select spendable_cents from wallet_balance('00000000-0000-4000-8000-0000000a3856', '00000000-0000-4000-8000-000000013856', 'mxn', false)
$$;
-- A $100MX bill: $20MX credit + $80MX card. Its PaymentIntent is pi_3856n<n>.
create function pg_temp.card_bill(n text) returns uuid language plpgsql as $$
declare r jsonb; c uuid;
begin
  r := pay_tab_guest_pay('00000000-0000-4000-8000-0000000a3856', '00000000-0000-4000-8000-000000013856', 'MXN', false,
    repeat(n, 64), 10000, 2000, 0, 0, 8000, 0, gen_random_uuid(), null, 0, now(), 'acct_test_3856',
    0, 500, null, now() + interval '10 minutes', p_window => interval '10 minutes');
  c := (r->>'card_payment_id')::uuid;
  perform wallet_open_payment_pi(c, 'pi_3856n' || n);
  return (r->>'tab_id')::uuid;
end $$;
create function pg_temp.card_row(t uuid) returns uuid language sql as $$
  select id from wallet_payments where tab_id = t and part = 'card'
$$;

-- ━━━ Access ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
select ok(
  not has_function_privilege('authenticated', 'public.wallet_card_held(uuid, timestamptz, interval)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.pay_tab_begin_capture(uuid, uuid, text, timestamptz)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.pay_tab_finish_signing(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.pay_tab_capture_failed(uuid, text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.wallet_released_holds(uuid, integer)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.wallet_hold_cancelled(uuid)', 'EXECUTE'),
  'client roles cannot call the card-hold functions');

-- ━━━ 1. Held, signed, captured ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
create temp table t1 on commit drop as select pg_temp.card_bill('1') as id;
select is(pg_temp.spendable(), 20000, 'the $20MX credit is held while the card goes through');
select is(pay_tab_begin_capture((select id from t1), '00000000-0000-4000-8000-000000013856', repeat('a', 64))->>'code',
  null, 'before the hold, Sign has nothing to capture');
select is(pay_tab_verify((select id from t1), '00000000-0000-4000-8000-000000013856', repeat('a', 64))->>'code',
  'card_pending', 'and Verify waits for the card');
select is(wallet_card_held(pg_temp.card_row((select id from t1)), now())->>'decision', 'keep',
  'the bank holds it: keep it for the waiter');
select ok((select held_at is not null from wallet_payments where id = pg_temp.card_row((select id from t1))),
  'the card row says held');
select ok((select expires_at > now() + interval '9 minutes' from pay_tabs where id = (select id from t1)),
  'the ten minutes start at the hold');
select is(pay_tab_begin_capture((select id from t1), '00000000-0000-4000-8000-000000023856', repeat('a', 64))->>'code',
  'forbidden', 'another place cannot sign');
create temp table b1 on commit drop as
select pay_tab_begin_capture((select id from t1), '00000000-0000-4000-8000-000000013856', repeat('a', 64)) as r;
select is((select r->>'outcome' from b1), 'capture', 'Sign on a held card asks for the capture');
select is((select r->>'payment_intent' from b1), 'pi_3856n1', 'naming the hold');
select is(pay_tab_change((select id from t1), '00000000-0000-4000-8000-0000000a3856', 'cancel')->>'code',
  'card_pending', 'X waits while the card is being captured');
select is(pay_tab_reject((select id from t1), '00000000-0000-4000-8000-000000013856', repeat('a', 64))->>'code',
  'card_pending', 'so does Reject');
update pay_tabs set expires_at = now() - interval '1 minute' where id = (select id from t1);
select is(pay_tab_guest_end((select id from t1), now()), false, 'and the cron never ends a bill being captured');
-- Stripe captured it: the settle spends the hold and finishes the signature.
do $$ begin perform wallet_settle_payment(pg_temp.card_row((select id from t1)), 'pi_3856n1'); end $$;
select ok((select verified_at is not null and status = 'paid' from pay_tabs where id = (select id from t1)),
  'the captured card signs the bill, even past its window');
select is(pg_temp.available(), 20400, 'the $20MX credit is spent once (the $4MX left is its cashback, Available at once since MESITA-3909)');
select is((select cashback_cents from wallet_payments where id = pg_temp.card_row((select id from t1))), 400,
  'and the card part earns 5% of $80MX');

-- ━━━ 2. Held, then X ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
create temp table t2 on commit drop as select pg_temp.card_bill('2') as id;
do $$ begin perform wallet_card_held(pg_temp.card_row((select id from t2)), now()); end $$;
select is(pay_tab_change((select id from t2), '00000000-0000-4000-8000-0000000a3856', 'cancel')->>'outcome',
  'cancelled', 'X cancels a bill whose card is held');
select is(pg_temp.spendable(), 20400, 'its $20MX credit is released');
select is((select stripe_payment_intent_id from wallet_released_holds((select id from t2), 10)), 'pi_3856n2',
  'and its hold is listed for cancelling');
do $$ begin perform wallet_hold_cancelled(pg_temp.card_row((select id from t2))); end $$;
select is((select count(*)::int from wallet_released_holds((select id from t2), 10)), 0, 'once, until it is cancelled');

-- ━━━ 3. Held, signed, the capture fails ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
create temp table t3 on commit drop as select pg_temp.card_bill('3') as id;
do $$ begin
  perform wallet_card_held(pg_temp.card_row((select id from t3)), now());
  perform pay_tab_begin_capture((select id from t3), '00000000-0000-4000-8000-000000013856', repeat('a', 64));
end $$;
select is(wallet_card_held(pg_temp.card_row((select id from t3)), now())->>'decision', 'capture',
  'a re-read during the signature asks to capture again');
select is(pay_tab_capture_failed((select id from t3), 'card_declined')->>'outcome', 'failed', 'the capture fails');
select ok((select status = 'cancelled' and end_reason = 'capture_failed' and signing_at is null from pay_tabs where id = (select id from t3)),
  'the bill ends: the card charge failed');
select is(pg_temp.spendable(), 20400, 'nothing is spent');
select is((select count(*)::int from wallet_released_holds((select id from t3), 10)), 1, 'and the hold is let go');

-- ━━━ 4. Held, then the window passes ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
create temp table t4 on commit drop as select pg_temp.card_bill('4') as id;
do $$ begin perform wallet_card_held(pg_temp.card_row((select id from t4)), now()); end $$;
update pay_tabs set expires_at = now() - interval '1 minute' where id = (select id from t4);
select is(pay_tab_guest_end((select id from t4), now()), true, 'the cron ends a held bill past its window');
select ok((select status = 'expired' and end_reason = 'expired' from pay_tabs where id = (select id from t4))
          and (select status = 'expired' from wallet_payments where id = pg_temp.card_row((select id from t4))),
  'expired, with its card row');
select is(pg_temp.spendable(), 20400, 'its credit is released');

-- ━━━ 5. The hold lands after the bill ended ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
create temp table t5 on commit drop as select pg_temp.card_bill('5') as id;
update pay_tabs set status = 'cancelled', end_reason = 'cancelled' where id = (select id from t5);
select is(wallet_card_held(pg_temp.card_row((select id from t5)), now())->>'decision', 'cancel',
  'a hold on a bill that ended is let go');
select ok((select held_at is null from wallet_payments where id = pg_temp.card_row((select id from t5))),
  'and never marked held');

select ok(pg_get_constraintdef((select oid from pg_constraint where conname = 'pay_tabs_end_reason_chk')) like '%capture_failed%',
  'end_reason knows capture_failed');

select * from finish();
rollback;
