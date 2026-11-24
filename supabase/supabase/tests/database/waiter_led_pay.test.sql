-- MESITA-4823 — waiter-led pay: the quote equals what is written, Accept
-- freezes the cashback and holds the credit, versions refuse stale answers,
-- nothing owed closes at Accept, releases free the credit.
begin;
create extension if not exists pgtap with schema public;
select plan(47);

insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000a4823'), ('00000000-0000-4000-8000-0000000b4823'), ('00000000-0000-4000-8000-0000000f4823');
insert into public.consumers (id) values
  ('00000000-0000-4000-8000-0000000a4823'), ('00000000-0000-4000-8000-0000000b4823');
insert into public.place_profiles (id, google_name) values
  ('00000000-0000-4000-8000-000000014823', 'Waiter Probe'), ('00000000-0000-4000-8000-000000024823', 'Other Probe');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000014823', 'mesita-4823-probe', 'active', 'generating', 'MXN'),
  ('00000000-0000-4000-8000-000000024823', 'mesita-4823-other', 'active', 'generating', 'MXN');
insert into public.place_cashback_settings (place_id, welcome_bps, returning_bps, visit_mechanism) values
  ('00000000-0000-4000-8000-000000014823', 1000, 1000, 'cashback'),
  ('00000000-0000-4000-8000-000000024823', 2000, 1000, 'discount');
insert into public.loyalty_cards_contracts (place_id, signed_by, signer_role, terms_version, text_sha256)
values ('00000000-0000-4000-8000-000000014823', '00000000-0000-4000-8000-0000000f4823', 'owner', 'draft-2026-11', repeat('0', 64));
insert into public.place_payment_settings (place_id, loyalty_cards) values ('00000000-0000-4000-8000-000000014823', true);
-- MX$300 of credit at the first place (an earlier paid bill's cashback).
insert into public.pay_tabs (id, place_id, consumer_id, token_hash, currency, livemode, expires_at, status, bill_cents, tip_cents,
                             origin, paid_at, cash_bill_cents, visit_mechanism)
values ('00000000-0000-4000-8000-0000000d4823', '00000000-0000-4000-8000-000000014823', '00000000-0000-4000-8000-0000000a4823',
        repeat('9', 64), 'mxn', false, now(), 'paid', 300000, 0, 'guest', now() - interval '2 days', 300000, 'cashback');

select is((select sum(amount_cents)::int from public.wallet_entries where tab_id = '00000000-0000-4000-8000-0000000d4823'), 30000,
  'a bill with no frozen rate still earns by the place''s rate');

create temp table t (k text primary key, v jsonb);
grant all on t to public;

-- ── The code ──
select is((public.pay_guest_code_set('00000000-0000-4000-8000-0000000a4823', repeat('a', 64), repeat('1', 64))->>'ok'), 'true', 'a code is set');
select is((public.pay_guest_code_set('00000000-0000-4000-8000-0000000b4823', repeat('b', 64), repeat('1', 64))->>'code'), 'collision', 'live six digits are one guest''s');
select is((public.pay_bill_open(repeat('e', 64), null, '00000000-0000-4000-8000-000000014823', 'mxn', false, repeat('c', 64))->>'code'), 'code_gone', 'an unknown code opens nothing');
insert into t select 'open', public.pay_bill_open(repeat('a', 64), null, '00000000-0000-4000-8000-000000014823', 'mxn', false, repeat('c', 64));
select is((select v->>'outcome' from t where k = 'open'), 'opened', 'the QR opens a bill session');
select is((public.pay_bill_open(repeat('1', 64), null, '00000000-0000-4000-8000-000000014823', 'mxn', false, repeat('c', 64))->>'outcome'), 'reused', 'the six digits reach the same session');
select is((public.pay_guest_code_set('00000000-0000-4000-8000-0000000a4823', repeat('2', 64), repeat('3', 64))->>'ok'), 'true', 'the code rotates');
select is((public.pay_bill_open(repeat('a', 64), null, '00000000-0000-4000-8000-000000014823', 'mxn', false, repeat('c', 64))->>'ok'), 'true', 'the previous QR works for a minute');
select is((public.pay_bill_open(repeat('a', 64), null, '00000000-0000-4000-8000-000000014823', 'mxn', false, repeat('c', 64), now() + interval '61 seconds')->>'code'), 'code_gone', 'and then it does not');

-- ── Send and edit ──
select is((public.pay_bill_send((select (v->>'bill_id')::uuid from t where k='open'), '00000000-0000-4000-8000-000000024823', 0, 50000, 5000, repeat('c', 64))->>'code'), 'forbidden', 'another place never bills this session');
select is((public.pay_bill_send((select (v->>'bill_id')::uuid from t where k='open'), '00000000-0000-4000-8000-000000014823', 0, 0, 0, repeat('c', 64))->>'code'), 'amount_required', 'a bill needs an amount');
select is((public.pay_bill_send((select (v->>'bill_id')::uuid from t where k='open'), '00000000-0000-4000-8000-000000014823', 0, 50000, 5000, repeat('c', 64))->>'version'), '1', 'the bill is sent');
select is((public.pay_bill_send((select (v->>'bill_id')::uuid from t where k='open'), '00000000-0000-4000-8000-000000014823', 0, 50000, 5000, repeat('c', 64))->>'outcome'), 'replayed', 'the same send twice is one');
select is((public.pay_bill_send((select (v->>'bill_id')::uuid from t where k='open'), '00000000-0000-4000-8000-000000014823', 1, 60000, 6000, repeat('c', 64))->>'version'), '2', 'an edit is a new version');
select is((public.pay_bill_accept((select (v->>'bill_id')::uuid from t where k='open'), '00000000-0000-4000-8000-0000000a4823', 1, repeat('4', 64))->>'code'), 'quote_changed', 'the old version is not accepted');
select is((public.pay_bill_accept((select (v->>'bill_id')::uuid from t where k='open'), '00000000-0000-4000-8000-0000000b4823', 2, repeat('4', 64))->>'code'), 'gone', 'another guest never accepts it');
select is((select (quote->>'credit_cents')::int from public.pay_bills where id = (select (v->>'bill_id')::uuid from t where k='open')), 30000, 'credits are used to the maximum');
select is((select (quote->>'cashback_cents')::int from public.pay_bills where id = (select (v->>'bill_id')::uuid from t where k='open')), 3000, 'cashback is on what is paid outside, never the tip');

-- ── Accept ──
insert into t select 'acc', public.pay_bill_accept((select (v->>'bill_id')::uuid from t where k='open'), '00000000-0000-4000-8000-0000000a4823', 2, repeat('4', 64));
select is((select v->>'outcome' from t where k='acc'), 'accepted', 'the guest accepts');
select is((public.pay_bill_accept((select (v->>'bill_id')::uuid from t where k='open'), '00000000-0000-4000-8000-0000000a4823', 2, repeat('5', 64))->>'outcome'), 'replayed', 'a second Accept is the same one');
select is((select b.spendable_cents from public.wallet_balance('00000000-0000-4000-8000-0000000a4823', '00000000-0000-4000-8000-000000014823', 'mxn', false) b), 0, 'Accept holds the credit');
select is((public.pay_bill_send((select (v->>'bill_id')::uuid from t where k='open'), '00000000-0000-4000-8000-000000014823', 2, 70000, 0, repeat('c', 64))->>'code'), 'accepted', 'an accepted bill is not edited');
-- The owner changes the rate and turns Loyalty Cards off meanwhile.
update public.place_cashback_settings set welcome_bps = 0, returning_bps = 0 where place_id = '00000000-0000-4000-8000-000000014823';
update public.place_payment_settings set loyalty_cards = false where place_id = '00000000-0000-4000-8000-000000014823';
select is((public.pay_guest_claim_confirm((select (v->>'attempt_id')::uuid from t where k='acc'), '00000000-0000-4000-8000-000000014823', repeat('c', 64))->>'outcome'), 'claimed', 'the waiter taps Received');
insert into t select 'close', public.pay_guest_close((select (v->>'attempt_id')::uuid from t where k='acc'));
select is((select v->>'outcome' from t where k='close'), 'closed', 'the bill is paid');
select is((select amount_cents from public.wallet_entries where tab_id = (select (v->>'tab_id')::uuid from t where k='close') and kind = 'cashback'), 3000, 'the cashback granted is the one the guest accepted');
select is((select sum(amount_cents)::int from public.wallet_entries where consumer_id = '00000000-0000-4000-8000-0000000a4823' and kind = 'spend'), -30000, 'the credit is spent once');
select is((public.pay_guest_close((select (v->>'attempt_id')::uuid from t where k='acc'))->>'outcome'), 'already', 'Received twice moves nothing');

-- ── A discount, declined, then a second place ──
insert into t select 'o2', public.pay_bill_open(repeat('2', 64), null, '00000000-0000-4000-8000-000000024823', 'mxn', false, repeat('d', 64));
select is((public.pay_bill_send((select (v->>'bill_id')::uuid from t where k='o2'), '00000000-0000-4000-8000-000000024823', 0, 50000, 0, repeat('d', 64))->>'version'), '1', 'a second place bills');
select is((select (quote->>'outside_cents')::int from public.pay_bills where id = (select (v->>'bill_id')::uuid from t where k='o2')), 40000, 'the discount comes off the bill');
select is((public.pay_bill_decline((select (v->>'bill_id')::uuid from t where k='o2'), '00000000-0000-4000-8000-0000000a4823', 1)->>'outcome'), 'declined', 'the guest declines');
select is((public.pay_bill_accept((select (v->>'bill_id')::uuid from t where k='o2'), '00000000-0000-4000-8000-0000000a4823', 1, repeat('6', 64))->>'code'), 'declined', 'a declined bill is not accepted');
select is((public.pay_bill_decline((select (v->>'bill_id')::uuid from t where k='o2'), '00000000-0000-4000-8000-0000000a4823', 1, true)->>'ok'), 'true', 'Not my bill answers');

-- ── Nothing owed outside closes at Accept ──
insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, application_fee_cents, stripe_checkout_session_id)
values ('00000000-0000-4000-8000-0000000e4823', '00000000-0000-4000-8000-0000000a4823', '00000000-0000-4000-8000-000000024823',
        20000, 'mxn', 'open', 'acct_test_4823', 'voucher_200', 2000, 1000, 'cs_test_4823');
do $$ begin perform wallet_credit_purchase('00000000-0000-4000-8000-0000000e4823', 'pi_test_4823', now() - interval '1 minute'); end $$;
select is((public.pay_bill_open(repeat('2', 64), null, '00000000-0000-4000-8000-000000024823', 'mxn', false, repeat('d', 64))->>'code'), 'code_gone', 'after Not my bill the old QR opens nothing');
select is((public.pay_guest_code_set('00000000-0000-4000-8000-0000000a4823', repeat('7', 64), repeat('8', 64))->>'ok'), 'true', 'a new QR');
insert into t select 'o3', public.pay_bill_open(repeat('7', 64), null, '00000000-0000-4000-8000-000000024823', 'mxn', false, repeat('d', 64));
-- Credits cover the bill but there is a tip: it waits for Received.
insert into t select 's3', public.pay_bill_send((select (v->>'bill_id')::uuid from t where k='o3'), '00000000-0000-4000-8000-000000024823', 0, 10000, 1000, repeat('d', 64));
insert into t select 'a3', public.pay_bill_accept((select (v->>'bill_id')::uuid from t where k='o3'), '00000000-0000-4000-8000-0000000a4823', 1, repeat('a', 63) || '1');
select is((select v->>'status' from t where k='a3'), 'due', 'credits never pay the tip: the waiter still collects it');
select is((public.pay_bill_open(null, (select (v->>'bill_id')::uuid from t where k='o3'), '00000000-0000-4000-8000-000000024823', 'mxn', false, repeat('d', 64))->>'code'), 'not_over', 'a live bill is not started over');
select is((public.pay_guest_claim_end((select (v->>'attempt_id')::uuid from t where k='a3'), 'cancelled', '00000000-0000-4000-8000-0000000a4823', null)->>'outcome'), 'claimed', 'the guest cancels before Received');
select is((public.pay_guest_finish_release((select (v->>'attempt_id')::uuid from t where k='a3'), 'cancelled')->>'outcome'), 'released', 'the bill is released');
select is((select b.spendable_cents from public.wallet_balance('00000000-0000-4000-8000-0000000a4823', '00000000-0000-4000-8000-000000024823', 'mxn', false) b), 22000, 'the credit is free again');
select is((public.pay_bill_accept((select (v->>'bill_id')::uuid from t where k='o3'), '00000000-0000-4000-8000-0000000a4823', 1, repeat('a', 63) || '2')->>'code'), 'already_final', 'a released bill is over');
-- Nothing owed outside: Accept closes it.
insert into t select 'o4', public.pay_bill_open(null, (select (v->>'bill_id')::uuid from t where k='o3'), '00000000-0000-4000-8000-000000024823', 'mxn', false, repeat('d', 64));
insert into t select 's4', public.pay_bill_send((select (v->>'bill_id')::uuid from t where k='o4'), '00000000-0000-4000-8000-000000024823', 0, 25000, 0, repeat('d', 64));
insert into t select 'a4', public.pay_bill_accept((select (v->>'bill_id')::uuid from t where k='o4'), '00000000-0000-4000-8000-0000000a4823', 1, repeat('a', 63) || '3');
select is((select v->>'status' from t where k='a4'), 'closed', 'credits cover everything and no tip: Accept closes the bill');
select is((select b.spendable_cents from public.wallet_balance('00000000-0000-4000-8000-0000000a4823', '00000000-0000-4000-8000-000000024823', 'mxn', false) b), 2000, 'the credit is spent');
select is((select verified_key_hash from public.pay_tabs where id = (select (v->>'tab_id')::uuid from t where k='a4')), repeat('d', 64), 'the waiter who sent it is the one on record');
-- Credit changed between Send and Accept.
insert into t select 'o5', public.pay_bill_open(repeat('7', 64), null, '00000000-0000-4000-8000-000000024823', 'mxn', false, repeat('d', 64));
insert into t select 's5', public.pay_bill_send((select (v->>'bill_id')::uuid from t where k='o5'), '00000000-0000-4000-8000-000000024823', 0, 10000, 0, repeat('d', 64));
update public.place_cashback_settings set visit_mechanism = 'cashback' where place_id = '00000000-0000-4000-8000-000000024823';
select is((public.pay_bill_accept((select (v->>'bill_id')::uuid from t where k='o5'), '00000000-0000-4000-8000-0000000a4823', 1, repeat('a', 63) || '4')->>'code'), 'quote_changed', 'numbers that changed are shown again');
select is((public.pay_bill_accept((select (v->>'bill_id')::uuid from t where k='o5'), '00000000-0000-4000-8000-0000000a4823', 2, repeat('a', 63) || '4')->>'outcome'), 'accepted', 'and then accepted');
select ok(not has_table_privilege('authenticated', 'public.pay_bills', 'select'), 'guests never read pay_bills');
select ok(not has_function_privilege('authenticated', 'public.pay_bill_accept(uuid, uuid, integer, text, integer, timestamptz)', 'execute'), 'guests never call accept');

select * from finish();
rollback;
