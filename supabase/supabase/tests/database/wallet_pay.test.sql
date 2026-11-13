-- MESITA-3304 — W2a: paying from credit. wallet_pay_credit spends once per
-- request_id under the pair lock, refuses more than spendable, writes one
-- paid payment and one spend entry Available at once, answers a reused
-- request_id with `taken` and the existing payment's id, lowercases the
-- currency, and counts an open mixed payment's hold; wallet_balances agrees
-- with wallet_balance; nobody but the service role runs either.

begin;

create extension if not exists pgtap with schema public;

select plan(28);

insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000a3304'),
  ('00000000-0000-4000-8000-0000000b3304');
insert into public.consumers (id) values
  ('00000000-0000-4000-8000-0000000a3304'),
  ('00000000-0000-4000-8000-0000000b3304');
insert into public.place_profiles (id, google_name) values
  ('00000000-0000-4000-8000-000000013304', 'Pay Probe One'),
  ('00000000-0000-4000-8000-000000023304', 'Pay Probe Two');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000013304', 'mesita-3304-probe-one', 'active', 'generating', 'MXN'),
  ('00000000-0000-4000-8000-000000023304', 'mesita-3304-probe-two', 'active', 'generating', 'MXN');

-- Guest A holds MX$220 Available at place one: a MX$200 voucher plus its
-- MX$20 bonus, credited with an hour already gone by.
insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, application_fee_cents, stripe_checkout_session_id)
values ('00000000-0000-4000-8000-0000000d3304', '00000000-0000-4000-8000-0000000a3304',
        '00000000-0000-4000-8000-000000013304', 20000, 'mxn', 'open', 'acct_test_3304',
        'voucher_200', 2000, 1000, 'cs_test_3304');
do $$ begin
  perform wallet_credit_purchase('00000000-0000-4000-8000-0000000d3304', 'pi_test_3304', now() - interval '1 minute');
end $$;

-- ━━━ Shape and access ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select has_column('public', 'wallet_payments', 'proof_token', 'payments carry a proof token');
select has_column('public', 'wallet_payments', 'proof_seen_at', 'payments carry the seen stamp');

select ok(
  not has_function_privilege('authenticated', 'public.wallet_pay_credit(uuid, uuid, integer, text, boolean, uuid, text, text, boolean)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.wallet_pay_credit(uuid, uuid, integer, text, boolean, uuid, text, text, boolean)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.wallet_balances(uuid, boolean, timestamptz)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.wallet_balances(uuid, boolean, timestamptz)', 'EXECUTE'),
  'client roles cannot run wallet_pay_credit or wallet_balances'
);

select throws_ok(
  $$insert into public.wallet_payments (consumer_id, place_id, amount_cents, credit_cents, currency, status, paid_at, proof_token)
    values ('00000000-0000-4000-8000-0000000b3304', '00000000-0000-4000-8000-000000023304', 100, 100, 'mxn', 'paid', now(), 'short')$$,
  '23514', null,
  'a proof token is 22 base64url characters or nothing'
);

-- ━━━ The lock is taken for the pair ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Counted on a fresh pair (guest B, place one): wallet_credit_purchase above
-- already holds guest A's lock in this transaction, and re-acquiring a held
-- transaction-level advisory lock adds no pg_locks row.

create temp table lock_before as
  select count(*)::int as n from pg_locks where locktype = 'advisory' and granted and pid = pg_backend_pid();

select is(
  wallet_pay_credit('00000000-0000-4000-8000-0000000b3304', '00000000-0000-4000-8000-000000013304', 100, 'mxn', false,
                    '00000000-0000-4000-8000-00000000b001', 'bbbbbbbbbbbbbbbbbbbbbb', null) ->> 'code',
  'insufficient',
  'a guest with no credit here cannot pay'
);

select is(
  (select count(*)::int from pg_locks where locktype = 'advisory' and granted and pid = pg_backend_pid()),
  (select n + 1 from lock_before),
  'the call took the advisory lock for its (guest, place) pair'
);

-- ━━━ One payment, once ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create temp table first_pay as
  select wallet_pay_credit('00000000-0000-4000-8000-0000000a3304', '00000000-0000-4000-8000-000000013304', 5000, 'mxn', false,
                           '00000000-0000-4000-8000-00000000a001', 'aaaaaaaaaaaaaaaaaaaaa1', 'T-12') as r;

select is((select r ->> 'outcome' from first_pay), 'paid', 'a guest with MX$220 pays MX$50');

select is(
  (select available_cents from wallet_balance('00000000-0000-4000-8000-0000000a3304', '00000000-0000-4000-8000-000000013304', 'mxn', false)),
  17000,
  'and has MX$170 Available after it'
);

select is(
  (select status || ':' || amount_cents || ':' || credit_cents || ':' || card_cents || ':' || coalesce(stripe_account_id, 'none')
          || ':' || proof_token || ':' || ticket
     from public.wallet_payments where id = (select (r ->> 'payment_id')::uuid from first_pay)),
  'paid:5000:5000:0:none:aaaaaaaaaaaaaaaaaaaaa1:T-12',
  'the payment is paid, all credit, no account, with its proof token and ticket'
);

select is(
  (select kind || ':' || amount_cents || ':' || coalesce(purchase_id::text, 'none') || ':' || (available_at <= now())::text
     from public.wallet_entries where payment_id = (select (r ->> 'payment_id')::uuid from first_pay)),
  'spend:-5000:none:true',
  'one spend entry, negative, tied to the payment, Available at once'
);

-- ━━━ The same request_id ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create temp table replay as
  select wallet_pay_credit('00000000-0000-4000-8000-0000000a3304', '00000000-0000-4000-8000-000000013304', 5000, 'mxn', false,
                           '00000000-0000-4000-8000-00000000a001', 'aaaaaaaaaaaaaaaaaaaaa2', 'T-12') as r;

select is((select r ->> 'outcome' from replay), 'already_paid', 'a replay of the same tap answers already_paid');

select is(
  (select (r ->> 'payment_id') || ':' || (r ->> 'proof_token') from replay),
  (select (r ->> 'payment_id') || ':aaaaaaaaaaaaaaaaaaaaa1' from first_pay),
  'with the first payment and its first proof token'
);

select is(
  (select count(*)::int from public.wallet_payments where consumer_id = '00000000-0000-4000-8000-0000000a3304')
    + (select count(*)::int from public.wallet_entries where consumer_id = '00000000-0000-4000-8000-0000000a3304' and kind = 'spend'),
  2,
  'and writes nothing: one payment, one spend entry'
);

select is(
  wallet_pay_credit('00000000-0000-4000-8000-0000000a3304', '00000000-0000-4000-8000-000000013304', 6000, 'mxn', false,
                    '00000000-0000-4000-8000-00000000a001', 'aaaaaaaaaaaaaaaaaaaaa3', null),
  jsonb_build_object('ok', false, 'code', 'taken', 'payment_id', (select r ->> 'payment_id' from first_pay)),
  'the same request_id with another amount is taken, naming the payment it already made'
);

select is(
  wallet_pay_credit('00000000-0000-4000-8000-0000000a3304', '00000000-0000-4000-8000-000000013304', 5000, 'mxn', true,
                    '00000000-0000-4000-8000-00000000a001', 'aaaaaaaaaaaaaaaaaaaaa4', null) ->> 'code',
  'taken',
  'and from the other Stripe universe it is taken too'
);

insert into public.wallet_payments (id, consumer_id, place_id, amount_cents, credit_cents, currency, status, paid_at, request_id)
values ('00000000-0000-4000-8000-0000000e3304', '00000000-0000-4000-8000-0000000a3304',
        '00000000-0000-4000-8000-000000023304', 100, 100, 'mxn', 'paid', now(), '00000000-0000-4000-8000-00000000a002');

select is(
  wallet_pay_credit('00000000-0000-4000-8000-0000000a3304', '00000000-0000-4000-8000-000000013304', 100, 'mxn', false,
                    '00000000-0000-4000-8000-00000000a002', 'aaaaaaaaaaaaaaaaaaaaa5', null),
  '{"ok": false, "code": "taken", "payment_id": "00000000-0000-4000-8000-0000000e3304"}'::jsonb,
  'a request_id already used at another place is taken, never an error'
);

update public.wallet_payments set status = 'refunded' where id = '00000000-0000-4000-8000-0000000e3304';

select is(
  wallet_pay_credit('00000000-0000-4000-8000-0000000a3304', '00000000-0000-4000-8000-000000023304', 100, 'mxn', false,
                    '00000000-0000-4000-8000-00000000a002', 'aaaaaaaaaaaaaaaaaaaaa6', null) ->> 'status',
  'refunded',
  'a replay answers the row''s status as it stands now'
);

-- ━━━ Refusals ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  wallet_pay_credit('00000000-0000-4000-8000-0000000a3304', '00000000-0000-4000-8000-000000013304', 999999, 'mxn', false,
                    '00000000-0000-4000-8000-00000000a003', 'aaaaaaaaaaaaaaaaaaaaa7', null),
  '{"ok": false, "code": "insufficient", "spendable_cents": 17000}'::jsonb,
  'more than spendable is insufficient, with what can be spent'
);

select is(
  wallet_pay_credit('00000000-0000-4000-8000-0000000a3304', '00000000-0000-4000-8000-000000013304', 0, 'mxn', false,
                    '00000000-0000-4000-8000-00000000a004', 'aaaaaaaaaaaaaaaaaaaaa8', null) ->> 'code',
  'amount_required',
  'nothing to pay is amount_required'
);

select is(
  wallet_pay_credit('00000000-0000-4000-8000-0000000a3304', '00000000-0000-4000-8000-000000013304', -100, 'mxn', false,
                    '00000000-0000-4000-8000-00000000a005', 'aaaaaaaaaaaaaaaaaaaaa9', null) ->> 'code',
  'amount_required',
  'and so is a negative amount'
);

select is(
  (select count(*)::int from public.wallet_payments where consumer_id = '00000000-0000-4000-8000-0000000a3304'
      and request_id in ('00000000-0000-4000-8000-00000000a003', '00000000-0000-4000-8000-00000000a004',
                         '00000000-0000-4000-8000-00000000a005')),
  0,
  'and none of the refusals wrote a payment'
);

-- ━━━ Currency ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  wallet_pay_credit('00000000-0000-4000-8000-0000000a3304', '00000000-0000-4000-8000-000000013304', 1000, 'MXN', false,
                    '00000000-0000-4000-8000-00000000a006', 'aaaaaaaaaaaaaaaaaaaab1', null) ->> 'currency',
  'mxn',
  'a place''s MXN reaches the ledger as mxn'
);

select is(
  (select available_cents from wallet_balance('00000000-0000-4000-8000-0000000a3304', '00000000-0000-4000-8000-000000013304', 'mxn', false)),
  16000,
  'and spends from the same balance'
);

-- ━━━ An open mixed payment holds its credit (W2b) ━━━━━━━━━━━━━━━━━━━━━━━━━━━

insert into public.wallet_payments (consumer_id, place_id, amount_cents, credit_cents, card_cents, currency, status,
                                    stripe_account_id, request_id)
values ('00000000-0000-4000-8000-0000000a3304', '00000000-0000-4000-8000-000000013304', 2500, 2000, 500, 'mxn', 'open',
        'acct_test_3304', '00000000-0000-4000-8000-00000000a007');

select is(
  (select spendable_cents from wallet_balance('00000000-0000-4000-8000-0000000a3304', '00000000-0000-4000-8000-000000013304', 'mxn', false)),
  14000,
  'an open mixed payment holds MX$20 of the MX$160'
);

select is(
  wallet_pay_credit('00000000-0000-4000-8000-0000000a3304', '00000000-0000-4000-8000-000000013304', 16000, 'mxn', false,
                    '00000000-0000-4000-8000-00000000a008', 'aaaaaaaaaaaaaaaaaaaab2', null),
  '{"ok": false, "code": "insufficient", "spendable_cents": 14000}'::jsonb,
  'so paying all of the Available amount is insufficient while it is held'
);

-- ━━━ wallet_balances agrees with wallet_balance ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select results_eq(
  $$select available_cents, pending_cents, held_cents, spendable_cents
      from wallet_balances('00000000-0000-4000-8000-0000000a3304', false)
     where place_id = '00000000-0000-4000-8000-000000013304' and currency = 'mxn'$$,
  $$select available_cents, pending_cents, held_cents, spendable_cents
      from wallet_balance('00000000-0000-4000-8000-0000000a3304', '00000000-0000-4000-8000-000000013304', 'mxn', false)$$,
  'wallet_balances answers what wallet_balance answers at a place with a hold'
);

select is(
  (select count(*)::int from wallet_balances('00000000-0000-4000-8000-0000000a3304', false)),
  1,
  'one row per place with entries or open payments in this universe'
);

select is(
  (select count(*)::int from wallet_balances('00000000-0000-4000-8000-0000000a3304', true)),
  0,
  'and none from the other universe'
);

select * from finish();

rollback;
