-- MESITA-4502 — a new guest pay writes a ticket only when it is closed.
-- A card attempt writes none until the payment is paid. A release writes
-- none. Cash writes one when Received, and a second receive is the first.

begin;

create extension if not exists pgtap with schema public;

select plan(12);

insert into auth.users (id) values ('00000000-0000-4000-8000-0000000a4502');
insert into public.consumers (id, first_name) values ('00000000-0000-4000-8000-0000000a4502', 'Ada');
insert into public.place_profiles (id, google_name) values
  ('00000000-0000-4000-8000-000000014502', 'Closed Ticket Probe');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000014502', 'mesita-4502-probe', 'active', 'generating', 'MXN');

insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, application_fee_cents, stripe_checkout_session_id)
values ('00000000-0000-4000-8000-0000000d4502', '00000000-0000-4000-8000-0000000a4502',
        '00000000-0000-4000-8000-000000014502', 20000, 'mxn', 'open', 'acct_test_4502',
        'voucher_200', 2000, 1000, 'cs_test_4502');
do $$ begin
  perform wallet_credit_purchase('00000000-0000-4000-8000-0000000d4502', 'pi_test_4502', now() - interval '1 minute');
end $$;

-- Credits-only: one closed ticket, the credit spent.
select is(
  (pay_guest_begin('00000000-0000-4000-8000-0000000a4502', '00000000-0000-4000-8000-000000014502', 'MXN', false,
    repeat('a', 64), 5000, 5000, 0, 0, 0, 0, '00000000-0000-4000-8000-0000000e4502', null, 0)->>'status'),
  'paid', 'credits-only closes in the same call');
select is(
  (select count(*) from pay_tabs where consumer_id = '00000000-0000-4000-8000-0000000a4502' and status = 'paid'),
  1::bigint, 'that call inserted one paid ticket');

-- Card: nothing is a ticket while the charge is in flight.
select is(
  (pay_guest_begin('00000000-0000-4000-8000-0000000a4502', '00000000-0000-4000-8000-000000014502', 'MXN', false,
    repeat('b', 64), 3000, 0, 0, 0, 3000, 0, '00000000-0000-4000-8000-0000000e4503', 'acct_test_4502', 0)->>'status'),
  'opening', 'a card pay opens an attempt');
select is(
  (select count(*) from pay_tabs where consumer_id = '00000000-0000-4000-8000-0000000a4502'),
  1::bigint, 'the in-flight card pay inserted no ticket');

select is(
  (pay_guest_release('00000000-0000-4000-8000-0000000a4502', '00000000-0000-4000-8000-0000000e4503')->>'outcome'),
  'released', 'dismiss releases the attempt');
select is(
  (select count(*) from pay_tabs where consumer_id = '00000000-0000-4000-8000-0000000a4502'),
  1::bigint, 'a dismissed pay still has no new ticket');

-- The succeeded card inserts exactly one closed ticket.
select pay_guest_begin('00000000-0000-4000-8000-0000000a4502', '00000000-0000-4000-8000-000000014502', 'MXN', false,
  repeat('c', 64), 3000, 0, 0, 0, 3000, 0, '00000000-0000-4000-8000-0000000e4504', 'acct_test_4502', 0);
update public.wallet_payments set status = 'paid', paid_at = now()
 where consumer_id = '00000000-0000-4000-8000-0000000a4502' and part = 'card' and paid_at is null;
select is(
  (pay_guest_close((select id from guest_pay_attempts where request_id = '00000000-0000-4000-8000-0000000e4504'))->>'outcome'),
  'closed', 'a succeeded card closes the attempt');
select is(
  (select count(*) from pay_tabs where consumer_id = '00000000-0000-4000-8000-0000000a4502' and status = 'paid'),
  2::bigint, 'the succeeded card inserted one closed ticket');

-- Cash stays off the ticket list until Received. A mismatch writes nothing.
select pay_guest_begin('00000000-0000-4000-8000-0000000a4502', '00000000-0000-4000-8000-000000014502', 'MXN', false,
  repeat('d', 64), 4000, 1000, 3000, 0, 0, 0, '00000000-0000-4000-8000-0000000e4505', null, 0);
select is(
  (select count(*) from pay_tabs where consumer_id = '00000000-0000-4000-8000-0000000a4502'),
  2::bigint, 'cash confirm inserts no ticket');
select is(
  (pay_guest_receive(
    (select id from guest_pay_attempts where request_id = '00000000-0000-4000-8000-0000000e4505'),
    '00000000-0000-4000-8000-000000014502', 1)->>'code'),
  'amount_changed', 'a mismatched amount writes nothing');
select is(
  (pay_guest_receive(
    (select id from guest_pay_attempts where request_id = '00000000-0000-4000-8000-0000000e4505'),
    '00000000-0000-4000-8000-000000014502', 3000)->>'outcome'),
  'received', 'Received writes the closed ticket');
select is(
  (pay_guest_receive(
    (select id from guest_pay_attempts where request_id = '00000000-0000-4000-8000-0000000e4505'),
    '00000000-0000-4000-8000-000000014502', 3000)->>'outcome'),
  'already', 'a second receive returns the first result');

select * from finish();
rollback;
