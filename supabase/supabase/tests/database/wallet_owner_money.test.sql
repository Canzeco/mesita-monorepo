-- MESITA-3307 — W3: place_money_summary is scoped to one place and one
-- universe (a live row never appears under test), its (created_at, id)
-- cursor pages equal timestamps once each and skips none, a tip stays out of
-- money received and the fee; wallet_refund_credit gives a credit-only
-- payment back as credit with no Stripe call and replays once; the
-- needs_review list names what an operator can re-read; nobody but the
-- service role runs any of it.
--
-- MESITA-3548: an outside bill (the waiter's Received) counts in money
-- received, its cash tip stays out of tips, and its row says the waiter
-- confirmed it; a Pay at the table card row and cash row under one tab both
-- count, only the card tip is a tip, and the tab is one bill in
-- received_share; an outside bill an operator refunded counts nothing.

begin;

create extension if not exists pgtap with schema public;

select plan(27);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000a3307', 'maria.lopez@example.com'),
  ('00000000-0000-4000-8000-0000000b3307', null);
insert into public.consumers (id, full_name) values
  ('00000000-0000-4000-8000-0000000a3307', null),
  ('00000000-0000-4000-8000-0000000b3307', 'Ana Ruiz');
insert into public.place_profiles (id, google_name) values
  ('00000000-0000-4000-8000-000000013307', 'Money Probe'),
  ('00000000-0000-4000-8000-000000023307', 'Other Probe');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000013307', 'mesita-3307-probe', 'active', 'generating', 'MXN'),
  ('00000000-0000-4000-8000-000000023307', 'mesita-3307-other', 'active', 'generating', 'MXN');

-- A paid MX$200 voucher at the place (test), its credit Available.
insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, application_fee_cents, stripe_checkout_session_id, created_at)
values ('00000000-0000-4000-8000-0000000d3307', '00000000-0000-4000-8000-0000000a3307',
        '00000000-0000-4000-8000-000000013307', 20000, 'mxn', 'open', 'acct_test_3307',
        'voucher_200', 2000, 1000, 'cs_test_3307', '2026-11-01T10:00:00Z');
do $$ begin
  perform wallet_credit_purchase('00000000-0000-4000-8000-0000000d3307', 'pi_test_3307', now() - interval '1 minute');
end $$;

-- A mixed payment: MX$50 credit + MX$100 card + MX$20 tip, fee MX$5.
insert into public.wallet_payments (id, consumer_id, place_id, amount_cents, credit_cents, card_cents, tip_cents, currency,
                                    status, stripe_account_id, application_fee_cents, paid_at, created_at)
values ('00000000-0000-4000-8000-0000000e3307', '00000000-0000-4000-8000-0000000b3307',
        '00000000-0000-4000-8000-000000013307', 15000, 5000, 10000, 2000, 'mxn', 'paid', 'acct_test_3307', 500,
        now(), '2026-11-02T10:00:00Z');

-- A live row at the same place, and a row at another place: neither may show.
insert into public.wallet_payments (consumer_id, place_id, amount_cents, credit_cents, card_cents, currency, status,
                                    stripe_account_id, application_fee_cents, paid_at, livemode, created_at)
values ('00000000-0000-4000-8000-0000000b3307', '00000000-0000-4000-8000-000000013307', 99900, 0, 99900, 'mxn', 'paid',
        'acct_live_3307', 4995, now(), true, '2026-11-02T11:00:00Z'),
       ('00000000-0000-4000-8000-0000000b3307', '00000000-0000-4000-8000-000000023307', 88800, 0, 88800, 'mxn', 'paid',
        'acct_test_other', 4440, now(), false, '2026-11-02T11:00:00Z');

-- An unpaid given-up row: no money moved, never a row.
insert into public.wallet_payments (consumer_id, place_id, amount_cents, credit_cents, card_cents, currency, status,
                                    stripe_account_id, stripe_error, created_at)
values ('00000000-0000-4000-8000-0000000b3307', '00000000-0000-4000-8000-000000013307', 7700, 0, 7700, 'mxn',
        'needs_review', 'acct_test_3307', 'resource_missing', '2026-11-03T10:00:00Z');

-- ━━━ Shape and access ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select ok(
  not has_function_privilege('authenticated', 'public.place_money_summary(uuid, timestamptz, timestamptz, boolean, timestamptz, uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.place_money_summary(uuid, timestamptz, timestamptz, boolean, timestamptz, uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.wallet_refund_credit(uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.wallet_needs_review_list(timestamptz, uuid)', 'EXECUTE'),
  'client roles cannot run any W3 function'
);

-- ━━━ The summary ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create temp table s as
  select place_money_summary('00000000-0000-4000-8000-000000013307', '2026-10-01', '2026-12-01', false) as j;

select is((select (j ->> 'received_cents')::int from s), 30000,
  'money received is the voucher plus the card part, tip excluded, live and other places excluded');
select is((select (j ->> 'fee_cents')::int from s), 1500, 'Mesita''s fee is the two test rows'' fees');
select is((select (j ->> 'tips_cents')::int from s), 2000, 'tips are counted apart');
select is((select (j ->> 'available_cents')::int from s), 22000, 'credit outstanding is the voucher and its bonus');
select is((select jsonb_array_length(j -> 'rows') from s), 2, 'two paid test rows; the live, the other place and the unpaid row never appear');
select is((select j -> 'rows' -> 0 ->> 'kind' from s), 'payment', 'newest first');
select is((select (j -> 'rows' -> 0 ->> 'amount_cents')::int from s), 17000, 'a payment row reads credit + card + tip');
select is((select j -> 'rows' -> 0 ->> 'guest_name' from s), 'Ana Ruiz', 'the guest''s name when set');
select is((select j -> 'rows' -> 1 ->> 'guest_email' from s), 'maria.lopez@example.com', 'else the email, for the EF to mask');
select ok((select j -> 'next' = 'null'::jsonb from s), 'no next page under 50 rows');

select is(
  (place_money_summary('00000000-0000-4000-8000-000000013307', '2026-10-01', '2026-12-01', true) -> 'rows' -> 0 ->> 'amount_cents')::int,
  99900,
  'the live universe answers its own row only'
);

-- ━━━ The cursor: 60 rows sharing one timestamp ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

insert into public.wallet_payments (consumer_id, place_id, amount_cents, credit_cents, card_cents, currency, status,
                                    stripe_account_id, paid_at, created_at)
select '00000000-0000-4000-8000-0000000b3307', '00000000-0000-4000-8000-000000023307', 100 + g, 0, 100 + g, 'mxn',
       'paid', 'acct_test_other', now(), '2026-11-05T12:00:00Z'
  from generate_series(1, 60) g;

create temp table p1 as
  select place_money_summary('00000000-0000-4000-8000-000000023307', '2026-11-05', '2026-11-06', false) as j;
create temp table p2 as
  select place_money_summary('00000000-0000-4000-8000-000000023307', '2026-11-05', '2026-11-06', false,
           (select (j -> 'next' ->> 'created_at')::timestamptz from p1),
           (select (j -> 'next' ->> 'id')::uuid from p1)) as j;

select is((select jsonb_array_length(j -> 'rows') from p1), 50, 'the first page is 50 rows');
select is((select jsonb_array_length(j -> 'rows') from p2), 10, 'the second page is the other 10');
select is(
  (select count(distinct x ->> 'id')::int from (
     select jsonb_array_elements(j -> 'rows') as x from p1
     union all select jsonb_array_elements(j -> 'rows') from p2) z),
  60,
  'equal timestamps page once each, none skipped'
);

-- ━━━ The credit part's refund ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Guest A pays MX$100 from credit only.
insert into public.wallet_payments (id, consumer_id, place_id, amount_cents, credit_cents, card_cents, currency, status, paid_at)
values ('00000000-0000-4000-8000-0000000f3307', '00000000-0000-4000-8000-0000000a3307',
        '00000000-0000-4000-8000-000000013307', 10000, 10000, 0, 'mxn', 'paid', now());
insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode)
values ('00000000-0000-4000-8000-0000000a3307', '00000000-0000-4000-8000-000000013307', 'spend', -10000, 'mxn',
        '00000000-0000-4000-8000-0000000f3307', false);
insert into public.wallet_refund_attempts (id, payment_id, amount_cents)
values ('00000000-0000-4000-8000-0000000c3307', '00000000-0000-4000-8000-0000000f3307', 10000);

select is(wallet_refund_credit('00000000-0000-4000-8000-0000000c3307') ->> 'status', 'refunded',
  'a full credit-only refund reads refunded');
select is(
  (select available_cents from wallet_balance('00000000-0000-4000-8000-0000000a3307', '00000000-0000-4000-8000-000000013307', 'mxn', false)),
  22000,
  'the guest''s balance is restored at once'
);
select is(wallet_refund_credit('00000000-0000-4000-8000-0000000c3307') ->> 'outcome', 'already_applied',
  'a replayed attempt credits once');

-- ━━━ The cash side (MESITA-3548) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

insert into public.place_profiles (id, google_name) values ('00000000-0000-4000-8000-000000033548', 'Cash Probe');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000033548', 'mesita-3548-cash', 'active', 'generating', 'MXN');
insert into public.pay_tabs (id, place_id, consumer_id, token_hash, status, currency, bill_cents, paid_at, expires_at)
values ('00000000-0000-4000-8000-0000000a3548', '00000000-0000-4000-8000-000000033548',
        '00000000-0000-4000-8000-0000000b3307', repeat('a', 64), 'paid', 'mxn', 40000, now(), now() + interval '30 minutes');

-- A: the waiter's code, bill MX$300: MX$100 credit, MX$200 in cash, a MX$30
-- cash tip, Received (paid_at set: the trigger names the waiter).
insert into public.wallet_payments (id, consumer_id, place_id, amount_cents, credit_cents, card_cents, outside_cents,
                                    tip_cents, currency, status, outside_cashback_bps, cashback_cents,
                                    charge_amount_cents, paid_at, created_at)
values ('00000000-0000-4000-8000-0000000c3548', '00000000-0000-4000-8000-0000000b3307',
        '00000000-0000-4000-8000-000000033548', 30000, 10000, 0, 20000, 3000, 'mxn', 'paid', 200, 400,
        30000, now(), '2026-11-04T10:00:00Z');
-- B: one tab, bill MX$400: a card row (MX$150 + a MX$20 card tip) and a cash
-- row (MX$250 + a MX$10 cash tip).
insert into public.wallet_payments (id, consumer_id, place_id, amount_cents, credit_cents, card_cents, outside_cents,
                                    tip_cents, currency, status, stripe_account_id, tab_id, part,
                                    charge_amount_cents, paid_at, created_at)
values ('00000000-0000-4000-8000-0000000d3548', '00000000-0000-4000-8000-0000000b3307',
        '00000000-0000-4000-8000-000000033548', 15000, 0, 15000, 0, 2000, 'mxn', 'paid', 'acct_test_3548',
        '00000000-0000-4000-8000-0000000a3548', 'card', 40000, now(), '2026-11-04T11:00:00Z'),
       ('00000000-0000-4000-8000-0000000e3548', '00000000-0000-4000-8000-0000000b3307',
        '00000000-0000-4000-8000-000000033548', 25000, 0, 0, 25000, 1000, 'mxn', 'paid', null,
        '00000000-0000-4000-8000-0000000a3548', 'outside', 40000, now(), '2026-11-04T11:00:00Z');
-- C: a card payment of a MX$60 charge (Stripe confirmed it).
insert into public.wallet_payments (consumer_id, place_id, amount_cents, credit_cents, card_cents, currency, status,
                                    stripe_account_id, charge_amount_cents, paid_at, created_at)
values ('00000000-0000-4000-8000-0000000b3307', '00000000-0000-4000-8000-000000033548', 6000, 0, 6000, 'mxn', 'paid',
        'acct_test_3548', 6000, now(), '2026-11-04T12:00:00Z');
-- D: an outside bill an operator refunded (the Received was wrong).
insert into public.wallet_payments (consumer_id, place_id, amount_cents, credit_cents, card_cents, outside_cents,
                                    currency, status, paid_at, created_at)
values ('00000000-0000-4000-8000-0000000b3307', '00000000-0000-4000-8000-000000033548', 7000, 0, 0, 7000, 'mxn',
        'refunded', now(), '2026-11-04T13:00:00Z');

create temp table c as
  select place_money_summary('00000000-0000-4000-8000-000000033548', '2026-10-01', '2026-12-01', false) as j;

select is((select (j ->> 'received_cents')::int from c), 66000,
  'money received counts the outside parts and card parts, never a refunded outside bill');
select is((select (j ->> 'tips_cents')::int from c), 2000, 'only the card tip is a tip; cash tips stay out');
select is(
  (select x ->> 'confirmed_by' from c, jsonb_array_elements(j -> 'rows') x where x ->> 'id' = '00000000-0000-4000-8000-0000000c3548'),
  'waiter', 'the outside bill''s row says the waiter confirmed it');
select is(
  (select (x ->> 'outside_cents')::int + (x ->> 'charge_amount_cents')::int
     from c, jsonb_array_elements(j -> 'rows') x where x ->> 'id' = '00000000-0000-4000-8000-0000000c3548'),
  50000, 'the row carries its outside part and the waiter''s bill');
select is(
  (select string_agg(x ->> 'part' || ':' || (x ->> 'confirmed_by'), ',' order by x ->> 'part')
     from c, jsonb_array_elements(j -> 'rows') x where x ->> 'tab_id' = '00000000-0000-4000-8000-0000000a3548'),
  'card:stripe,outside:waiter', 'a tab''s card row and cash row both answer, each with its part and confirmer');
select is((select j -> 'received_share' from c), '{"received": 2, "total": 3}'::jsonb,
  'the tab is one bill; two of three waiter''s bills ended in Received');
select is((select (j ->> 'outside_cashback_today_cents')::int from c), 400,
  'the place''s outside cashback over the rolling day');
select ok((select j -> 'rows' -> 1 -> 'confirmed_by' = 'null'::jsonb from s), 'a voucher row has no confirmer');

-- ━━━ The needs_review list ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select ok(
  exists (select 1 from jsonb_array_elements(wallet_needs_review_list()) x
          where x ->> 'stripe_error' = 'resource_missing' and (x ->> 'reopenable')::boolean),
  'the given-up row is listed with its Stripe error and can be re-read'
);

select * from finish();

rollback;
