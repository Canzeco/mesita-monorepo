-- MESITA-3947 — Credits Limit: a default per currency, a per-place override,
-- the limit that binds a place, and the admin read; nobody but the EFs
-- reads any of it. MESITA-4732: a Mexican place earns its limit in steps
-- (0 · MX$10,000 with the Credits Account · MX$50,000 with a charging
-- Stripe account too); its own limit still wins.

begin;

create extension if not exists pgtap with schema public;

select plan(23);

insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000a3947'),
  ('00000000-0000-4000-8000-0000000c4732');
insert into public.consumers (id) values ('00000000-0000-4000-8000-0000000a3947');
insert into public.place_profiles (id, google_name) values
  ('00000000-0000-4000-8000-000000003947', 'Limit Probe MX'),
  ('00000000-0000-4000-8000-000000013947', 'Limit Probe US'),
  ('00000000-0000-4000-8000-000000024732', 'Limit Probe Tiers');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000003947', 'mesita-3947-probe-mx', 'active', 'generating', 'MXN'),
  ('00000000-0000-4000-8000-000000013947', 'mesita-3947-probe-us', 'active', 'generating', 'USD'),
  ('00000000-0000-4000-8000-000000024732', 'mesita-4732-probe-tiers', 'active', 'generating', 'MXN');

-- ━━━ EF-only ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select ok(
  not has_function_privilege('anon', 'public.place_credit_limit(uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.place_credit_limit(uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.admin_credit_limits(boolean)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.admin_credit_limits(boolean)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.admin_set_place_credit_limit(uuid, bigint)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.admin_set_place_credit_limit(uuid, bigint)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.place_credit_limit_info(uuid, boolean)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.place_credit_limit_info(uuid, boolean)', 'EXECUTE'),
  'place_credit_limit, place_credit_limit_info, admin_set_place_credit_limit and admin_credit_limits are service-role only'
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
  0::bigint,
  'a Mexican place without its own limit and with the Credits Account Off may take no new credit (MESITA-4732)'
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
  jsonb_build_object('currency', 'MXN', 'override_cents', 250000, 'limit_cents', 250000, 'loyalty_cards', false),
  'a place holding credit is listed with its currency, its own limit and the limit that binds it'
);

select ok(
  not exists (select 1 from jsonb_array_elements(public.admin_credit_limits(false) -> 'places') r
               where r ->> 'place_id' = '00000000-0000-4000-8000-000000013947'),
  'a place with no credit and Loyalty Cards Off is not listed'
);

-- ━━━ The tiers (MESITA-4732) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  public.place_credit_limit_info('00000000-0000-4000-8000-000000024732', false),
  jsonb_build_object('limit_cents', 0, 'currency', 'MXN', 'tier', 'none',
                     'next', jsonb_build_object('step', 'credits', 'limit_cents', 1000000)),
  'Credits Account Off: limit 0, the next step is the Credits Account and MX$10,000'
);

insert into public.loyalty_cards_contracts (place_id, signed_by, signer_role, terms_version, text_sha256)
values ('00000000-0000-4000-8000-000000024732', '00000000-0000-4000-8000-0000000c4732', 'owner', 'draft-2026-11', repeat('0', 64));
insert into public.place_payment_settings (place_id, loyalty_cards) values ('00000000-0000-4000-8000-000000024732', true);

select is(
  public.place_credit_limit_info('00000000-0000-4000-8000-000000024732', false),
  jsonb_build_object('limit_cents', 1000000, 'currency', 'MXN', 'tier', 'credits',
                     'next', jsonb_build_object('step', 'stripe', 'limit_cents', 5000000)),
  'Credits Account On: MX$10,000, the next step is the Stripe Account and MX$50,000'
);

insert into public.place_payment_accounts (place_id, stripe_account_id, livemode, charges_enabled)
values ('00000000-0000-4000-8000-000000024732', 'acct_test_4732', false, true);

select is(
  public.place_credit_limit_info('00000000-0000-4000-8000-000000024732', false),
  jsonb_build_object('limit_cents', 5000000, 'currency', 'MXN', 'tier', 'stripe', 'next', null),
  'Credits Account On and a Stripe account that charges: MX$50,000, no next step'
);

select is(
  public.place_credit_limit('00000000-0000-4000-8000-000000024732'),
  5000000::bigint,
  'the voucher buy''s limit is the tiered one'
);

select is(
  public.place_credit_limit_info('00000000-0000-4000-8000-000000024732', true) ->> 'tier',
  'credits',
  'a test-mode account does not raise the limit in the live universe'
);

select is(
  public.place_credit_limit_info('00000000-0000-4000-8000-000000003947', false),
  jsonb_build_object('limit_cents', 250000, 'currency', 'MXN', 'tier', 'custom', 'next', null),
  'a place''s own limit wins over every tier'
);

select is(
  public.place_credit_limit_info('00000000-0000-4000-8000-000000013947', false),
  jsonb_build_object('limit_cents', 1000000, 'currency', 'USD', 'tier', 'default', 'next', null),
  'a non-Mexican place keeps its currency''s default'
);

select is(
  (select (r ->> 'limit_cents')::bigint
     from jsonb_array_elements(public.admin_credit_limits(false) -> 'places') r
    where r ->> 'place_id' = '00000000-0000-4000-8000-000000024732'),
  5000000::bigint,
  'the admin page shows the tiered limit'
);

select ok(
  public.place_credit_limit_info('00000000-0000-4000-8000-0000000f4732', false) is null
    and public.place_credit_limit('00000000-0000-4000-8000-0000000f4732') is null,
  'no such place: no limit (the buy refuses)'
);

select * from finish();
rollback;
