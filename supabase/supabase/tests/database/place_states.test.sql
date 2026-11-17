-- MESITA-3589 — the Place states of Main §10, the money and legal guards.
-- The Loyalty Cards Agreement is EF-only and one live per place; Loyalty Cards
-- On needs it; the vouchers and Mesita Prepayments (MESITA-3597) need Loyalty Cards;
-- ending the contract turns Loyalty Cards and the
-- vouchers off; and Loyalty Cards Off never stops a guest spending credit
-- they already hold (a credit-only bill still settles).

begin;

create extension if not exists pgtap with schema public;

select plan(18);

insert into auth.users (id) values ('00000000-0000-4000-8000-0000000a3589'), ('00000000-0000-4000-8000-0000000b3589');
insert into public.consumers (id) values ('00000000-0000-4000-8000-0000000a3589');
insert into public.place_profiles (id, google_name) values ('00000000-0000-4000-8000-000000013589', 'Place States Probe');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000013589', 'mesita-3589-probe', 'active', 'generating', 'MXN');
-- A Stripe account that takes cards: the vouchers need it
-- (MESITA-3599, stripe_gate.test.sql), so the guards below are the ones tested.
insert into public.place_payment_accounts (place_id, stripe_account_id, livemode, charges_enabled)
values ('00000000-0000-4000-8000-000000013589', 'acct_test_3589', false, true);

-- ━━━ Access ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select ok(
  (select relrowsecurity from pg_class where oid = 'public.loyalty_cards_contracts'::regclass)
  and not has_table_privilege('anon', 'public.loyalty_cards_contracts', 'SELECT')
  and not has_table_privilege('authenticated', 'public.loyalty_cards_contracts', 'SELECT')
  and not has_table_privilege('authenticated', 'public.loyalty_cards_contracts', 'INSERT'),
  'the contract is EF-only: row level security on, no client reads or writes');

-- ━━━ Loyalty Cards needs the contract ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select throws_ok(
  $$insert into public.place_payment_settings (place_id, loyalty_cards) values ('00000000-0000-4000-8000-000000013589', true)$$,
  '23514', null, 'Loyalty Cards On without a signed contract is refused');

insert into public.place_payment_settings (place_id) values ('00000000-0000-4000-8000-000000013589');

select throws_ok(
  $$update public.place_payment_settings set voucher_200 = true where place_id = '00000000-0000-4000-8000-000000013589'$$,
  '23514', null, 'a voucher On without Loyalty Cards is refused');

insert into public.loyalty_cards_contracts (place_id, signed_by, signer_role, terms_version, text_sha256)
values ('00000000-0000-4000-8000-000000013589', '00000000-0000-4000-8000-0000000b3589', 'owner', 'draft-2026-11', repeat('0', 64));

select throws_ok(
  $$insert into public.loyalty_cards_contracts (place_id, signed_by, signer_role, terms_version, text_sha256)
    values ('00000000-0000-4000-8000-000000013589', '00000000-0000-4000-8000-0000000b3589', 'owner', 'draft-2026-11', repeat('0', 64))$$,
  '23505', null, 'a place has one live contract');

select throws_ok(
  $$update public.place_payment_settings set prepayments = true where place_id = '00000000-0000-4000-8000-000000013589'$$,
  '23514', null, 'Mesita Prepayments On without Loyalty Cards is refused (MESITA-3597)');

select lives_ok(
  $$update public.place_payment_settings set loyalty_cards = true, prepayments = true, voucher_200 = true
     where place_id = '00000000-0000-4000-8000-000000013589'$$,
  'signed: Loyalty Cards, Mesita Prepayments and a voucher turn on');

-- ━━━ Mesita Payments ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select lives_ok(
  $$update public.place_payment_settings set pay_cards = false
     where place_id = '00000000-0000-4000-8000-000000013589'$$,
  'Mesita Payments turns Off');

-- ━━━ Ending the contract ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select throws_ok(
  $$update public.loyalty_cards_contracts set terms_version = 'edited' where place_id = '00000000-0000-4000-8000-000000013589'$$,
  '23514', null, 'a signature is never edited (append-only)');

update public.loyalty_cards_contracts set ended_at = now(), end_reason = 'test'
 where place_id = '00000000-0000-4000-8000-000000013589';

select is(
  (select (loyalty_cards, prepayments, voucher_200)::text from public.place_payment_settings where place_id = '00000000-0000-4000-8000-000000013589'),
  '(f,f,f)', 'ending the contract turns Loyalty Cards, Mesita Prepayments and the vouchers off');
select throws_ok(
  $$update public.place_payment_settings set loyalty_cards = false, prepayments = true where place_id = '00000000-0000-4000-8000-000000013589'$$,
  '23514', null, 'Mesita Prepayments stays Off while Loyalty Cards is Off');
select ok(
  (select prepayments = false from public.place_payment_settings where place_id = '00000000-0000-4000-8000-000000013589'),
  'the refused update left Mesita Prepayments Off');
select throws_ok(
  $$update public.place_payment_settings set loyalty_cards = true where place_id = '00000000-0000-4000-8000-000000013589'$$,
  '23514', null, 'an ended contract does not let Loyalty Cards back on');

-- ━━━ Loyalty Cards Off: credit already held still pays ━━━━━━━━━━━━━━━━━━━━━━━

-- The guest holds $220MX at the place from before (a $200MX voucher and its bonus).
insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, application_fee_cents, stripe_checkout_session_id)
values ('00000000-0000-4000-8000-0000000d3589', '00000000-0000-4000-8000-0000000a3589',
        '00000000-0000-4000-8000-000000013589', 20000, 'mxn', 'open', 'acct_test_3589',
        'voucher_200', 2000, 1000, 'cs_test_3589');
do $$ begin
  perform wallet_credit_purchase('00000000-0000-4000-8000-0000000d3589', 'pi_test_3589', now() - interval '1 minute');
end $$;

create temp table t1 on commit drop as
select pay_tab_open('00000000-0000-4000-8000-0000000a3589', '00000000-0000-4000-8000-000000013589',
  repeat('a', 64), 'MXN', false) as r;
select is(pay_tab_bill(repeat('a', 64), repeat('e', 64), true, 0, 15000, 0, 'T1', 'Ana')->>'outcome',
  'billed', 'the waiter bills $150MX with no tip');

create temp table p1 on commit drop as
select pay_tab_open_parts((select (r->>'tab_id')::uuid from t1), '00000000-0000-4000-8000-0000000a3589', 1,
  15000, 0, 0, 0, 0, gen_random_uuid(), null, 2) as r;
select is((select r->>'status' from p1), 'paid',
  'Loyalty Cards, Cash Payments and Mesita Payments all Off: a credit-only bill still settles');
select is(
  (select sum(amount_cents)::int from public.wallet_entries
    where consumer_id = '00000000-0000-4000-8000-0000000a3589' and amount_cents > 0),
  22000, 'and no new credit is born from it: only the $220MX bought');

-- The waiter's code path: a credit-only payment with every switch off.
select is(
  wallet_pay_credit('00000000-0000-4000-8000-0000000a3589', '00000000-0000-4000-8000-000000013589', 5000, 'mxn', false,
    gen_random_uuid(), 'bbbbbbbbbbbbbbbbbbbbb2', null)->>'outcome',
  'paid', 'a credit-only payment by the waiter''s code also pays with every switch off');

-- ━━━ The MESITA-4282 bridge (MESITA-4283 drops it) ━━━━━━━━━━━━━━━━━━━━━━━━━━━
select is(
  (select house_credits from public.place_payment_settings where place_id = '00000000-0000-4000-8000-000000013589'),
  (select loyalty_cards from public.place_payment_settings where place_id = '00000000-0000-4000-8000-000000013589'),
  'house_credits reads as a copy of loyalty_cards for EFs deployed before the rename'
);
select ok(
  not has_table_privilege('anon', 'public.house_credits_contracts', 'SELECT')
  and not has_table_privilege('authenticated', 'public.house_credits_contracts', 'SELECT')
  and not has_table_privilege('authenticated', 'public.house_credits_contracts', 'INSERT'),
  'the house_credits_contracts bridge view grants no client role anything'
);

select * from finish();
rollback;
