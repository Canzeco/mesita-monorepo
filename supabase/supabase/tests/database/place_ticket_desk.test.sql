-- MESITA-4487 — place_ticket_desk is one place and one universe. A visit
-- is a paid tab, and a guest's own bill only after Verify; a waiter's open
-- bill counts. An unpaid voucher does not. A Story purchase made before
-- Stories went (MESITA-4642) is still a voucher row; the stories kind is
-- gone. A gift at another place does not count. The cursor skips nothing.
-- Nobody but the service role runs it.

begin;

create extension if not exists pgtap with schema public;

select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000a4487', 'maria.lopez@example.com'),
  ('00000000-0000-4000-8000-0000000b4487', null);
insert into public.consumers (id, full_name) values
  ('00000000-0000-4000-8000-0000000a4487', null),
  ('00000000-0000-4000-8000-0000000b4487', 'Ana Ruiz');
insert into public.place_profiles (id, google_name) values
  ('00000000-0000-4000-8000-000000014487', 'Desk Probe'),
  ('00000000-0000-4000-8000-000000024487', 'Other Desk');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000014487', 'mesita-4487-desk', 'active', 'generating', 'MXN'),
  ('00000000-0000-4000-8000-000000024487', 'mesita-4487-other', 'active', 'generating', 'MXN');

-- A waiter's paid visit, a waiter's open bill, a guest bill paid but not
-- Verified (not a ticket), and a paid visit at the other place.
insert into public.pay_tabs (id, place_id, consumer_id, token_hash, status, currency, bill_cents, tip_cents, ticket, waiter_name, paid_at, expires_at, created_at)
values
  ('00000000-0000-4000-8000-0000000c4487', '00000000-0000-4000-8000-000000014487',
   '00000000-0000-4000-8000-0000000b4487', repeat('a', 64), 'paid', 'mxn', 20000, 2000, '14', 'Luis',
   now() - interval '2 days', now() - interval '2 days' + interval '1 hour', now() - interval '2 days'),
  ('00000000-0000-4000-8000-0000000d4487', '00000000-0000-4000-8000-000000014487',
   '00000000-0000-4000-8000-0000000a4487', repeat('b', 64), 'waiting_bill', 'mxn', 5000, 0, null, null,
   null, now() + interval '30 minutes', now() - interval '1 day');
insert into public.pay_tabs (id, place_id, consumer_id, token_hash, status, currency, origin, bill_cents, paid_at, expires_at)
values
  ('00000000-0000-4000-8000-0000000e4487', '00000000-0000-4000-8000-000000014487',
   '00000000-0000-4000-8000-0000000a4487', repeat('c', 64), 'paid', 'mxn', 'guest', 9000,
   now(), now() + interval '30 minutes'),
  ('00000000-0000-4000-8000-0000000f4487', '00000000-0000-4000-8000-000000024487',
   '00000000-0000-4000-8000-0000000b4487', repeat('d', 64), 'paid', 'mxn', 'waiter', 1000,
   now(), now() + interval '30 minutes');

-- A paid visit older than the chart. The log still lists it. The totals do not.
insert into public.pay_tabs (id, place_id, consumer_id, token_hash, status, currency, bill_cents, tip_cents, paid_at, expires_at, created_at)
values
  ('00000000-0000-4000-8000-0000001a4487', '00000000-0000-4000-8000-000000014487',
   '00000000-0000-4000-8000-0000000b4487', repeat('1', 64), 'paid', 'mxn', 1000, 0,
   now() - interval '40 days', now() - interval '39 days', now() - interval '40 days');

-- A paid voucher and one still open. A Story voucher bought before MESITA-4642.
insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, paid_at, created_at)
values
  ('00000000-0000-4000-8000-000000114487', '00000000-0000-4000-8000-0000000a4487',
   '00000000-0000-4000-8000-000000014487', 20000, 'mxn', 'paid', 'acct_test_4487',
   'voucher_200', 2000, now() - interval '1 day', now() - interval '1 day'),
  ('00000000-0000-4000-8000-000000124487', '00000000-0000-4000-8000-0000000a4487',
   '00000000-0000-4000-8000-000000014487', 10000, 'mxn', 'open', 'acct_test_4487',
   'voucher_welcome', 10000, null, now()),
  ('00000000-0000-4000-8000-000000134487', '00000000-0000-4000-8000-0000000b4487',
   '00000000-0000-4000-8000-000000014487', 10000, 'mxn', 'paid', 'acct_test_4487',
   'voucher_story', 4000, now() - interval '1 day', now() - interval '1 day');

insert into public.wallet_gifts (id, sender_id, place_id, amount_cents, currency, token_hash, status, request_id, created_at)
values
  ('00000000-0000-4000-8000-000000164487', '00000000-0000-4000-8000-0000000b4487',
   '00000000-0000-4000-8000-000000014487', 5000, 'mxn', repeat('e', 64), 'open',
   '00000000-0000-4000-8000-000000174487', now() - interval '1 day'),
  ('00000000-0000-4000-8000-000000184487', '00000000-0000-4000-8000-0000000b4487',
   '00000000-0000-4000-8000-000000024487', 5000, 'mxn', repeat('f', 64), 'open',
   '00000000-0000-4000-8000-000000194487', now());

select is(
  (public.place_ticket_desk('00000000-0000-4000-8000-000000014487', 'visits', false, 'America/Mexico_City') -> 'totals' ->> 'visits')::int,
  2,
  'the last 30 days count the paid waiter bill and the open one, not an older visit');

select is(
  (public.place_ticket_desk('00000000-0000-4000-8000-000000014487', 'visits', false, 'America/Mexico_City') -> 'totals' ->> 'paid_cents')::int,
  22000,
  'paid cents are the paid bill plus its tip');

select is(
  (public.place_ticket_desk('00000000-0000-4000-8000-000000014487', 'visits', false, 'America/Mexico_City') -> 'rows' -> 0 ->> 'guest_name'),
  null,
  'the open visit is newest and names no full name, so the EF masks the email');

select is(
  (public.place_ticket_desk('00000000-0000-4000-8000-000000014487', 'visits', false, 'America/Mexico_City',
     (select created_at from public.pay_tabs where id = '00000000-0000-4000-8000-0000000d4487'),
     '00000000-0000-4000-8000-0000000d4487', 0) -> 'rows' -> 0 ->> 'id'),
  '00000000-0000-4000-8000-0000000c4487',
  'the cursor returns the older visit and not the one it started from');

select is(
  (public.place_ticket_desk('00000000-0000-4000-8000-000000014487', 'vouchers', false, 'America/Mexico_City') -> 'totals' ->> 'vouchers')::int,
  2,
  'a voucher ticket is a paid purchase, including a Story voucher bought before MESITA-4642; an open checkout is not');

select is(
  (public.place_ticket_desk('00000000-0000-4000-8000-000000014487', 'vouchers', false, 'America/Mexico_City') -> 'totals' ->> 'paid_cents')::int,
  30000,
  'voucher paid cents are what the guest paid');

select throws_ok(
  $$select public.place_ticket_desk('00000000-0000-4000-8000-000000014487', 'stories', false, 'America/Mexico_City')$$,
  'place_ticket_desk: kind must be visits, vouchers or gifts',
  'the stories kind is gone (MESITA-4642)');

select is(
  (public.place_ticket_desk('00000000-0000-4000-8000-000000014487', 'gifts', false, 'America/Mexico_City') -> 'totals' ->> 'open')::int,
  1,
  'a gift counts only at its place');

select is(
  (public.place_ticket_desk('00000000-0000-4000-8000-000000014487', 'gifts', false, 'America/Mexico_City') -> 'totals' ->> 'open_cents')::int,
  5000,
  'open cents are the credit still sitting on the link');

select is(
  (select count(*)::int from jsonb_array_elements(
     public.place_ticket_desk('00000000-0000-4000-8000-000000014487', 'visits', false, 'America/Mexico_City') -> 'days')),
  30,
  'the chart is thirty days, including the empty ones');

select is(
  (public.place_ticket_desk('00000000-0000-4000-8000-000000014487', 'visits', true, 'America/Mexico_City') -> 'totals' ->> 'visits')::int,
  0,
  'a live read never sees a test ticket');

select ok(
  not has_function_privilege('authenticated', 'public.place_ticket_desk(uuid, text, boolean, text, timestamptz, uuid, integer)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.place_ticket_desk(uuid, text, boolean, text, timestamptz, uuid, integer)', 'EXECUTE'),
  'only the service role runs the desk');

select ok(
  exists (
    select 1
      from jsonb_array_elements(
        public.place_ticket_desk('00000000-0000-4000-8000-000000014487', 'visits', false, 'America/Mexico_City') -> 'rows') r
     where r ->> 'id' = '00000000-0000-4000-8000-0000001a4487'),
  'the log still lists a visit older than 30 days');

select is(
  (select coalesce(sum((d ->> 'amount_cents')::bigint), 0)
     from jsonb_array_elements(
       public.place_ticket_desk('00000000-0000-4000-8000-000000014487', 'visits', false, 'America/Mexico_City') -> 'days') d)::int,
  22000,
  'chart money is paid visits only; the open bill adds a count and no pesos');

select is(
  public.place_ticket_desk('00000000-0000-4000-8000-000000014487', 'visits', false, 'America/Mexico_City') ->> 'timezone',
  'America/Mexico_City',
  'the desk names the place clock');

select throws_ok(
  $$select public.place_ticket_desk('00000000-0000-4000-8000-000000014487', 'refunds', false, 'America/Mexico_City')$$,
  'place_ticket_desk: kind must be visits, vouchers or gifts',
  'a kind the desk does not show is refused');

select * from finish();
rollback;
