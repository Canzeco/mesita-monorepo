-- MESITA-4501 — a credits-only guest bill closes without a waiter key.
-- A second call does not spend again.

begin;

create extension if not exists pgtap with schema public;

select plan(6);

insert into auth.users (id) values ('00000000-0000-4000-8000-0000000a4501');
insert into public.consumers (id) values ('00000000-0000-4000-8000-0000000a4501');
insert into public.place_profiles (id, google_name) values
  ('00000000-0000-4000-8000-000000014501', 'Settle Probe');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000014501', 'mesita-4501-probe', 'active', 'generating', 'MXN');

insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, application_fee_cents, stripe_checkout_session_id)
values ('00000000-0000-4000-8000-0000000d4501', '00000000-0000-4000-8000-0000000a4501',
        '00000000-0000-4000-8000-000000014501', 20000, 'mxn', 'open', 'acct_test_4501',
        'voucher_200', 2000, 1000, 'cs_test_4501');
do $$ begin
  perform wallet_credit_purchase('00000000-0000-4000-8000-0000000d4501', 'pi_test_4501', now() - interval '1 minute');
end $$;

create temp table g1 on commit drop as
select pay_tab_guest_pay('00000000-0000-4000-8000-0000000a4501', '00000000-0000-4000-8000-000000014501', 'MXN', false,
  repeat('a', 64), 5000, 5000, 0, 0, 0, 0, '00000000-0000-4000-8000-0000000e4501', null) as r;

select is((select r->>'status' from g1), 'paying', 'the tap still opens as paying');

select is(
  pay_tab_guest_settle((select (r->>'tab_id')::uuid from g1))->>'outcome',
  'settled', 'settle closes it with no waiter key');

select is(
  (select status from pay_tabs where id = (select (r->>'tab_id')::uuid from g1)),
  'paid', 'the tab is paid');

select is(
  (select verified_key_hash from pay_tabs where id = (select (r->>'tab_id')::uuid from g1)),
  'cc873e0cc5c6d9a278d6804d17e2b06e46cd1e68701b86cbe7a87675f6121775',
  'the close key is the guest sentinel, not a staff device');

select is(
  (select spendable_cents from wallet_balance(
     '00000000-0000-4000-8000-0000000a4501', '00000000-0000-4000-8000-000000014501', 'mxn', false)),
  17000, 'the $50MX credit is spent once');

select is(
  pay_tab_guest_settle((select (r->>'tab_id')::uuid from g1))->>'outcome',
  'already', 'a second settle does not spend again');

select * from finish();
rollback;
