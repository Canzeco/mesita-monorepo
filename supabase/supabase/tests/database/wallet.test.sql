-- MESITA-3097 — Wallet: a paid purchase is credited exactly once, entries
-- are history (never edited), and nobody but the EFs touches either table.

begin;

create extension if not exists pgtap with schema public;

select plan(9);

insert into auth.users (id) values ('00000000-0000-4000-8000-0000000a3097');
insert into public.consumers (id) values ('00000000-0000-4000-8000-0000000a3097');
insert into public.place_profiles (id, google_name)
values ('00000000-0000-4000-8000-000000003097', 'Wallet Probe');
insert into public.places (id, slug, state, content_state, currency)
values ('00000000-0000-4000-8000-000000003097', 'mesita-3097-probe', 'active', 'generating', 'MXN');

insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, stripe_checkout_session_id)
values ('00000000-0000-4000-8000-0000000b3097', '00000000-0000-4000-8000-0000000a3097',
        '00000000-0000-4000-8000-000000003097', 50000, 'mxn', 'cs_test_3097');

-- ━━━ EF-only ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select ok(
  (select relrowsecurity from pg_class where oid = 'public.wallet_purchases'::regclass)
    and (select relrowsecurity from pg_class where oid = 'public.wallet_entries'::regclass)
    and not exists (select 1 from pg_policies where schemaname = 'public'
                     and tablename in ('wallet_purchases', 'wallet_entries')),
  'wallet tables have RLS on and no policy: the EF-only lockdown'
);

select ok(
  not has_table_privilege('anon', 'public.wallet_entries', 'SELECT')
    and not has_table_privilege('authenticated', 'public.wallet_entries', 'SELECT')
    and not has_table_privilege('authenticated', 'public.wallet_entries', 'INSERT')
    and not has_table_privilege('authenticated', 'public.wallet_purchases', 'SELECT')
    and not has_table_privilege('authenticated', 'public.wallet_purchases', 'UPDATE')
    and not has_function_privilege('authenticated', 'public.wallet_credit_purchase(uuid, text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.wallet_credit_purchase(uuid, text)', 'EXECUTE'),
  'client roles hold nothing on the wallet; wallet_credit_purchase is service-role only'
);

-- ━━━ Credited once ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  wallet_credit_purchase('00000000-0000-4000-8000-0000000b3097', 'pi_test_3097') ->> 'outcome',
  'credited',
  'a paid purchase is credited'
);

select is(
  wallet_credit_purchase('00000000-0000-4000-8000-0000000b3097', 'pi_test_3097') ->> 'outcome',
  'already_paid',
  'crediting it again does nothing'
);

select is(
  (select sum(amount_cents)::int from public.wallet_entries
    where consumer_id = '00000000-0000-4000-8000-0000000a3097'),
  50000,
  'the balance holds the purchase once'
);

select is(
  (select status from public.wallet_purchases where id = '00000000-0000-4000-8000-0000000b3097'),
  'paid',
  'the purchase reads paid'
);

-- ━━━ History is never edited ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select throws_ok(
  $$update public.wallet_entries set amount_cents = 1
     where consumer_id = '00000000-0000-4000-8000-0000000a3097'$$,
  'P0001', null,
  'an entry is never edited'
);

select throws_ok(
  $$insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency)
    values ('00000000-0000-4000-8000-0000000a3097', '00000000-0000-4000-8000-000000003097', 'prepay', 100, 'mxn')$$,
  '23514', null,
  'a prepay entry names its purchase'
);

-- A deleted account keeps the record, with no owner.
delete from public.consumers where id = '00000000-0000-4000-8000-0000000a3097';

select is(
  (select count(*)::int from public.wallet_entries
    where place_id = '00000000-0000-4000-8000-000000003097' and consumer_id is null),
  1,
  'a deleted account leaves its entries, owned by nobody'
);

select * from finish();

rollback;
