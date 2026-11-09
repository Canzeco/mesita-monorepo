-- MESITA-3507 — the Story voucher takes two steps: paid, it holds no credit
-- and carries an activation token; staff activate it once and its voucher
-- and bonus turn Available; a Story refunded before activation reverses
-- nothing and can no longer be activated; nobody but the EFs calls any of it.

begin;

create extension if not exists pgtap with schema public;

select plan(14);

insert into auth.users (id) values ('00000000-0000-4000-8000-0000000a3507');
insert into public.consumers (id) values ('00000000-0000-4000-8000-0000000a3507');
insert into public.place_profiles (id, google_name)
values ('00000000-0000-4000-8000-000000003507', 'Story Probe');
insert into public.places (id, slug, state, content_state, currency)
values ('00000000-0000-4000-8000-000000003507', 'mesita-3507-probe', 'active', 'generating', 'MXN');

insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, application_fee_cents, stripe_checkout_session_id)
values
  ('00000000-0000-4000-8000-0000000d3507', '00000000-0000-4000-8000-0000000a3507',
   '00000000-0000-4000-8000-000000003507', 10000, 'mxn', 'open', 'acct_test_3507',
   'voucher_story', 3000, 500, 'cs_test_3507a'),
  ('00000000-0000-4000-8000-0000000e3507', '00000000-0000-4000-8000-0000000a3507',
   '00000000-0000-4000-8000-000000003507', 10000, 'mxn', 'open', 'acct_test_3507',
   'voucher_story', 3000, 500, 'cs_test_3507b');

-- ━━━ EF-only ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select ok(
  not has_function_privilege('anon', 'public.wallet_activate_story(text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.wallet_activate_story(text)', 'EXECUTE'),
  'wallet_activate_story is service-role only'
);

-- ━━━ Paid, held ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  wallet_credit_purchase('00000000-0000-4000-8000-0000000d3507', 'pi_test_3507a', null) ->> 'outcome',
  'credited',
  'a paid Story is settled like any voucher'
);

select is(
  (select count(*)::int from public.wallet_entries where purchase_id = '00000000-0000-4000-8000-0000000d3507'),
  0,
  'a paid Story writes no credit before staff activate it, even when the caller says Available now'
);

select ok(
  (select status = 'paid' and story_token ~ '^[0-9a-f]{32}$' and story_activated_at is null
     from public.wallet_purchases where id = '00000000-0000-4000-8000-0000000d3507'),
  'it reads paid, with a 32-hex activation token and no activation yet'
);

select is(
  (select spendable_cents from public.wallet_balance('00000000-0000-4000-8000-0000000a3507',
     '00000000-0000-4000-8000-000000003507', 'mxn', false, now())),
  0,
  'the guest cannot spend a held Story'
);

select is(
  wallet_credit_purchase('00000000-0000-4000-8000-0000000d3507', 'pi_test_3507a', null) ->> 'outcome',
  'already_paid',
  'settling it again changes nothing'
);

-- ━━━ Activated once ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  wallet_activate_story('ffffffffffffffffffffffffffffffff') ->> 'code',
  'gone',
  'an unknown token is gone'
);

select is(
  wallet_activate_story((select story_token from public.wallet_purchases
                          where id = '00000000-0000-4000-8000-0000000d3507')) ->> 'outcome',
  'activated',
  'staff activate it'
);

select is(
  (select array_agg(kind || ':' || amount_cents order by kind) from public.wallet_entries
    where purchase_id = '00000000-0000-4000-8000-0000000d3507' and available_at <= now()),
  array['bonus:3000', 'voucher:10000'],
  'activation writes the voucher and its 30% bonus, Available now'
);

select is(
  wallet_activate_story((select story_token from public.wallet_purchases
                          where id = '00000000-0000-4000-8000-0000000d3507')) ->> 'outcome',
  'already_active',
  'a second tap answers the stored activation'
);

select is(
  (select count(*)::int from public.wallet_entries where purchase_id = '00000000-0000-4000-8000-0000000d3507'),
  2,
  'and writes nothing more'
);

-- ━━━ Refunded before activation ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select wallet_credit_purchase('00000000-0000-4000-8000-0000000e3507', 'pi_test_3507b', null);

select is(
  wallet_refund_purchase('00000000-0000-4000-8000-0000000e3507', 10000) ->> 'status',
  'refunded',
  'a Story refunded before activation reads refunded, not needs_review'
);

select ok(
  (select uncovered_cents = 0 from public.wallet_purchases where id = '00000000-0000-4000-8000-0000000e3507')
    and not exists (select 1 from public.wallet_entries where purchase_id = '00000000-0000-4000-8000-0000000e3507'),
  'it reverses nothing and leaves nothing uncovered'
);

select is(
  wallet_activate_story((select story_token from public.wallet_purchases
                          where id = '00000000-0000-4000-8000-0000000e3507')) ->> 'code',
  'gone',
  'a refunded Story can no longer be activated'
);

select * from finish();
rollback;
