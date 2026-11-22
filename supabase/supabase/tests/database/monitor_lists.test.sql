-- MESITA-4538 — Business Monitor lists. Nobody but the service role runs
-- them. Customers' owed amounts add up to the place's credit ledger (money):
-- each guest's row is the sum of their wallet_entries here, and the total is
-- the sum of every entry with a guest. Another place's credit never counts.
-- A customer filter returns only that guest's rows. The member id never
-- leaves: guests are per-place keys. An anonymous guest shows no photo.

begin;

create extension if not exists pgtap with schema public;

select plan(19);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000a4538', 'maria.lopez@example.com'),
  ('00000000-0000-4000-8000-0000000b4538', null);
insert into public.consumers (id, full_name) values
  ('00000000-0000-4000-8000-0000000a4538', null),
  ('00000000-0000-4000-8000-0000000b4538', 'Ana Ruiz');
insert into public.place_profiles (id, google_name) values
  ('00000000-0000-4000-8000-000000014538', 'Monitor Probe'),
  ('00000000-0000-4000-8000-000000024538', 'Other Monitor');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000014538', 'mesita-4538-monitor', 'active', 'generating', 'MXN'),
  ('00000000-0000-4000-8000-000000024538', 'mesita-4538-other', 'active', 'generating', 'MXN');

-- Maria bought a MX$200 voucher (+MX$20 bonus) here; Ana bought one here and
-- one at the other place.
insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, paid_at, created_at)
values
  ('00000000-0000-4000-8000-000000114538', '00000000-0000-4000-8000-0000000a4538',
   '00000000-0000-4000-8000-000000014538', 20000, 'mxn', 'paid', 'acct_test_4538',
   'voucher_200', 2000, now() - interval '2 days', now() - interval '2 days'),
  ('00000000-0000-4000-8000-000000124538', '00000000-0000-4000-8000-0000000b4538',
   '00000000-0000-4000-8000-000000014538', 100000, 'mxn', 'paid', 'acct_test_4538',
   'voucher_1000', 20000, now() - interval '1 day', now() - interval '1 day'),
  ('00000000-0000-4000-8000-000000134538', '00000000-0000-4000-8000-0000000b4538',
   '00000000-0000-4000-8000-000000024538', 20000, 'mxn', 'paid', 'acct_test_4538',
   'voucher_200', 2000, now(), now());

insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
values
  ('00000000-0000-4000-8000-0000000a4538', '00000000-0000-4000-8000-000000014538', 'voucher', 20000, 'mxn',
   '00000000-0000-4000-8000-000000114538', false, now()),
  ('00000000-0000-4000-8000-0000000a4538', '00000000-0000-4000-8000-000000014538', 'bonus', 2000, 'mxn',
   '00000000-0000-4000-8000-000000114538', false, now()),
  ('00000000-0000-4000-8000-0000000b4538', '00000000-0000-4000-8000-000000014538', 'voucher', 100000, 'mxn',
   '00000000-0000-4000-8000-000000124538', false, now()),
  ('00000000-0000-4000-8000-0000000b4538', '00000000-0000-4000-8000-000000024538', 'voucher', 20000, 'mxn',
   '00000000-0000-4000-8000-000000134538', false, now());

select ok(
  not has_function_privilege('anon', 'public.place_monitor_list(uuid,boolean,text,text,uuid,jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.place_monitor_list(uuid,boolean,text,text,uuid,jsonb)', 'execute'),
  'place_monitor_list is service-role only');
select ok(
  not has_function_privilege('anon', 'public.place_customers(uuid,boolean,text,jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.place_customers(uuid,boolean,text,jsonb)', 'execute'),
  'place_customers is service-role only');
select ok(
  not has_function_privilege('anon', 'public.place_views_log(uuid,timestamptz,integer,text)', 'execute')
  and not has_function_privilege('authenticated', 'public.place_views_log(uuid,timestamptz,integer,text)', 'execute'),
  'place_views_log is service-role only');

select is(
  (public.place_customers('00000000-0000-4000-8000-000000014538', false) ->> 'count')::int, 2,
  'two guests have money rows here');
select is(
  (public.place_customers('00000000-0000-4000-8000-000000014538', false) ->> 'owed_cents')::bigint,
  (select sum(amount_cents)::bigint from public.wallet_entries
    where place_id = '00000000-0000-4000-8000-000000014538' and livemode = false and consumer_id is not null),
  'the total owed is the place''s ledger, nothing from the other place');
select is(
  (select sum((r ->> 'owed_cents')::bigint)::bigint from jsonb_array_elements(
     public.place_customers('00000000-0000-4000-8000-000000014538', false) -> 'rows') r),
  122000::bigint,
  'each guest''s owed adds up to the total');
select is(
  (public.place_customers('00000000-0000-4000-8000-000000014538', false) -> 'rows' -> 0 ->> 'owed_cents')::bigint,
  100000::bigint,
  'the guest owed the most comes first');
select ok(
  (public.place_customers('00000000-0000-4000-8000-000000014538', false)::text) !~ '0000000a4538',
  'the member id never leaves');

select is(
  (select count(*)::int from jsonb_array_elements(
     public.place_monitor_list('00000000-0000-4000-8000-000000014538', false, 'credits',
       public.place_customer_key('00000000-0000-4000-8000-000000014538', '00000000-0000-4000-8000-0000000a4538')) -> 'rows')),
  2,
  'a customer filter returns only that guest''s credit rows');
select is(
  jsonb_array_length(
    public.place_monitor_list('00000000-0000-4000-8000-000000014538', false, 'vouchers',
      null, '00000000-0000-4000-8000-000000114538') -> 'rows' -> 0 -> 'links'),
  2,
  'a voucher links to the credit rows it added');

-- MESITA-4682: a split table and its two shares. Maria paid her share by
-- card (MX$150 + MX$10 tip, MX$50 refunded); Ana paid hers outside.
insert into public.pay_tabs (id, place_id, consumer_id, token_hash, currency, expires_at, status, bill_cents, tip_cents,
                             origin, paid_at, split_at, split_ways)
values ('00000000-0000-4000-8000-000000214538', '00000000-0000-4000-8000-000000014538',
        '00000000-0000-4000-8000-0000000a4538', repeat('a', 64), 'mxn', now() + interval '1 day', 'paid', 30000, 0,
        'waiter', now() - interval '3 hours', now() - interval '4 hours', 2);
insert into public.pay_tabs (id, place_id, consumer_id, token_hash, currency, expires_at, status, bill_cents, tip_cents,
                             origin, paid_at, parent_tab_id, card_bill_cents, card_tip_cents, cash_bill_cents)
values
  ('00000000-0000-4000-8000-000000224538', '00000000-0000-4000-8000-000000014538',
   '00000000-0000-4000-8000-0000000a4538', repeat('b', 64), 'mxn', now() + interval '1 day', 'paid', 15000, 1000,
   'waiter', now() - interval '3 hours', '00000000-0000-4000-8000-000000214538', 15000, 1000, 0),
  ('00000000-0000-4000-8000-000000234538', '00000000-0000-4000-8000-000000014538',
   '00000000-0000-4000-8000-0000000b4538', repeat('c', 64), 'mxn', now() + interval '1 day', 'paid', 15000, 0,
   'waiter', now() - interval '3 hours', '00000000-0000-4000-8000-000000214538', 0, 0, 15000);
insert into public.wallet_payments (id, consumer_id, place_id, amount_cents, card_cents, outside_cents, tip_cents, currency,
                                    status, stripe_account_id, paid_at, tab_id, refunded_cents)
values
  ('00000000-0000-4000-8000-000000314538', '00000000-0000-4000-8000-0000000a4538', '00000000-0000-4000-8000-000000014538',
   15000, 15000, 0, 1000, 'mxn', 'partly_refunded', 'acct_test_4538', now() - interval '3 hours',
   '00000000-0000-4000-8000-000000224538', 5000),
  ('00000000-0000-4000-8000-000000324538', '00000000-0000-4000-8000-0000000b4538', '00000000-0000-4000-8000-000000014538',
   15000, 0, 15000, 0, 'mxn', 'paid', null, now() - interval '3 hours',
   '00000000-0000-4000-8000-000000234538', 0);

select is(
  (select r ->> 'visits' from jsonb_array_elements(public.place_customers('00000000-0000-4000-8000-000000014538', false) -> 'rows') r
    where r ->> 'customer' = public.place_customer_key('00000000-0000-4000-8000-000000014538', '00000000-0000-4000-8000-0000000a4538')),
  '1',
  'a split table is never a visit: Maria counts only her share');
select is(
  (select (r ->> 'spent_cents')::bigint from jsonb_array_elements(public.place_customers('00000000-0000-4000-8000-000000014538', false) -> 'rows') r
    where r ->> 'customer' = public.place_customer_key('00000000-0000-4000-8000-000000014538', '00000000-0000-4000-8000-0000000a4538')),
  11000::bigint,
  'spent is her share plus tip, less what was refunded');
select is(
  (select (r ->> 'spent_cents')::bigint from jsonb_array_elements(public.place_customers('00000000-0000-4000-8000-000000014538', false) -> 'rows') r
    where r ->> 'customer' = public.place_customer_key('00000000-0000-4000-8000-000000014538', '00000000-0000-4000-8000-0000000b4538')),
  15000::bigint,
  'Ana''s share paid outside counts as spent');
select is(
  (select (r -> 'payload' ->> 'card_cents') || '/' || (r -> 'payload' ->> 'outside_cents')
     from jsonb_array_elements(public.place_monitor_list('00000000-0000-4000-8000-000000014538', false, 'visits') -> 'rows') r
    where r ->> 'id' = '00000000-0000-4000-8000-000000224538'),
  '15000/0',
  'Visits reads how a bill was settled from the bill row; the tip stands apart');
select is(
  (select (r -> 'payload' ->> 'shares') || '/' || (r -> 'payload' ->> 'shares_total_cents')
     from jsonb_array_elements(public.place_monitor_list('00000000-0000-4000-8000-000000014538', false, 'visits') -> 'rows') r
    where r ->> 'id' = '00000000-0000-4000-8000-000000214538'),
  '2/31000',
  'a split table carries its shares'' count and total');
select is(
  (select array_agg(r ->> 'id') from jsonb_array_elements(
     public.place_monitor_list('00000000-0000-4000-8000-000000014538', false, 'payments') -> 'rows') r),
  array['00000000-0000-4000-8000-000000314538'],
  'Payments lists Stripe card charges only; a bill paid outside stays on Visits');

-- MESITA-4682: a save makes a customer before any visit. A quiet save does
-- not (it was promised to stay in the browser), nor a closed account.
insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000c4538'), ('00000000-0000-4000-8000-0000000d4538'), ('00000000-0000-4000-8000-0000000e4538');
insert into public.consumers (id, first_name, deleted_at) values
  ('00000000-0000-4000-8000-0000000c4538', 'Saver', null),
  ('00000000-0000-4000-8000-0000000d4538', 'Quiet', null),
  ('00000000-0000-4000-8000-0000000e4538', 'Closed', now());
insert into public.place_activity (consumer_id, place_id, kind, quiet) values
  ('00000000-0000-4000-8000-0000000c4538', '00000000-0000-4000-8000-000000014538', 'saved', false),
  ('00000000-0000-4000-8000-0000000d4538', '00000000-0000-4000-8000-000000014538', 'saved', true),
  ('00000000-0000-4000-8000-0000000e4538', '00000000-0000-4000-8000-000000014538', 'saved', false);
select is(
  (public.place_customers('00000000-0000-4000-8000-000000014538', false) ->> 'count')::int, 3,
  'a guest who saved the place is a customer; a quiet save or a closed account is not');
select is(
  (select r ->> 'saved' || '/' || (r ->> 'visits') || '/' || (r ->> 'owed_cents')
     from jsonb_array_elements(public.place_customers('00000000-0000-4000-8000-000000014538', false) -> 'rows') r
    where r ->> 'customer' = public.place_customer_key('00000000-0000-4000-8000-000000014538', '00000000-0000-4000-8000-0000000c4538')),
  'true/0/0',
  'the saver shows saved, no visits, no credit');
select is(
  (select count(*)::int from jsonb_array_elements(public.place_customers('00000000-0000-4000-8000-000000014538', false) -> 'rows') r
    where (r ->> 'saved')::boolean),
  1,
  'only the saver reads saved');

select * from finish();
rollback;
