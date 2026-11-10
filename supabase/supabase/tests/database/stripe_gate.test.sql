-- MESITA-3599 — Mesita Pay (pay_cards), its Cashback-as-Credits
-- (card_cashback_bps) and every Prepaid Voucher need the place's Stripe
-- account to take cards (Pato, 2026-11-10: "neither Mesita Pay nor Mesita
-- Payments can be enabled without the Stripe Account"). Mesita Pay defaults
-- Off; turning Off never needs Stripe; House Credits and Cash Payments are
-- independent of Stripe. Mesita Prepayments (MESITA-3597) needs it too.

begin;

create extension if not exists pgtap with schema public;

select plan(12);

insert into auth.users (id) values ('00000000-0000-4000-8000-0000000b3599');
insert into public.place_profiles (id, google_name) values ('00000000-0000-4000-8000-000000013599', 'Stripe Gate Probe');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000013599', 'mesita-3599-probe', 'active', 'generating', 'MXN');
insert into public.house_credits_contracts (place_id, signed_by, signer_role, terms_version, text_sha256)
values ('00000000-0000-4000-8000-000000013599', '00000000-0000-4000-8000-0000000b3599', 'owner', 'draft-2026-11', repeat('0', 64));

-- ━━━ No Stripe account ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select throws_ok(
  $$insert into public.place_payment_settings (place_id, pay_cards) values ('00000000-0000-4000-8000-000000013599', true)$$,
  '23514', null, 'Mesita Pay is never born On without Stripe');

insert into public.place_payment_settings (place_id) values ('00000000-0000-4000-8000-000000013599');

select is(
  (select pay_cards from public.place_payment_settings where place_id = '00000000-0000-4000-8000-000000013599'),
  false, 'Mesita Pay defaults Off');

select lives_ok(
  $$update public.place_payment_settings set house_credits = true, cash_payments = true, cash_cashback_bps = 200
     where place_id = '00000000-0000-4000-8000-000000013599'$$,
  'House Credits and Cash Payments do not need Stripe');

select throws_ok(
  $$update public.place_payment_settings set pay_cards = true where place_id = '00000000-0000-4000-8000-000000013599'$$,
  '23514', null, 'Mesita Pay On without Stripe is refused');
select throws_ok(
  $$update public.place_payment_settings set card_cashback_bps = 500 where place_id = '00000000-0000-4000-8000-000000013599'$$,
  '23514', null, 'Cashback-as-Credits On without Stripe is refused');
select throws_ok(
  $$update public.place_payment_settings set voucher_vip = true where place_id = '00000000-0000-4000-8000-000000013599'$$,
  '23514', null, 'a voucher On without Stripe is refused');
select throws_ok(
  $$update public.place_payment_settings set prepayments = true where place_id = '00000000-0000-4000-8000-000000013599'$$,
  '23514', null, 'Mesita Prepayments On without Stripe is refused (MESITA-3597)');

-- ━━━ An account that cannot charge yet ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

insert into public.place_payment_accounts (place_id, stripe_account_id, livemode, charges_enabled)
values ('00000000-0000-4000-8000-000000013599', 'acct_test_3599', false, false);

select throws_ok(
  $$update public.place_payment_settings set pay_cards = true where place_id = '00000000-0000-4000-8000-000000013599'$$,
  '23514', null, 'an account still onboarding does not let Mesita Pay on');

-- ━━━ The account takes cards ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

update public.place_payment_accounts set charges_enabled = true where place_id = '00000000-0000-4000-8000-000000013599';

select lives_ok(
  $$update public.place_payment_settings set pay_cards = true, card_cashback_bps = 500, voucher_vip = true
     where place_id = '00000000-0000-4000-8000-000000013599'$$,
  'with charges enabled, Mesita Pay, its cashback and a voucher turn on');

-- Stripe pauses charges: the stored switches stay (money-state hides them
-- from guests), an unrelated save still works, and Off always works.
update public.place_payment_accounts set charges_enabled = false where place_id = '00000000-0000-4000-8000-000000013599';

select lives_ok(
  $$update public.place_payment_settings set cash_payments = false where place_id = '00000000-0000-4000-8000-000000013599'$$,
  'an unrelated save never re-checks Stripe');
select lives_ok(
  $$update public.place_payment_settings set pay_cards = false, card_cashback_bps = null, voucher_vip = false
     where place_id = '00000000-0000-4000-8000-000000013599'$$,
  'turning Off never needs Stripe');
select throws_ok(
  $$update public.place_payment_settings set pay_cards = true where place_id = '00000000-0000-4000-8000-000000013599'$$,
  '23514', null, 'once Stripe stops charging, Mesita Pay cannot turn back on');

select * from finish();
rollback;
