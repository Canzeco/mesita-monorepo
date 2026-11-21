-- MESITA-4538 — Business Monitor lists. Nobody but the service role runs
-- them. Customers' owed amounts add up to the place's credit ledger (money):
-- each guest's row is the sum of their wallet_entries here, and the total is
-- the sum of every entry with a guest. Another place's credit never counts.
-- A customer filter returns only that guest's rows. The member id never
-- leaves: guests are per-place keys. An anonymous guest shows no photo.

begin;

create extension if not exists pgtap with schema public;

select plan(11);

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

-- MESITA-4554: a guest who appears anonymous never shows a photo on a row.
update public.consumers set avatar_url = 'https://example.com/a.jpg', appear_anonymous = true
 where id = '00000000-0000-4000-8000-0000000b4538';
select is(
  public.place_guest_face('00000000-0000-4000-8000-0000000b4538') ->> 'avatar_url',
  null,
  'an anonymous guest''s photo stays hidden');

select * from finish();
rollback;
