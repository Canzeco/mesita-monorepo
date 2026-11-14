-- MESITA-3947 — Credits Limit: a default per currency, a per-place override,
-- the limit that binds a place, and the admin read; nobody but the EFs
-- reads any of it.

begin;

create extension if not exists pgtap with schema public;

select plan(14);

insert into auth.users (id) values ('00000000-0000-4000-8000-0000000a3947');
insert into public.consumers (id) values ('00000000-0000-4000-8000-0000000a3947');
insert into public.place_profiles (id, google_name) values
  ('00000000-0000-4000-8000-000000003947', 'Limit Probe MX'),
  ('00000000-0000-4000-8000-000000013947', 'Limit Probe US');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000003947', 'mesita-3947-probe-mx', 'active', 'generating', 'MXN'),
  ('00000000-0000-4000-8000-000000013947', 'mesita-3947-probe-us', 'active', 'generating', 'USD');

-- ━━━ EF-only ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select ok(
  not has_function_privilege('anon', 'public.place_credit_limit(uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.place_credit_limit(uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.admin_credit_limits(boolean)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.admin_credit_limits(boolean)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.admin_set_place_credit_limit(uuid, bigint)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.admin_set_place_credit_limit(uuid, bigint)', 'EXECUTE'),
  'place_credit_limit, admin_set_place_credit_limit and admin_credit_limits are service-role only'
);

select ok(
  not has_table_privilege('anon', 'public.credit_limit_defaults', 'SELECT')
    and not has_table_privilege('authenticated', 'public.credit_limit_defaults', 'SELECT'),
  'credit_limit_defaults is EF-only'
);

select ok(
  exists (select 1 from public.admin_reset_preserve where table_name = 'credit_limit_defaults'),
  'a database reset keeps the limits'
);

-- ━━━ Defaults ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  (select limit_cents from public.credit_limit_defaults where currency = 'MXN'),
  10000000::bigint,
  'Mexico defaults to MX$100,000 (Pato)'
);

select is(
  (select limit_cents from public.credit_limit_defaults where currency = 'USD'),
  1000000::bigint,
  'the US defaults to US$10,000 (Pato)'
);

select is(
  (select count(*)::int from public.credit_limit_defaults
    where currency in ('MXN', 'USD', 'CAD', 'EUR', 'GBP', 'BRL', 'JPY', 'COP', 'CLP', 'PEN')),
  10,
  'every currency a place can have holds a default'
);

-- ━━━ The limit that binds ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  public.place_credit_limit('00000000-0000-4000-8000-000000003947'),
  10000000::bigint,
  'a place without its own limit takes its currency''s default'
);

select ok(
  public.admin_set_place_credit_limit('00000000-0000-4000-8000-000000003947', 250000),
  'the admin write sets a place''s own limit'
);

select ok(
  not public.admin_set_place_credit_limit('00000000-0000-4000-8000-0000000f3947', 250000),
  'the admin write answers false for a place that does not exist'
);

select is(
  public.place_credit_limit('00000000-0000-4000-8000-000000003947'),
  250000::bigint,
  'a place''s own limit wins over the default'
);

select throws_ok(
  $$update public.places set credit_limit_cents = -1 where id = '00000000-0000-4000-8000-000000003947'$$,
  '23514',
  null,
  'a negative limit is refused'
);

-- ━━━ The admin read ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, application_fee_cents, stripe_checkout_session_id)
values ('00000000-0000-4000-8000-0000000d3947', '00000000-0000-4000-8000-0000000a3947',
        '00000000-0000-4000-8000-000000003947', 100000, 'mxn', 'open', 'acct_test_3947',
        'voucher_1000', 20000, 5000, 'cs_test_3947');
select wallet_credit_purchase('00000000-0000-4000-8000-0000000d3947', 'pi_test_3947', null);

select is(
  (select (r ->> 'outstanding_cents')::bigint
     from jsonb_array_elements(public.admin_credit_limits(false) -> 'places') r
    where r ->> 'place_id' = '00000000-0000-4000-8000-000000003947'),
  public.wallet_place_outstanding('00000000-0000-4000-8000-000000003947', 'mxn', false)::bigint,
  'the page''s outstanding credit is the buy path''s'
);

select is(
  (select r - 'place_id' - 'place_name' - 'outstanding_cents'
     from jsonb_array_elements(public.admin_credit_limits(false) -> 'places') r
    where r ->> 'place_id' = '00000000-0000-4000-8000-000000003947'),
  jsonb_build_object('currency', 'MXN', 'override_cents', 250000, 'limit_cents', 250000, 'house_credits', false),
  'a place holding credit is listed with its currency, its own limit and the limit that binds it'
);

select ok(
  not exists (select 1 from jsonb_array_elements(public.admin_credit_limits(false) -> 'places') r
               where r ->> 'place_id' = '00000000-0000-4000-8000-000000013947'),
  'a place with no credit and House Credits Off is not listed'
);

select * from finish();
rollback;
