-- MESITA-3302 — Wallet on Connect: the ledger credits a paid purchase once
-- (voucher plus bonus, Pending until available_at), refunds apply a
-- cumulative amount in any order and never push a balance below zero, the
-- new statuses and entry kinds hold their shape, Welcome is once per guest
-- per place, a place's open charge codes are unique, and nobody but the EFs
-- touches any of it.

begin;

create extension if not exists pgtap with schema public;

select plan(35);

insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000a3302'),
  ('00000000-0000-4000-8000-0000000b3302'),
  ('00000000-0000-4000-8000-0000000c3302');
insert into public.consumers (id) values
  ('00000000-0000-4000-8000-0000000a3302'),
  ('00000000-0000-4000-8000-0000000b3302'),
  ('00000000-0000-4000-8000-0000000c3302');
insert into public.place_profiles (id, google_name)
values ('00000000-0000-4000-8000-000000003302', 'Ledger Probe');
insert into public.places (id, slug, state, content_state, currency)
values ('00000000-0000-4000-8000-000000003302', 'mesita-3302-probe', 'active', 'generating', 'MXN');

-- ━━━ EF-only ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select ok(
  (select bool_and(c.relrowsecurity) from pg_class c
    where c.oid in ('public.wallet_purchases'::regclass, 'public.wallet_entries'::regclass,
                    'public.wallet_payments'::regclass, 'public.wallet_refund_attempts'::regclass,
                    'public.place_charges'::regclass, 'public.place_charge_tries'::regclass,
                    'public.stripe_connect_events'::regclass, 'public.place_codes'::regclass))
    and not exists (select 1 from pg_policies where schemaname = 'public'
                     and tablename in ('wallet_purchases', 'wallet_entries', 'wallet_payments',
                                       'wallet_refund_attempts', 'place_charges', 'place_charge_tries',
                                       'stripe_connect_events', 'place_codes')),
  'the eight money tables have RLS on and no policy: the EF-only lockdown'
);

select ok(
  not has_table_privilege('anon', 'public.wallet_payments', 'SELECT')
    and not has_table_privilege('authenticated', 'public.wallet_payments', 'SELECT')
    and not has_table_privilege('authenticated', 'public.wallet_entries', 'INSERT')
    and not has_table_privilege('authenticated', 'public.place_charges', 'SELECT')
    and not has_table_privilege('authenticated', 'public.stripe_connect_events', 'SELECT')
    and not has_function_privilege('authenticated', 'public.wallet_credit_purchase(uuid, text, timestamptz)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.wallet_refund_purchase(uuid, integer, text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.wallet_refund_payment(uuid, integer, text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.wallet_balance(uuid, uuid, text, boolean, timestamptz)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.place_code_check(uuid, text)', 'EXECUTE'),
  'client roles hold nothing on the ledger; every wallet_* function and place_code_check are service-role only'
);

select hasnt_function('public', 'wallet_credit_purchase', array['uuid', 'text'],
  'the two-argument wallet_credit_purchase of MESITA-3097 is gone');

-- ━━━ A voucher is credited once, Pending until its hour ━━━━━━━━━━━━━━━━━━━━

insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, application_fee_cents, stripe_checkout_session_id)
values ('00000000-0000-4000-8000-0000000d3302', '00000000-0000-4000-8000-0000000a3302',
        '00000000-0000-4000-8000-000000003302', 20000, 'mxn', 'open', 'acct_test_3302',
        'voucher_200', 2000, 1000, 'cs_test_3302');

select is(
  wallet_credit_purchase('00000000-0000-4000-8000-0000000d3302', 'pi_test_3302', now() + interval '1 hour') ->> 'outcome',
  'credited',
  'a paid voucher purchase is credited'
);

select is(
  wallet_credit_purchase('00000000-0000-4000-8000-0000000d3302', 'pi_test_3302', now() + interval '1 hour') ->> 'outcome',
  'already_paid',
  'crediting it again does nothing'
);

select is(
  (select array_agg(kind || ':' || amount_cents order by kind) from public.wallet_entries
    where purchase_id = '00000000-0000-4000-8000-0000000d3302'),
  array['bonus:2000', 'voucher:20000'],
  'the purchase wrote one voucher entry and one bonus entry'
);

select is(
  (select pending_cents from wallet_balance('00000000-0000-4000-8000-0000000a3302', '00000000-0000-4000-8000-000000003302', 'mxn', false, now())),
  22000,
  'both entries are Pending until the hour passes'
);

select is(
  (select available_cents from wallet_balance('00000000-0000-4000-8000-0000000a3302', '00000000-0000-4000-8000-000000003302', 'mxn', false, now() + interval '2 hours')),
  22000,
  'and Available once it has'
);

-- ━━━ Statuses and their paid_at ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

insert into public.wallet_purchases (consumer_id, place_id, amount_cents, currency, status, stripe_account_id, paid_at)
select '00000000-0000-4000-8000-0000000a3302', '00000000-0000-4000-8000-000000003302', 100000, 'mxn', s, 'acct_test_3302',
       case when s in ('refunded', 'partly_refunded', 'needs_review') then now() end
  from unnest(array['opening', 'open', 'failed', 'expired', 'refunded', 'partly_refunded', 'needs_review']) s;

select is(
  (select count(distinct status)::int from public.wallet_purchases where place_id = '00000000-0000-4000-8000-000000003302'),
  8,
  'a purchase row exists in each of the eight statuses'
);

select throws_ok(
  $$insert into public.wallet_purchases (consumer_id, place_id, amount_cents, currency, status, stripe_account_id)
    values ('00000000-0000-4000-8000-0000000a3302', '00000000-0000-4000-8000-000000003302', 100, 'mxn', 'paid', 'acct_test_3302')$$,
  '23514', null,
  'a paid purchase needs its paid_at'
);

select throws_ok(
  $$insert into public.wallet_purchases (consumer_id, place_id, amount_cents, currency, status, stripe_account_id)
    values ('00000000-0000-4000-8000-0000000a3302', '00000000-0000-4000-8000-000000003302', 100, 'mxn', 'held', 'acct_test_3302')$$,
  '23514', null,
  'an unknown status is refused'
);

-- ━━━ Welcome is once per guest per place ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

insert into public.wallet_purchases (consumer_id, place_id, amount_cents, currency, status, stripe_account_id, voucher, bonus_cents)
values ('00000000-0000-4000-8000-0000000a3302', '00000000-0000-4000-8000-000000003302', 10000, 'mxn', 'open', 'acct_test_3302', 'voucher_welcome', 3000);

select throws_ok(
  $$insert into public.wallet_purchases (consumer_id, place_id, amount_cents, currency, status, stripe_account_id, voucher, bonus_cents)
    values ('00000000-0000-4000-8000-0000000a3302', '00000000-0000-4000-8000-000000003302', 10000, 'mxn', 'open', 'acct_test_3302', 'voucher_welcome', 3000)$$,
  '23505', null,
  'a second Welcome for the same guest at the same place is refused'
);

select lives_ok(
  $$insert into public.wallet_purchases (consumer_id, place_id, amount_cents, currency, status, stripe_account_id, voucher, bonus_cents)
    values ('00000000-0000-4000-8000-0000000b3302', '00000000-0000-4000-8000-000000003302', 10000, 'mxn', 'open', 'acct_test_3302', 'voucher_welcome', 3000)$$,
  'another guest gets their own Welcome there'
);

-- ━━━ Entry kinds and their shape ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Guest C holds MX$50 of credit, then pays MX$150: MX$50 from credit, MX$100 by card.
insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id, voucher, bonus_cents)
values ('00000000-0000-4000-8000-0000000c4302', '00000000-0000-4000-8000-0000000c3302',
        '00000000-0000-4000-8000-000000003302', 5000, 'mxn', 'open', 'acct_test_3302', 'voucher_200', 0);

select is(
  wallet_credit_purchase('00000000-0000-4000-8000-0000000c4302', 'pi_c', now()) ->> 'outcome',
  'credited',
  'guest C''s credit is Available at once'
);

insert into public.wallet_payments (id, consumer_id, place_id, amount_cents, credit_cents, card_cents, currency, status,
                                    stripe_account_id, cashback_cents, paid_at)
values ('00000000-0000-4000-8000-0000000e3302', '00000000-0000-4000-8000-0000000c3302',
        '00000000-0000-4000-8000-000000003302', 15000, 5000, 10000, 'mxn', 'paid', 'acct_test_3302', 500, now());

select lives_ok(
  $$insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode)
    values ('00000000-0000-4000-8000-0000000c3302', '00000000-0000-4000-8000-000000003302', 'cashback', 500, 'mxn', '00000000-0000-4000-8000-0000000e3302', false),
           ('00000000-0000-4000-8000-0000000c3302', '00000000-0000-4000-8000-000000003302', 'spend', -5000, 'mxn', '00000000-0000-4000-8000-0000000e3302', false)$$,
  'a cashback and a spend entry hang off a payment'
);

select throws_ok(
  $$insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, payment_id, livemode)
    values ('00000000-0000-4000-8000-0000000c3302', '00000000-0000-4000-8000-000000003302', 'cashback', 500, 'mxn', '00000000-0000-4000-8000-0000000d3302', '00000000-0000-4000-8000-0000000e3302', false)$$,
  '23514', null,
  'a cashback entry names a payment or a purchase, never both (MESITA-3827)'
);

select throws_ok(
  $$insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode)
    values ('00000000-0000-4000-8000-0000000c3302', '00000000-0000-4000-8000-000000003302', 'spend', 5000, 'mxn', '00000000-0000-4000-8000-0000000e3302', false)$$,
  '23514', null,
  'a spend entry is negative'
);

select throws_ok(
  $$insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, livemode)
    values ('00000000-0000-4000-8000-0000000c3302', '00000000-0000-4000-8000-000000003302', 'voucher', 100, 'mxn', false)$$,
  '23514', null,
  'a voucher entry names its purchase'
);

select throws_ok(
  $$insert into public.wallet_payments (consumer_id, place_id, amount_cents, credit_cents, card_cents, currency, status)
    values ('00000000-0000-4000-8000-0000000c3302', '00000000-0000-4000-8000-000000003302', 100, 0, 100, 'mxn', 'opening')$$,
  '23514', null,
  'a payment with a card part names its connected account'
);

select throws_ok(
  $$insert into public.wallet_payments (consumer_id, place_id, amount_cents, credit_cents, card_cents, currency, status)
    values ('00000000-0000-4000-8000-0000000c3302', '00000000-0000-4000-8000-000000003302', 100, 30, 30, 'mxn', 'opening')$$,
  '23514', null,
  'a payment''s parts add up to its amount'
);

-- The held credit of an open mixed payment is not spendable twice.
insert into public.wallet_payments (consumer_id, place_id, amount_cents, credit_cents, card_cents, currency, status, stripe_account_id)
values ('00000000-0000-4000-8000-0000000a3302', '00000000-0000-4000-8000-000000003302', 12000, 2000, 10000, 'mxn', 'open', 'acct_test_3302');

select is(
  (select array[available_cents, held_cents, spendable_cents]
     from wallet_balance('00000000-0000-4000-8000-0000000a3302', '00000000-0000-4000-8000-000000003302', 'mxn', false, now() + interval '2 hours')),
  array[22000, 2000, 20000],
  'an open mixed payment holds its credit part: spendable is available minus held'
);

-- ━━━ Refunds: cumulative, any order, never below zero ━━━━━━━━━━━━━━━━━━━━━

-- The second partial event (cumulative 15,000) arrives first.
select is(
  wallet_refund_purchase('00000000-0000-4000-8000-0000000d3302', 15000) ->> 'reversed_cents',
  '16500',
  'a partial refund reverses its principal plus the bonus''s share'
);

select is(
  wallet_refund_purchase('00000000-0000-4000-8000-0000000d3302', 5000) ->> 'outcome',
  'already_applied',
  'the first partial event, arriving late with a smaller cumulative amount, changes nothing'
);

select is(
  wallet_refund_purchase('00000000-0000-4000-8000-0000000d3302', 20000) ->> 'status',
  'refunded',
  'the full refund applies only the difference and the purchase reads refunded'
);

select is(
  (select array[refunded_cents, uncovered_cents] from public.wallet_purchases where id = '00000000-0000-4000-8000-0000000d3302'),
  array[20000, 0],
  'the baseline holds the cumulative amount; nothing was uncovered'
);

select is(
  (select coalesce(sum(amount_cents), 0)::int from public.wallet_entries
    where consumer_id = '00000000-0000-4000-8000-0000000a3302' and place_id = '00000000-0000-4000-8000-000000003302'),
  0,
  'the voucher and its bonus are reversed exactly once in total'
);

-- Over-spent: guest B bought 10,000, spent 8,000, then the purchase is refunded in full.
insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id, voucher, bonus_cents)
values ('00000000-0000-4000-8000-0000000f3302', '00000000-0000-4000-8000-0000000b3302',
        '00000000-0000-4000-8000-000000003302', 10000, 'mxn', 'open', 'acct_test_3302', 'voucher_200', 0);
select is(
  wallet_credit_purchase('00000000-0000-4000-8000-0000000f3302', 'pi_b', now()) ->> 'outcome',
  'credited',
  'guest B''s voucher is credited, Available at once'
);
insert into public.wallet_payments (id, consumer_id, place_id, amount_cents, credit_cents, card_cents, currency, status, paid_at)
values ('00000000-0000-4000-8000-0000000a4302', '00000000-0000-4000-8000-0000000b3302',
        '00000000-0000-4000-8000-000000003302', 8000, 8000, 0, 'mxn', 'paid', now());
insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode)
values ('00000000-0000-4000-8000-0000000b3302', '00000000-0000-4000-8000-000000003302', 'spend', -8000, 'mxn', '00000000-0000-4000-8000-0000000a4302', false);

select is(
  (select r ->> 'status' || ':' || (r ->> 'reversed_cents') || ':' || (r ->> 'uncovered_cents')
     from wallet_refund_purchase('00000000-0000-4000-8000-0000000f3302', 10000) r),
  'needs_review:2000:8000',
  'a refund larger than the unspent credit reverses what is left and flags the rest'
);

select is(
  (select spendable_cents from wallet_balance('00000000-0000-4000-8000-0000000b3302', '00000000-0000-4000-8000-000000003302', 'mxn', false, now())),
  0,
  'the balance never goes below zero'
);

-- A payment's card part (MESITA-3305): a partial refund takes back the
-- cashback's refunded share (4000 of 10000 → 200 of 500), a full one the rest.
select is(
  (select r ->> 'status' || ':' || (r ->> 'reversed_cents')
     from wallet_refund_payment('00000000-0000-4000-8000-0000000e3302', 4000) r),
  'partly_refunded:200',
  'a partial refund of the card part reverses the cashback''s refunded share'
);

select is(
  (select r ->> 'status' || ':' || (r ->> 'reversed_cents')
     from wallet_refund_payment('00000000-0000-4000-8000-0000000e3302', 10000) r),
  'refunded:300',
  'a full refund of the card part reverses the rest of the cashback'
);

-- ━━━ The waiter's charge ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

insert into public.place_charges (id, place_id, code_hash, token_hash, amount_cents, currency, expires_at)
values ('00000000-0000-4000-8000-0000000b4302', '00000000-0000-4000-8000-000000003302', 'code-1234', 'tok-1', 25000, 'mxn', now() + interval '10 minutes');

select throws_ok(
  $$insert into public.place_charges (place_id, code_hash, token_hash, amount_cents, currency, expires_at)
    values ('00000000-0000-4000-8000-000000003302', 'code-1234', 'tok-2', 100, 'mxn', now() + interval '10 minutes')$$,
  '23505', null,
  'a code is unique among a place''s open charges'
);

update public.place_charges set paid_at = now() where id = '00000000-0000-4000-8000-0000000b4302';

select lives_ok(
  $$insert into public.place_charges (place_id, code_hash, token_hash, amount_cents, currency, expires_at)
    values ('00000000-0000-4000-8000-000000003302', 'code-1234', 'tok-3', 100, 'mxn', now() + interval '10 minutes')$$,
  'once that charge is paid the code can be used again'
);

insert into public.place_codes (place_id, code_hash) values ('00000000-0000-4000-8000-000000003302', 'hash-3302');

select ok(
  place_code_check('00000000-0000-4000-8000-000000003302', 'hash-3302')
    and not place_code_check('00000000-0000-4000-8000-000000003302', 'hash-wrong'),
  'place_code_check answers by hash'
);

-- ━━━ History is never edited ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select throws_ok(
  $$update public.wallet_entries set amount_cents = 1
     where consumer_id = '00000000-0000-4000-8000-0000000a3302'$$,
  'P0001', null,
  'an entry is never edited'
);

select * from finish();

rollback;
