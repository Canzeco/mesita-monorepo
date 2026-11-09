-- MESITA-3567 — Pay at the table T1a: the tab. One open tab per guest per
-- place; the waiter's bill is a compare-and-set; the guest's parts sum to
-- the bill, never pay a tip with credits, hold the credit until the waiter
-- confirms; a short Received writes nothing; the outside limit holds; only
-- the service role can call any of it.

begin;

create extension if not exists pgtap with schema public;

select plan(30);

insert into auth.users (id) values ('00000000-0000-4000-8000-0000000a3567'), ('00000000-0000-4000-8000-0000000b3567');
insert into public.consumers (id) values ('00000000-0000-4000-8000-0000000a3567'), ('00000000-0000-4000-8000-0000000b3567');
insert into public.place_profiles (id, google_name) values ('00000000-0000-4000-8000-000000013567', 'Pay Tab Probe');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000013567', 'mesita-3567-probe', 'active', 'generating', 'MXN');

-- Guest A holds $220MX Available at the place (a $200MX voucher and its bonus).
insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, application_fee_cents, stripe_checkout_session_id)
values ('00000000-0000-4000-8000-0000000d3567', '00000000-0000-4000-8000-0000000a3567',
        '00000000-0000-4000-8000-000000013567', 20000, 'mxn', 'open', 'acct_test_3567',
        'voucher_200', 2000, 1000, 'cs_test_3567');
do $$ begin
  perform wallet_credit_purchase('00000000-0000-4000-8000-0000000d3567', 'pi_test_3567', now() - interval '1 minute');
end $$;

-- ━━━ Shape and access ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select has_table('public', 'pay_tabs', 'the tab table exists');
select has_column('public', 'wallet_payments', 'tab_id', 'a payment row names its tab');
select ok(
  not has_table_privilege('authenticated', 'public.pay_tabs', 'SELECT')
    and not has_table_privilege('anon', 'public.pay_tabs', 'SELECT')
    and not has_function_privilege('authenticated', 'public.pay_tab_open(uuid, uuid, text, text, boolean, interval, timestamptz)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.pay_tab_bill(text, text, boolean, integer, integer, integer, text, text, interval, timestamptz)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.pay_tab_open_parts(uuid, uuid, integer, integer, integer, integer, integer, integer, uuid, text, integer, integer, timestamptz, text, integer, integer, text, timestamptz)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.pay_tab_cash(text, text, integer, timestamptz)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.pay_tab_change(uuid, uuid, text)', 'EXECUTE'),
  'client roles can neither read tabs nor call the tab functions');

-- ━━━ Open: one per guest per place ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create temp table t1 on commit drop as
select pay_tab_open('00000000-0000-4000-8000-0000000a3567', '00000000-0000-4000-8000-000000013567',
  repeat('a', 64), 'MXN', false) as r;
select is((select r->>'outcome' from t1), 'opened', 'a guest opens a tab');
select is(
  pay_tab_open('00000000-0000-4000-8000-0000000a3567', '00000000-0000-4000-8000-000000013567',
    repeat('b', 64), 'MXN', false)->>'tab_id',
  (select r->>'tab_id' from t1), 'opening again reuses the open tab');
select is((select token_hash from public.pay_tabs where id = (select (r->>'tab_id')::uuid from t1)),
  repeat('b', 64), 'and rotates its QR: only the newest token works');
select throws_ok(
  $$insert into public.pay_tabs (place_id, consumer_id, token_hash, currency, expires_at)
    values ('00000000-0000-4000-8000-000000013567', '00000000-0000-4000-8000-0000000a3567', repeat('c', 64), 'mxn', now() + interval '1 hour')$$,
  '23505', null, 'a second open tab for the same guest and place is refused');

-- ━━━ The waiter's bill ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(pay_tab_bill(repeat('b', 64), repeat('e', 64), false, 0, 30000, 4500, 'T7', 'Ana')->>'code',
  'staff_key', 'without the place code a device with no key cannot bill');
select is(pay_tab_bill(repeat('b', 64), repeat('e', 64), true, 1, 30000, 4500, 'T7', 'Ana')->>'code',
  'stale', 'a bill sent against an old version is refused');
select is(pay_tab_bill(repeat('b', 64), repeat('e', 64), true, 0, 30000, 4500, 'T7', 'Ana')->>'outcome',
  'billed', 'the waiter bills $300MX with a $45MX tip suggestion');
select is(pay_tab_bill(repeat('b', 64), repeat('f', 64), false, 1, 32000, 4500, null, null)->>'code',
  'staff_key', 'another device''s key cannot change the bill');
select is((pay_tab_bill(repeat('b', 64), repeat('e', 64), false, 1, 32000, 4500, 'T7', 'Ana')->>'bill_version')::int,
  2, 'the same device changes it: version 2');

-- ━━━ The guest's split ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  pay_tab_open_parts((select (r->>'tab_id')::uuid from t1), '00000000-0000-4000-8000-0000000b3567', 2,
    0, 32000, 0, 0, 0, gen_random_uuid(), null, 200, 2)->>'code',
  'not_found', 'another guest cannot pay this tab');
select is(
  pay_tab_open_parts((select (r->>'tab_id')::uuid from t1), '00000000-0000-4000-8000-0000000a3567', 1,
    22000, 10000, 0, 0, 0, gen_random_uuid(), null, 200, 2)->>'code',
  'stale', 'a split against the old bill is refused');
select is(
  pay_tab_open_parts((select (r->>'tab_id')::uuid from t1), '00000000-0000-4000-8000-0000000a3567', 2,
    22000, 9000, 0, 0, 0, gen_random_uuid(), null, 200, 2)->>'code',
  'parts', 'parts that do not sum to the bill are refused');
select is(
  pay_tab_open_parts((select (r->>'tab_id')::uuid from t1), '00000000-0000-4000-8000-0000000a3567', 2,
    0, 0, 0, 32000, 0, gen_random_uuid(), null, 200, 2)->>'code',
  'card_unavailable', 'a card part without the place''s account is refused');
select is(
  pay_tab_open_parts((select (r->>'tab_id')::uuid from t1), '00000000-0000-4000-8000-0000000a3567', 2,
    25000, 7000, 0, 0, 0, gen_random_uuid(), null, 200, 2)->>'code',
  'insufficient', 'more credit than the guest holds is refused');

create temp table p1 on commit drop as
select pay_tab_open_parts((select (r->>'tab_id')::uuid from t1), '00000000-0000-4000-8000-0000000a3567', 2,
  22000, 10000, 4500, 0, 0, '00000000-0000-4000-8000-0000000e3567', null, 200, 2) as r;
select is((select r->>'status' from p1), 'paying', '$220MX credit + $100MX cash + $45MX cash tip opens');
select is(
  (select (credit_cents, outside_cents, tip_cents, part, status)::text from public.wallet_payments
    where id = (select (r->>'payment_id')::uuid from p1)),
  '(22000,10000,4500,outside,open)', 'one outside row carries the credit, the cash and the tip');
select is(
  (select held_cents from wallet_balance('00000000-0000-4000-8000-0000000a3567', '00000000-0000-4000-8000-000000013567', 'mxn', false)),
  22000, 'the credit is held, not spent, until the waiter confirms');
select is(
  pay_tab_open_parts((select (r->>'tab_id')::uuid from t1), '00000000-0000-4000-8000-0000000a3567', 2,
    22000, 10000, 4500, 0, 0, '00000000-0000-4000-8000-0000000e3567', null, 200, 2)->>'outcome',
  'replayed', 'a double tap replays');
select is(pay_tab_bill(repeat('b', 64), repeat('e', 64), false, 2, 1000, 0, null, null)->>'code',
  'paying', 'once the guest paid, the bill cannot change');

-- ━━━ Received ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(pay_tab_cash(repeat('b', 64), repeat('f', 64), null)->>'code', 'staff_key',
  'the guest''s token alone cannot confirm cash');
select is((pay_tab_cash(repeat('b', 64), repeat('e', 64), 9000)->>'missing_cents')::int, 1000,
  'less than the cash bill part answers missing $10MX');
select is((select status from public.wallet_payments where id = (select (r->>'payment_id')::uuid from p1)),
  'open', 'and writes nothing');

create temp table c1 on commit drop as select pay_tab_cash(repeat('b', 64), repeat('e', 64), 13000) as r;
select is((select (r->>'cash_tip_cents')::int from c1), 3000, '$130MX received: the $15MX short comes off the tip');
select is(
  (select (status, tip_cents, cashback_cents, confirmed_by)::text from public.wallet_payments
    where id = (select (r->>'payment_id')::uuid from p1)),
  '(paid,3000,200,waiter)', 'the row is paid, tip $30MX, 2% back on the $100MX cash bill only');
select is((select status from public.pay_tabs where id = (select (r->>'tab_id')::uuid from t1)), 'paid',
  'the tab reads paid');

-- ━━━ Credits only, then the outside limit ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Guest B has no credit: two cash tabs today, the third answers outside_limit.
do $$
declare v_tab uuid; i int;
begin
  for i in 1..3 loop
    v_tab := (pay_tab_open('00000000-0000-4000-8000-0000000b3567', '00000000-0000-4000-8000-000000013567',
      lpad(to_hex(i), 64, '9'), 'mxn', false)->>'tab_id')::uuid;
    perform pay_tab_bill(lpad(to_hex(i), 64, '9'), repeat('e', 64), true, 0, 5000, 0, null, null);
    if i < 3 then
      perform pay_tab_open_parts(v_tab, '00000000-0000-4000-8000-0000000b3567', 1, 0, 5000, 0, 0, 0,
        gen_random_uuid(), null, 200, 2);
      perform pay_tab_cash(lpad(to_hex(i), 64, '9'), repeat('e', 64), null);
    end if;
  end loop;
end $$;
select is(
  pay_tab_open_parts((select id from public.pay_tabs where token_hash = lpad(to_hex(3), 64, '9')),
    '00000000-0000-4000-8000-0000000b3567', 1, 0, 5000, 0, 0, 0, gen_random_uuid(), null, 200, 2)->>'code',
  'outside_limit', 'a third cash bill the same day answers outside_limit');
select is(
  pay_tab_change((select id from public.pay_tabs where token_hash = lpad(to_hex(3), 64, '9')),
    '00000000-0000-4000-8000-0000000b3567', 'cancel')->>'outcome',
  'cancelled', 'the guest cancels a tab before paying');

select * from finish();
rollback;
