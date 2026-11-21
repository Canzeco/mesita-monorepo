-- MESITA-4524 — every guest pay ticket ends: closed (paid) or released with
-- one end_reason. Credit is held while live, spent once at close, freed on
-- release. Confirm and Cancel claim the row; the loser is refused. A ticket
-- past its window ends at the next begin. (MESITA-4502's "no pay_tabs row
-- until closed" still holds.)

begin;

create extension if not exists pgtap with schema public;

select plan(30);

insert into auth.users (id) values ('00000000-0000-4000-8000-0000000a4524');
insert into public.consumers (id, first_name) values ('00000000-0000-4000-8000-0000000a4524', 'Ada');
insert into public.place_profiles (id, google_name) values
  ('00000000-0000-4000-8000-000000014524', 'No Zombie Probe'),
  ('00000000-0000-4000-8000-000000024524', 'No Zombie Probe Two');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000014524', 'mesita-4524-probe', 'active', 'generating', 'MXN'),
  ('00000000-0000-4000-8000-000000024524', 'mesita-4524-probe-two', 'active', 'generating', 'MXN');

insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, application_fee_cents, stripe_checkout_session_id)
values ('00000000-0000-4000-8000-0000000d4524', '00000000-0000-4000-8000-0000000a4524',
        '00000000-0000-4000-8000-000000014524', 20000, 'mxn', 'open', 'acct_test_4524',
        'voucher_200', 2000, 1000, 'cs_test_4524');
do $$ begin
  perform wallet_credit_purchase('00000000-0000-4000-8000-0000000d4524', 'pi_test_4524', now() - interval '1 minute');
end $$;

create temp table t_spendable as select 0 as v;
create or replace function pg_temp.spendable() returns integer language sql as $$
  select spendable_cents from wallet_balance('00000000-0000-4000-8000-0000000a4524', '00000000-0000-4000-8000-000000014524', 'mxn', false) $$;
create or replace function pg_temp.att(p_req text) returns uuid language sql as $$
  select id from guest_pay_attempts where request_id = p_req::uuid $$;
create or replace function pg_temp.begin_pay(p_req text, p_hash text, p_bill int, p_credit int, p_cash int, p_card int,
    p_place uuid default '00000000-0000-4000-8000-000000014524') returns jsonb language sql as $$
  select pay_guest_begin('00000000-0000-4000-8000-0000000a4524', p_place, 'MXN', false,
    p_hash, p_bill, p_credit, p_cash, 0, p_card, 0, p_req::uuid,
    case when p_card > 0 then 'acct_test_4524' end, 0, 15) $$;

-- The voucher gives 20000 + a 2000 bonus: 22000 spendable.
-- 1. Credits-only: live (held), not paid; the credit is held, not spent.
select is((pg_temp.begin_pay('00000000-0000-4000-8000-0000000e4521', repeat('a', 64), 5000, 5000, 0, 0))->>'phase',
  'live', 'credits-only opens live, waiting for the waiter');
select is(pg_temp.spendable(), 17000, 'its credit is held while live');
select is((select count(*) from pay_tabs where consumer_id = '00000000-0000-4000-8000-0000000a4524'), 0::bigint,
  'no ticket while live');

-- 2. One open ticket per guest, at any place.
select throws_ok(
  $$ select pg_temp.begin_pay('00000000-0000-4000-8000-0000000e4522', repeat('b', 64), 1000, 0, 1000, 0, '00000000-0000-4000-8000-000000024524') $$,
  NULL, NULL, 'a second open ticket is refused (too_many_open)');

-- 3. The guest's Cancel claim wins before the waiter; Confirm then loses.
select is((pay_guest_claim_end(pg_temp.att('00000000-0000-4000-8000-0000000e4521'), 'cancelled',
  '00000000-0000-4000-8000-0000000a4524', null))->>'outcome', 'claimed', 'Cancel claims the live ticket');
select is((pay_guest_claim_confirm(pg_temp.att('00000000-0000-4000-8000-0000000e4521'),
  '00000000-0000-4000-8000-000000014524', repeat('9', 64)))->>'code', 'already_final', 'Confirm after a Cancel claim is refused');
select is((pay_guest_finish_release(pg_temp.att('00000000-0000-4000-8000-0000000e4521'), 'cancelled'))->>'outcome',
  'released', 'the release finishes');
select is((select end_reason from guest_pay_attempts where id = pg_temp.att('00000000-0000-4000-8000-0000000e4521')),
  'cancelled', 'a released ticket says why');
select is(pg_temp.spendable(), 22000, 'a release frees the held credit, spending nothing');

-- 4. Credits-only confirmed: the credit is spent once, one ticket.
select pg_temp.begin_pay('00000000-0000-4000-8000-0000000e4523', repeat('c', 64), 4000, 4000, 0, 0);
select is((pay_guest_claim_confirm(pg_temp.att('00000000-0000-4000-8000-0000000e4523'),
  '00000000-0000-4000-8000-000000024524', repeat('9', 64)))->>'code', 'forbidden', 'another place cannot confirm it');
select is((pay_guest_claim_confirm(pg_temp.att('00000000-0000-4000-8000-0000000e4523'),
  '00000000-0000-4000-8000-000000014524', repeat('9', 64)))->>'outcome', 'claimed', 'the waiter confirms');
select is((pay_guest_claim_confirm(pg_temp.att('00000000-0000-4000-8000-0000000e4523'),
  '00000000-0000-4000-8000-000000014524', repeat('9', 64)))->>'outcome', 'charging', 'a repeat Confirm answers charging');
select is((pay_guest_claim_end(pg_temp.att('00000000-0000-4000-8000-0000000e4523'), 'cancelled',
  '00000000-0000-4000-8000-0000000a4524', null))->>'code', 'charging', 'Cancel after Confirm is refused');
select is((pay_guest_close(pg_temp.att('00000000-0000-4000-8000-0000000e4523')))->>'outcome', 'closed', 'it closes');
select is((pay_guest_close(pg_temp.att('00000000-0000-4000-8000-0000000e4523')))->>'outcome', 'already', 'a second close is the first');
select is(pg_temp.spendable(), 18000, 'the credit was spent exactly once');
select is((select count(*) from pay_tabs where consumer_id = '00000000-0000-4000-8000-0000000a4524' and status = 'paid'),
  1::bigint, 'one paid ticket');

-- 5. Card: placing the hold, then live; Confirm needs the hold.
select is((pg_temp.begin_pay('00000000-0000-4000-8000-0000000e4524', repeat('d', 64), 3000, 1000, 0, 2000))->>'phase',
  'placing_hold', 'a card ticket starts placing its hold');
select is((pay_guest_claim_confirm(pg_temp.att('00000000-0000-4000-8000-0000000e4524'),
  '00000000-0000-4000-8000-000000014524', repeat('9', 64)))->>'code', 'card_pending', 'no Confirm before the hold lands');
select is((pay_guest_mark_held(pg_temp.att('00000000-0000-4000-8000-0000000e4524')))->>'phase', 'live', 'the hold makes it live');
select is((pay_guest_claim_confirm(pg_temp.att('00000000-0000-4000-8000-0000000e4524'),
  '00000000-0000-4000-8000-000000014524', repeat('9', 64)))->>'outcome', 'claimed', 'Confirm claims the held card');
select is((pay_guest_close(pg_temp.att('00000000-0000-4000-8000-0000000e4524')))->>'code', 'card_pending',
  'a card ticket closes only once the payment is paid');
-- A capture refused and read back: declined, credit freed.
select is((pay_guest_finish_release(pg_temp.att('00000000-0000-4000-8000-0000000e4524'), 'declined'))->>'end_reason',
  'declined', 'a refused capture releases declined');
select is(pg_temp.spendable(), 18000, 'the declined card freed its held credit');

-- 6. A ticket past its window ends when the guest begins again.
select pg_temp.begin_pay('00000000-0000-4000-8000-0000000e4525', repeat('e', 64), 2000, 0, 2000, 0);
update guest_pay_attempts set expires_at = now() - interval '1 minute' where id = pg_temp.att('00000000-0000-4000-8000-0000000e4525');
select is((pg_temp.begin_pay('00000000-0000-4000-8000-0000000e4526', repeat('f', 64), 1000, 0, 1000, 0))->>'phase',
  'live', 'a new ticket begins');
select is((select end_reason from guest_pay_attempts where id = pg_temp.att('00000000-0000-4000-8000-0000000e4525')),
  'expired', 'the old one ended expired');
select is((pay_guest_claim_confirm(pg_temp.att('00000000-0000-4000-8000-0000000e4525'),
  '00000000-0000-4000-8000-000000014524', repeat('9', 64)))->>'code', 'already_final', 'an expired ticket cannot be confirmed');

-- 7. The sweep lists a live ticket past its window.
update guest_pay_attempts set expires_at = now() - interval '1 minute' where id = pg_temp.att('00000000-0000-4000-8000-0000000e4526');
select ok(exists (select 1 from pay_guest_sweep_list() where attempt_id = pg_temp.att('00000000-0000-4000-8000-0000000e4526')),
  'the sweep finds a ticket past its window');

-- 8. Cash received by the owner closes it once.
update guest_pay_attempts set expires_at = now() + interval '5 minutes' where id = pg_temp.att('00000000-0000-4000-8000-0000000e4526');
select is((pay_guest_receive(pg_temp.att('00000000-0000-4000-8000-0000000e4526'), '00000000-0000-4000-8000-000000014524', 1000))->>'outcome',
  'received', 'Received closes a cash ticket');

-- 9. Nothing ends without a reason, and every ticket here ended.
select is((select count(*) from guest_pay_attempts where consumer_id = '00000000-0000-4000-8000-0000000a4524'
            and status = 'released' and end_reason is null), 0::bigint, 'every release has a reason');

select * from finish();
rollback;
