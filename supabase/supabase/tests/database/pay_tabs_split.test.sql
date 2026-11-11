-- MESITA-3695 — Pay at the table: friends split one bill. Money rules: a
-- split table is never paid whole and its bill is locked; friends join by
-- the join QR and take what is left; two shares racing for the last part
-- cannot both pay it; each cash share has its own Received; shares that
-- cover the bill pay the table; a table a friend paid part of cannot be
-- cancelled; a friend's share never blocks their own tab at the place; only
-- the service role can call any of it.

begin;

create extension if not exists pgtap with schema public;

select plan(22);

-- Guests A (opens the table), B and C (friends); one place.
insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000a3695'), ('00000000-0000-4000-8000-0000000b3695'), ('00000000-0000-4000-8000-0000000c3695');
insert into public.consumers (id) values
  ('00000000-0000-4000-8000-0000000a3695'), ('00000000-0000-4000-8000-0000000b3695'), ('00000000-0000-4000-8000-0000000c3695');
insert into public.place_profiles (id, google_name) values ('00000000-0000-4000-8000-000000013695', 'Split Probe');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000013695', 'mesita-3695-probe', 'active', 'generating', 'MXN');

select ok(
  not has_function_privilege('authenticated', 'public.pay_tab_split(uuid, uuid, integer, integer, text, text, timestamptz)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.pay_tab_join(text, uuid, text, timestamptz)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.pay_tab_set_share(uuid, uuid, integer, timestamptz)', 'EXECUTE'),
  'client roles cannot split, join or change a share');

-- The table: A opens, the waiter bills $1,000MX with a $100MX tip suggestion.
create temp table tb on commit drop as
select (pay_tab_open('00000000-0000-4000-8000-0000000a3695', '00000000-0000-4000-8000-000000013695',
  repeat('1', 64), 'MXN', false)->>'tab_id')::uuid as id;
select is(pay_tab_bill(repeat('1', 64), repeat('e', 64), true, 0, 100000, 10000, 'T9', 'Ana')->>'outcome',
  'billed', 'the waiter bills the table');

-- ━━━ A splits in two ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  pay_tab_split((select id from tb), '00000000-0000-4000-8000-0000000b3695', 2, 50000, repeat('2', 64), repeat('3', 64))->>'code',
  'not_found', 'only the guest holding the table can split it');
create temp table sa on commit drop as
select pay_tab_split((select id from tb), '00000000-0000-4000-8000-0000000a3695', 2, 50000, repeat('2', 64), repeat('3', 64)) as r;
select is((select r->>'outcome' from sa), 'split', 'A splits in two');
select is(
  (select (bill_cents, tip_cents, status, staff_key_hash = repeat('e', 64))::text from public.pay_tabs
    where id = (select (r->>'share_tab_id')::uuid from sa)),
  '(50000,5000,billed,t)', 'A''s share: $500MX, half the tip suggestion, billed under the waiter''s key');
select throws_like(
  $$select pay_tab_open_parts((select id from tb), '00000000-0000-4000-8000-0000000a3695', 1,
      0, 100000, 0, 0, 0, gen_random_uuid(), null, 200, 5)$$,
  '%split_locked%', 'a split table is never paid whole');
select is(pay_tab_bill(repeat('1', 64), repeat('e', 64), false, 1, 90000, 0, null, null)->>'code',
  'split_locked', 'the waiter cannot change a split bill');
select is(
  pay_tab_open('00000000-0000-4000-8000-0000000a3695', '00000000-0000-4000-8000-000000013695', repeat('4', 64), 'MXN', false)->>'tab_id',
  (select id::text from tb), 'opening Pay again at the place finds A''s table, never the share');

-- ━━━ Friends join ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(pay_tab_join(repeat('9', 64), '00000000-0000-4000-8000-0000000b3695', repeat('5', 64))->>'code',
  'not_found', 'a wrong join QR finds nothing');
create temp table sb on commit drop as
select pay_tab_join(repeat('2', 64), '00000000-0000-4000-8000-0000000b3695', repeat('5', 64)) as r;
select is((select (r->>'share_cents')::int from sb), 50000, 'B joins with the equal part, $500MX');
select is(pay_tab_join(repeat('2', 64), '00000000-0000-4000-8000-0000000b3695', repeat('6', 64))->>'share_tab_id',
  (select r->>'share_tab_id' from sb), 'B scanning again gets the same share');
select is(pay_tab_join(repeat('2', 64), '00000000-0000-4000-8000-0000000c3695', repeat('7', 64))->>'code',
  'nothing_left', 'C finds nothing left: both halves are claimed');
select is(
  pay_tab_open('00000000-0000-4000-8000-0000000b3695', '00000000-0000-4000-8000-000000013695', repeat('8', 64), 'MXN', false)->>'outcome',
  'opened', 'B''s share never blocks B''s own tab at the place');

-- ━━━ Paying: the last part cannot be paid twice ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  pay_tab_open_parts((select (r->>'share_tab_id')::uuid from sa), '00000000-0000-4000-8000-0000000a3695', 1,
    0, 50000, 5000, 0, 0, gen_random_uuid(), null, 200, 5)->>'status',
  'paying', 'A pays their $500MX share in cash');
select is(
  pay_tab_set_share((select (r->>'share_tab_id')::uuid from sb), '00000000-0000-4000-8000-0000000b3695', 60000)->>'code',
  'share_too_big', 'B cannot take $600MX: only $500MX is left');
select throws_like(
  $$update public.pay_tabs set bill_cents = 60000 where id = (select (r->>'share_tab_id')::uuid from sb);
    select pay_tab_open_parts((select (r->>'share_tab_id')::uuid from sb), '00000000-0000-4000-8000-0000000b3695', 1,
      0, 60000, 0, 0, 0, gen_random_uuid(), null, 200, 5)$$,
  '%share_too_big%', 'a share bigger than what is left never starts paying, even past the share check');
update public.pay_tabs set bill_cents = 50000 where id = (select (r->>'share_tab_id')::uuid from sb);
select is(
  pay_tab_open_parts((select (r->>'share_tab_id')::uuid from sb), '00000000-0000-4000-8000-0000000b3695', 1,
    0, 50000, 0, 0, 0, gen_random_uuid(), null, 200, 5)->>'status',
  'paying', 'B pays the other $500MX in cash');
select throws_like(
  $$select pay_tab_change((select id from tb), '00000000-0000-4000-8000-0000000a3695', 'cancel')$$,
  '%paid_part%', 'A cannot cancel the table while friends are paying it');

-- ━━━ Received, one share at a time ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(pay_tab_cash(repeat('3', 64), repeat('e', 64), null)->>'outcome', 'paid',
  'the waiter confirms A''s $550MX');
select is((select status from public.pay_tabs where id = (select id from tb)), 'billed',
  'half paid: the table is still open');
select is(pay_tab_cash(repeat('5', 64), repeat('e', 64), null)->>'outcome', 'paid',
  'the waiter confirms B''s $500MX');
select is((select status from public.pay_tabs where id = (select id from tb)), 'paid',
  'the shares cover the bill: the table is paid');

select * from finish();
rollback;
