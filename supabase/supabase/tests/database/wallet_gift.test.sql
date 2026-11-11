-- MESITA-3292 — a guest sends credit to a friend at the same place.
-- wallet_send_credit moves only spendable credit off the sender at once,
-- once per request_id; a friend takes the link once (gift_in); the sender
-- can take back an open link and not a claimed one; a link never crosses
-- universes or goes back to its own sender; the place still owes an open
-- link; nobody but the service role runs any of it.

begin;

create extension if not exists pgtap with schema public;

select plan(31);

insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000a3292'),
  ('00000000-0000-4000-8000-0000000b3292'),
  ('00000000-0000-4000-8000-0000000c3292');
insert into public.consumers (id) values
  ('00000000-0000-4000-8000-0000000a3292'),
  ('00000000-0000-4000-8000-0000000b3292'),
  ('00000000-0000-4000-8000-0000000c3292');
insert into public.place_profiles (id, google_name) values
  ('00000000-0000-4000-8000-000000013292', 'Gift Probe');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000013292', 'mesita-3292-gift-probe', 'active', 'generating', 'MXN');

-- Guest A holds MX$220 Available: a MX$200 voucher and its MX$20 bonus.
insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, application_fee_cents, stripe_checkout_session_id)
values ('00000000-0000-4000-8000-0000000d3292', '00000000-0000-4000-8000-0000000a3292',
        '00000000-0000-4000-8000-000000013292', 20000, 'mxn', 'open', 'acct_test_3292',
        'voucher_200', 2000, 1000, 'cs_test_3292');
do $$ begin
  perform wallet_credit_purchase('00000000-0000-4000-8000-0000000d3292', 'pi_test_3292', now() - interval '1 minute');
end $$;

-- ━━━ Access ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select ok(
  not has_function_privilege('authenticated', 'public.wallet_send_credit(uuid, uuid, integer, text, boolean, uuid, text, integer, text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.wallet_claim_gift(text, uuid, boolean)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.wallet_claim_gift(text, uuid, boolean)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.wallet_take_back_gift(uuid, uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.wallet_claim_gift_code(text, uuid, boolean, integer)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.wallet_claim_gift_code(text, uuid, boolean, integer)', 'EXECUTE'),
  'client roles cannot run the gift functions'
);

select ok(
  not has_table_privilege('authenticated', 'public.wallet_gifts', 'SELECT')
    and not has_table_privilege('anon', 'public.wallet_gifts', 'SELECT')
    and not has_table_privilege('authenticated', 'public.wallet_gift_code_tries', 'SELECT'),
  'client roles cannot read wallet_gifts or the code tries'
);

-- ━━━ Sending ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  wallet_send_credit('00000000-0000-4000-8000-0000000a3292', '00000000-0000-4000-8000-000000013292', 30000, 'MXN', false,
                     '00000000-0000-4000-8000-00000000a0f0', repeat('f', 64)) ->> 'code',
  'insufficient',
  'more than spendable is refused'
);

create temp table sent as
  select wallet_send_credit('00000000-0000-4000-8000-0000000a3292', '00000000-0000-4000-8000-000000013292', 5000, 'MXN', false,
                            '00000000-0000-4000-8000-00000000a001', repeat('a', 64)) as r;

select is((select r ->> 'outcome' from sent), 'sent', 'A sends MX$50 of their MX$220');

select is(
  (select available_cents from wallet_balance('00000000-0000-4000-8000-0000000a3292', '00000000-0000-4000-8000-000000013292', 'mxn', false)),
  17000,
  'it leaves A at once: MX$170 Available'
);

select is(
  (select kind || ':' || amount_cents from public.wallet_entries where gift_id = (select (r ->> 'gift_id')::uuid from sent)),
  'gift_out:-5000',
  'one gift_out entry, negative'
);

select is(
  wallet_send_credit('00000000-0000-4000-8000-0000000a3292', '00000000-0000-4000-8000-000000013292', 5000, 'mxn', false,
                     '00000000-0000-4000-8000-00000000a001', repeat('b', 64)) ->> 'outcome',
  'already_sent',
  'a replay of the same tap sends nothing more'
);

select is(
  wallet_send_credit('00000000-0000-4000-8000-0000000a3292', '00000000-0000-4000-8000-000000013292', 4000, 'mxn', false,
                     '00000000-0000-4000-8000-00000000a001', repeat('c', 64)) ->> 'code',
  'taken',
  'the same request id with another amount is taken'
);

select is(
  (select count(*)::int from public.wallet_entries where consumer_id = '00000000-0000-4000-8000-0000000a3292' and kind = 'gift_out'),
  1,
  'so A still has one gift_out'
);

select is(
  wallet_place_outstanding('00000000-0000-4000-8000-000000013292', 'MXN', false),
  22000,
  'the place still owes the open link: outstanding stays MX$220'
);

-- ━━━ Taking it ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  wallet_claim_gift(repeat('a', 64), '00000000-0000-4000-8000-0000000a3292', false) ->> 'code',
  'own_gift',
  'the sender cannot take their own link'
);

select is(
  wallet_claim_gift(repeat('a', 64), '00000000-0000-4000-8000-0000000b3292', true) ->> 'code',
  'gone',
  'a test link is gone in the live universe'
);

select is(
  wallet_claim_gift(repeat('a', 64), '00000000-0000-4000-8000-0000000b3292', false) ->> 'outcome',
  'claimed',
  'friend B takes it'
);

select is(
  (select available_cents from wallet_balance('00000000-0000-4000-8000-0000000b3292', '00000000-0000-4000-8000-000000013292', 'mxn', false)),
  5000,
  'B holds MX$50 Available at the same place at once'
);

select is(
  wallet_claim_gift(repeat('a', 64), '00000000-0000-4000-8000-0000000b3292', false) ->> 'outcome',
  'already_claimed',
  'B opening it again takes nothing more'
);

select is(
  wallet_claim_gift(repeat('a', 64), '00000000-0000-4000-8000-0000000c3292', false) ->> 'code',
  'claimed',
  'C finds it taken'
);

select is(
  wallet_take_back_gift((select (r ->> 'gift_id')::uuid from sent), '00000000-0000-4000-8000-0000000a3292') ->> 'code',
  'claimed',
  'A cannot take back a claimed link'
);

select is(
  wallet_place_outstanding('00000000-0000-4000-8000-000000013292', 'MXN', false),
  22000,
  'after the claim the place owes the same MX$220, split between A and B'
);

-- ━━━ Taking it back ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create temp table second as
  select wallet_send_credit('00000000-0000-4000-8000-0000000a3292', '00000000-0000-4000-8000-000000013292', 7000, 'mxn', false,
                            '00000000-0000-4000-8000-00000000a002', repeat('d', 64)) as r;

select is(
  wallet_take_back_gift((select (r ->> 'gift_id')::uuid from second), '00000000-0000-4000-8000-0000000b3292') ->> 'code',
  'gone',
  'only the sender can take a link back'
);

select is(
  wallet_take_back_gift((select (r ->> 'gift_id')::uuid from second), '00000000-0000-4000-8000-0000000a3292') ->> 'outcome',
  'taken_back',
  'A takes back an open MX$70 link'
);

select is(
  (select available_cents from wallet_balance('00000000-0000-4000-8000-0000000a3292', '00000000-0000-4000-8000-000000013292', 'mxn', false)),
  17000,
  'and is back to MX$170'
);

select is(
  wallet_claim_gift(repeat('d', 64), '00000000-0000-4000-8000-0000000c3292', false) ->> 'code',
  'taken_back',
  'a taken-back link gives nothing'
);

-- ━━━ Taking it by code (MESITA-3737) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create temp table coded as
  select wallet_send_credit('00000000-0000-4000-8000-0000000a3292', '00000000-0000-4000-8000-000000013292', 3000, 'mxn', false,
                            '00000000-0000-4000-8000-00000000a003', repeat('e', 64), 10, repeat('1', 64)) as r;

select is((select r ->> 'outcome' from coded), 'sent', 'A sends MX$30 with a code');

select throws_ok(
  $$select wallet_send_credit('00000000-0000-4000-8000-0000000a3292', '00000000-0000-4000-8000-000000013292', 1000, 'mxn', false,
                              '00000000-0000-4000-8000-00000000a004', repeat('9', 64), 10, repeat('1', 64))$$,
  '23505',
  null,
  'a code is never issued twice'
);

select is(
  wallet_claim_gift_code(repeat('1', 64), '00000000-0000-4000-8000-0000000c3292', true) ->> 'code',
  'gone',
  'a test code is gone in the live universe'
);

select is(
  wallet_claim_gift_code(repeat('1', 64), '00000000-0000-4000-8000-0000000c3292', false) ->> 'outcome',
  'claimed',
  'friend C takes it by typing the code'
);

select is(
  wallet_claim_gift(repeat('e', 64), '00000000-0000-4000-8000-0000000b3292', false) ->> 'code',
  'claimed',
  'and the link gives nothing after it'
);

select is(
  wallet_claim_gift_code(repeat('1', 64), '00000000-0000-4000-8000-0000000b3292', false) ->> 'code',
  'claimed',
  'nor does the code again'
);

do $$ begin
  for i in 1..4 loop
    perform wallet_claim_gift_code(repeat('0', 64), '00000000-0000-4000-8000-0000000b3292', false);
  end loop;
end $$;

select is(
  (select count(*)::int from public.wallet_gift_code_tries where consumer_id = '00000000-0000-4000-8000-0000000b3292'),
  4,
  'each wrong code counts one try; a right but taken code does not'
);

select is(
  wallet_claim_gift_code(repeat('0', 64), '00000000-0000-4000-8000-0000000b3292', false) ->> 'code',
  'gone',
  'the fifth wrong code still answers gone'
);

select is(
  wallet_claim_gift_code(repeat('1', 64), '00000000-0000-4000-8000-0000000b3292', false) ->> 'code',
  'too_many_tries',
  'after five wrong codes in an hour even a real code is refused'
);

select * from finish();

rollback;
