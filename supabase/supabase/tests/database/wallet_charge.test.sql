-- MESITA-3306 — W2c: the waiter's charge. A code is one place's, unique among
-- its open charges, ten minutes; a charge reads paid when its card part
-- settles later; the sweep deletes expired unpaid charges at once (and one
-- whose payment was released), keeps paid ones 24 h; a try names its kind.

begin;

create extension if not exists pgtap with schema public;

select plan(10);

insert into auth.users (id) values ('00000000-0000-4000-8000-0000000a3306');
insert into public.consumers (id) values ('00000000-0000-4000-8000-0000000a3306');
insert into public.place_profiles (id, google_name) values
  ('00000000-0000-4000-8000-000000013306', 'Charge Probe One'),
  ('00000000-0000-4000-8000-000000023306', 'Charge Probe Two');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000013306', 'mesita-3306-probe-one', 'active', 'generating', 'MXN'),
  ('00000000-0000-4000-8000-000000023306', 'mesita-3306-probe-two', 'active', 'generating', 'MXN');

-- ━━━ Shape ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select throws_ok(
  $$insert into public.place_charges (place_id, code_hash, token_hash, amount_cents, currency, expires_at, ticket)
    values ('00000000-0000-4000-8000-000000013306', 'c-long', 't-long', 100, 'mxn', now() + interval '10 minutes', repeat('x', 33))$$,
  '23514', null,
  'a ticket is at most 32 characters'
);

select throws_ok(
  $$insert into public.place_charge_tries (place_id, addr_hash, kind) values ('00000000-0000-4000-8000-000000013306', 'a', 'robot')$$,
  '23514', null,
  'a try is staff or guest'
);

select throws_ok(
  $$insert into public.place_charge_tries (place_id, addr_hash) values ('00000000-0000-4000-8000-000000013306', 'a')$$,
  '23502', null,
  'every writer names the kind'
);

-- ━━━ A code is one place's, unique among its open charges ━━━━━━━━━━━━━━━━━━━

insert into public.place_charges (id, place_id, code_hash, token_hash, amount_cents, currency, expires_at, ticket)
values ('00000000-0000-4000-8000-0000000c3306', '00000000-0000-4000-8000-000000013306', 'code-a', 'tok-a', 25000, 'mxn',
        now() + interval '10 minutes', 'T-12');

select lives_ok(
  $$insert into public.place_charges (place_id, code_hash, token_hash, amount_cents, currency, expires_at)
    values ('00000000-0000-4000-8000-000000023306', 'code-a', 'tok-b', 100, 'mxn', now() + interval '10 minutes')$$,
  'the same code hash may be open at another place'
);

select throws_ok(
  $$insert into public.place_charges (place_id, code_hash, token_hash, amount_cents, currency, expires_at)
    values ('00000000-0000-4000-8000-000000013306', 'code-a', 'tok-c', 100, 'mxn', now() + interval '10 minutes')$$,
  '23505', null,
  'but never twice among one place''s open charges'
);

-- ━━━ A card part that settles later marks its charge paid ━━━━━━━━━━━━━━━━━━━

insert into public.wallet_payments (id, consumer_id, place_id, amount_cents, credit_cents, card_cents, currency, status, stripe_account_id)
values ('00000000-0000-4000-8000-0000000d3306', '00000000-0000-4000-8000-0000000a3306', '00000000-0000-4000-8000-000000013306',
        25000, 0, 25000, 'mxn', 'open', 'acct_test_3306');
update public.place_charges
   set payment_id = '00000000-0000-4000-8000-0000000d3306', consumer_id = '00000000-0000-4000-8000-0000000a3306'
 where id = '00000000-0000-4000-8000-0000000c3306';

select is(
  (select paid_at from public.place_charges where id = '00000000-0000-4000-8000-0000000c3306'),
  null,
  'an open payment leaves the charge unpaid'
);

update public.wallet_payments set status = 'paid', paid_at = now() - interval '1 minute'
 where id = '00000000-0000-4000-8000-0000000d3306';

select is(
  (select paid_at from public.place_charges where id = '00000000-0000-4000-8000-0000000c3306'),
  (select paid_at from public.wallet_payments where id = '00000000-0000-4000-8000-0000000d3306'),
  'the charge reads paid when its payment does'
);

-- ━━━ Expiry and the sweep ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- An expired unpaid charge, an expired one whose payment was released, a
-- live one, and a paid one an hour old.
insert into public.wallet_payments (id, consumer_id, place_id, amount_cents, credit_cents, card_cents, currency, status, stripe_account_id)
values ('00000000-0000-4000-8000-0000000e3306', '00000000-0000-4000-8000-0000000a3306', '00000000-0000-4000-8000-000000023306',
        300, 0, 300, 'mxn', 'expired', 'acct_test_3306');
insert into public.place_charges (id, place_id, code_hash, token_hash, amount_cents, currency, expires_at, payment_id, created_at) values
  ('00000000-0000-4000-8000-0000000f3306', '00000000-0000-4000-8000-000000023306', 'code-x', 'tok-x', 100, 'mxn', now() - interval '1 second', null, now() - interval '10 minutes'),
  ('00000000-0000-4000-8000-000000103306', '00000000-0000-4000-8000-000000023306', 'code-y', 'tok-y', 300, 'mxn', now() - interval '1 second', '00000000-0000-4000-8000-0000000e3306', now() - interval '10 minutes'),
  ('00000000-0000-4000-8000-000000113306', '00000000-0000-4000-8000-000000023306', 'code-z', 'tok-z', 100, 'mxn', now() + interval '9 minutes', null, now());

select is(place_charges_sweep() >= 2, true, 'the sweep runs');

select is(
  (select array_agg(id::text order by id) from public.place_charges
    where id in ('00000000-0000-4000-8000-0000000f3306', '00000000-0000-4000-8000-000000103306',
                 '00000000-0000-4000-8000-000000113306', '00000000-0000-4000-8000-0000000c3306')),
  array['00000000-0000-4000-8000-0000000c3306', '00000000-0000-4000-8000-000000113306'],
  'expired unpaid charges and a released payment''s charge go; a live one and a recently paid one stay'
);

select ok(
  not has_function_privilege('anon', 'public.place_charges_mark_paid()', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.place_charges_mark_paid()', 'EXECUTE'),
  'nobody but the trigger runs place_charges_mark_paid'
);

select * from finish();
rollback;
