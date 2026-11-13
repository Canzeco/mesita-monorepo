-- MESITA-3827 — Cashback-as-Credits on every way to pay. Credits Payments
-- Cashback is Off or 2% on the credit part; Mesita Prepayments Cashback is
-- Off or 5% on a voucher's price (and needs Stripe). Rows stamp their rate
-- when written. A payment's card and credit parts make ONE cashback entry,
-- each part rounded down; a card refund never takes the credit part's share
-- and a credit refund takes only its own; a voucher's cashback is written
-- once with its credit and its refunded share comes back; an unsigned guest
-- tab earns nothing until the signature.

begin;

create extension if not exists pgtap with schema public;

select plan(25);

insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000a3827'),
  ('00000000-0000-4000-8000-0000000b3827');
insert into public.consumers (id) values ('00000000-0000-4000-8000-0000000a3827');
insert into public.place_profiles (id, google_name) values
  ('00000000-0000-4000-8000-000000013827', 'Cashback Probe'),
  ('00000000-0000-4000-8000-000000023827', 'No Stripe Probe');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000013827', 'mesita-3827-probe', 'active', 'generating', 'MXN'),
  ('00000000-0000-4000-8000-000000023827', 'mesita-3827-nostripe', 'active', 'generating', 'MXN');
insert into public.place_payment_accounts (place_id, stripe_account_id, livemode, charges_enabled)
values ('00000000-0000-4000-8000-000000013827', 'acct_test_3827', false, true);
insert into public.house_credits_contracts (place_id, signed_by, signer_role, terms_version, text_sha256) values
  ('00000000-0000-4000-8000-000000013827', '00000000-0000-4000-8000-0000000b3827', 'owner', 'draft-2026-11', repeat('0', 64)),
  ('00000000-0000-4000-8000-000000023827', '00000000-0000-4000-8000-0000000b3827', 'owner', 'draft-2026-11', repeat('0', 64));
insert into public.place_payment_settings (place_id, house_credits) values
  ('00000000-0000-4000-8000-000000013827', true),
  ('00000000-0000-4000-8000-000000023827', true);

-- The guest holds MX$1,100 Available here: a MX$1,000 voucher bought while
-- every cashback was Off (+ its MX$100 bonus).
insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, application_fee_cents, stripe_checkout_session_id)
values ('00000000-0000-4000-8000-0000000d3827', '00000000-0000-4000-8000-0000000a3827',
        '00000000-0000-4000-8000-000000013827', 100000, 'mxn', 'open', 'acct_test_3827',
        'voucher_1000', 10000, 5000, 'cs_test_3827a');
do $$ begin
  perform wallet_credit_purchase('00000000-0000-4000-8000-0000000d3827', 'pi_test_3827a', now() - interval '1 minute');
end $$;

-- ━━━ The switches ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select throws_ok(
  $$update public.place_payment_settings set credit_cashback_bps = 300 where place_id = '00000000-0000-4000-8000-000000013827'$$,
  '23514', null, 'a credits rate other than 2% is refused');
select throws_ok(
  $$update public.place_payment_settings set prepay_cashback_bps = 400 where place_id = '00000000-0000-4000-8000-000000013827'$$,
  '23514', null, 'a prepayments rate other than 5% is refused');
select throws_ok(
  $$update public.place_payment_settings set prepay_cashback_bps = 500 where place_id = '00000000-0000-4000-8000-000000023827'$$,
  '23514', null, 'Prepayments Cashback On without a Stripe account is refused');
select lives_ok(
  $$update public.place_payment_settings set credit_cashback_bps = 200 where place_id = '00000000-0000-4000-8000-000000023827'$$,
  'Credits Payments Cashback needs no Stripe account');
select lives_ok(
  $$update public.place_payment_settings
       set credit_cashback_bps = 200, prepayments = true, voucher_200 = true, prepay_cashback_bps = 500
     where place_id = '00000000-0000-4000-8000-000000013827'$$,
  'with Stripe: 2% on credits and 5% on prepayments turn on');

select is(
  (select cashback_bps || ':' || cashback_cents from public.wallet_purchases where id = '00000000-0000-4000-8000-0000000d3827'),
  '0:0',
  'the voucher bought while it was Off keeps no cashback');

-- ━━━ A direct credit payment ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- MX$10.99 from credit, p_cashback on: 2% is 21.98 → 21 centavos.
create temp table pay as
  select wallet_pay_credit('00000000-0000-4000-8000-0000000a3827', '00000000-0000-4000-8000-000000013827', 1099, 'MXN', false,
                           '00000000-0000-4000-8000-00000000b001', 'bbbbbbbbbbbbbbbbbbbbb1', null, true) as r;

select is(
  (select credit_cashback_bps || ':' || credit_cashback_cents || ':' || cashback_cents
     from public.wallet_payments where id = (select (r ->> 'payment_id')::uuid from pay)),
  '200:21:0',
  'the credit row stamps 2% and keeps 21 centavos as its credit part''s cashback');
select is(
  (select count(*)::int || ':' || sum(amount_cents)::int || ':' || bool_and(available_at > now() + interval '59 minutes')
     from public.wallet_entries where payment_id = (select (r ->> 'payment_id')::uuid from pay) and kind = 'cashback'),
  '1:21:true',
  'one cashback entry of 21, Pending for the hour');

-- The same payment without p_cashback (an SQL caller): no cashback.
create temp table quiet as
  select wallet_pay_credit('00000000-0000-4000-8000-0000000a3827', '00000000-0000-4000-8000-000000013827', 5000, 'MXN', false,
                           '00000000-0000-4000-8000-00000000b002', 'bbbbbbbbbbbbbbbbbbbbb2') as r;
select is(
  (select count(*)::int from public.wallet_entries
    where payment_id = (select (r ->> 'payment_id')::uuid from quiet) and kind = 'cashback'),
  0,
  'without p_cashback the credit payment earns nothing');
select is(
  public.wallet_grant_cashback((select (r ->> 'payment_id')::uuid from pay)),
  0,
  'granting twice writes nothing');

-- ━━━ A card payment with a credit part ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- MX$20 from credit, MX$5 by card, 5% card cashback: card 25, credit 40.
create temp table mixed as
  select wallet_hold_payment('00000000-0000-4000-8000-0000000a3827', '00000000-0000-4000-8000-000000013827', 2000, 500, 0,
                             'MXN', false, '00000000-0000-4000-8000-00000000b003', 'bbbbbbbbbbbbbbbbbbbbb3', null,
                             'acct_test_3827', 25, 500, now() + interval '31 minutes') as r;
do $$ begin
  perform wallet_settle_payment((select (r ->> 'payment_id')::uuid from mixed), 'pi_test_3827m');
end $$;

select is(
  (select cashback_cents || ':' || credit_cashback_cents from public.wallet_payments
    where id = (select (r ->> 'payment_id')::uuid from mixed)),
  '25:40',
  'settling keeps each part: card 25, credit 40');
select is(
  (select count(*)::int || ':' || sum(amount_cents)::int from public.wallet_entries
    where payment_id = (select (r ->> 'payment_id')::uuid from mixed) and kind = 'cashback'),
  '1:65',
  'and writes ONE cashback entry of their sum');

-- A full card refund takes back the card's 25, never the credit's 40.
do $$ begin
  perform wallet_refund_payment((select (r ->> 'payment_id')::uuid from mixed), 500);
end $$;
select is(
  (select -sum(amount_cents)::int from public.wallet_entries
    where payment_id = (select (r ->> 'payment_id')::uuid from mixed) and kind = 'reversal'),
  25,
  'a full card refund reverses only the card part''s 25');

-- Half the credit part back: 20 of its 40 comes back with it.
insert into public.wallet_refund_attempts (id, payment_id, amount_cents, status)
values ('00000000-0000-4000-8000-0000000e3827', (select (r ->> 'payment_id')::uuid from mixed), 1000, 'pending');
select is(
  public.wallet_refund_credit('00000000-0000-4000-8000-0000000e3827') ->> 'outcome',
  'applied',
  'half the credit part is refunded');
select is(
  (select -sum(amount_cents)::int from public.wallet_entries
    where payment_id = (select (r ->> 'payment_id')::uuid from mixed) and kind = 'reversal' and reason = 'credit_refund'),
  20,
  'and half the credit part''s cashback (20) is reversed, marked credit_refund');

-- A further card refund call cannot count the credit reversal as its own.
select is(
  wallet_refund_payment((select (r ->> 'payment_id')::uuid from mixed), 500) ->> 'outcome',
  'already_applied',
  'replaying the card refund changes nothing');

-- ━━━ A guest tab earns at the signature ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

insert into public.pay_tabs (id, place_id, consumer_id, token_hash, status, currency, livemode, bill_cents, tip_cents,
                             bill_version, billed_at, paid_at, expires_at, origin)
values ('00000000-0000-4000-8000-0000000f3827', '00000000-0000-4000-8000-000000013827', '00000000-0000-4000-8000-0000000a3827',
        repeat('a', 64), 'paid', 'mxn', false, 3000, 0, 1, now(), now(), now() + interval '3 hours', 'guest');
create temp table tabpay as
  select wallet_pay_credit('00000000-0000-4000-8000-0000000a3827', '00000000-0000-4000-8000-000000013827', 3000, 'MXN', false,
                           '00000000-0000-4000-8000-00000000b004', 'bbbbbbbbbbbbbbbbbbbbb4') as r;
update public.wallet_payments set tab_id = '00000000-0000-4000-8000-0000000f3827', part = 'credit'
 where id = (select (r ->> 'payment_id')::uuid from tabpay);

select is(
  public.wallet_grant_cashback((select (r ->> 'payment_id')::uuid from tabpay)),
  0,
  'an unsigned guest tab''s credit part earns nothing');
update public.pay_tabs set verified_at = now(), verified_key_hash = repeat('b', 64) where id = '00000000-0000-4000-8000-0000000f3827';
select is(
  public.pay_tab_card_cashback('00000000-0000-4000-8000-0000000f3827'),
  60,
  'the signature writes the credit part''s 2% (60)');

-- ━━━ A voucher with Prepayments Cashback ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, application_fee_cents, stripe_checkout_session_id)
values ('00000000-0000-4000-8000-0000000c3827', '00000000-0000-4000-8000-0000000a3827',
        '00000000-0000-4000-8000-000000013827', 20000, 'mxn', 'open', 'acct_test_3827',
        'voucher_200', 2000, 1000, 'cs_test_3827b');
select is(
  (select cashback_bps from public.wallet_purchases where id = '00000000-0000-4000-8000-0000000c3827'),
  500,
  'a voucher opened while Prepayments Cashback is on stamps 5%');

do $$ begin
  perform wallet_credit_purchase('00000000-0000-4000-8000-0000000c3827', 'pi_test_3827b', now() + interval '1 hour');
  perform wallet_credit_purchase('00000000-0000-4000-8000-0000000c3827', 'pi_test_3827b', now() + interval '1 hour');
end $$;
select is(
  (select string_agg(kind || '=' || amount_cents, ',' order by kind) from public.wallet_entries
    where purchase_id = '00000000-0000-4000-8000-0000000c3827'),
  'bonus=2000,cashback=1000,voucher=20000',
  'the voucher writes its credit, its bonus and 5% of its price, once');
select is(
  (select cashback_cents from public.wallet_purchases where id = '00000000-0000-4000-8000-0000000c3827'),
  1000,
  'and records the 1000 on the purchase');
select is(
  (select bool_and(available_at > now() + interval '59 minutes') from public.wallet_entries
    where purchase_id = '00000000-0000-4000-8000-0000000c3827' and kind = 'cashback'),
  true,
  'the cashback lands when the voucher''s credit lands');

-- Half the voucher refunded: 10000 + 1000 bonus + 500 cashback come back.
select is(
  (wallet_refund_purchase('00000000-0000-4000-8000-0000000c3827', 10000) ->> 'reversed_cents')::int,
  11500,
  'a half refund takes back half the price, half the bonus and half the cashback');

select throws_ok(
  $$insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
    values ('00000000-0000-4000-8000-0000000a3827', '00000000-0000-4000-8000-000000013827', 'cashback', 1, 'mxn',
            '00000000-0000-4000-8000-0000000c3827', false, now())$$,
  '23505', null,
  'a purchase never gets a second cashback entry');
select ok(
  not has_function_privilege('authenticated', 'public.wallet_grant_cashback(uuid, timestamptz)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.wallet_grant_cashback(uuid, timestamptz)', 'EXECUTE'),
  'client roles cannot run wallet_grant_cashback');

select * from finish();
rollback;
