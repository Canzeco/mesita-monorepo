
-- MESITA-5124 — one Cashback line: every paid bill here earns the place's one
-- rate (returning_bps), a guest's first bill like every later one, VIP or
-- not, read by pay_bill_quote and pay_tab_grant_cashback. welcome_bps and the
-- VIP columns hold 0 and accept only 0 (two lines, Welcome and Returning,
-- from MESITA-5072), and 10% needs the Small bonus at +20%. The Welcome offer
-- is the Welcome voucher: its bonus is welcome_bonus_bps, +30% or +60%.

begin;

create extension if not exists pgtap with schema public;

select plan(12);

insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000a4789'),
  ('00000000-0000-4000-8000-0000000b4789'),
  ('00000000-0000-4000-8000-0000000f4789');
-- a: a VIP by invitation; b: a regular guest.
insert into public.consumers (id, vip_invited_at) values
  ('00000000-0000-4000-8000-0000000a4789', now()),
  ('00000000-0000-4000-8000-0000000b4789', null);
insert into public.place_profiles (id, google_name) values ('00000000-0000-4000-8000-000000014789', 'One Line Probe');
insert into public.places (id, slug, state, content_state, currency)
values ('00000000-0000-4000-8000-000000014789', 'mesita-5072-probe', 'active', 'generating', 'MXN');
-- Cashback 10% (Small at +20%).
insert into public.place_cashback_settings (place_id, returning_bps, small_bonus_bps)
values ('00000000-0000-4000-8000-000000014789', 1000, 2000);

select throws_ok(
  $$update public.place_cashback_settings set welcome_bps = 1000 where place_id = '00000000-0000-4000-8000-000000014789'$$,
  '23514', null, 'a Welcome cashback rate is refused: Welcome is a voucher');
select is(
  (select welcome_bonus_bps from public.place_cashback_settings where place_id = '00000000-0000-4000-8000-000000014789'),
  3000, 'the Welcome voucher''s bonus starts at +30%');
update public.place_cashback_settings set welcome_bonus_bps = 6000 where place_id = '00000000-0000-4000-8000-000000014789';
select throws_ok(
  $$update public.place_cashback_settings set welcome_bonus_bps = 10000 where place_id = '00000000-0000-4000-8000-000000014789'$$,
  '23514', null, 'the Welcome voucher''s bonus is +30% or +60% only');

select throws_ok(
  $$update public.place_cashback_settings set welcome_vip_bps = 2000 where place_id = '00000000-0000-4000-8000-000000014789'$$,
  '23514', null, 'a non-zero VIP rate is refused');
select throws_ok(
  $$update public.place_cashback_settings set small_bonus_bps = 1000 where place_id = '00000000-0000-4000-8000-000000014789'$$,
  '23514', null, 'Cashback 10% needs Small at +20%');
select is(
  (select r.welcome_bps + r.welcome_vip_bps + r.returning_vip_bps from public.place_cashback_rates('00000000-0000-4000-8000-000000014789') r),
  0, 'place_cashback_rates reads Welcome and the VIP lines as 0');

-- The quote names the one line: a first bill is not a line of its own.
select is(
  public.pay_bill_quote('00000000-0000-4000-8000-0000000a4789', '00000000-0000-4000-8000-000000014789', 'mxn', false, 50000, 0)->>'line',
  'returning', 'a VIP''s first bill quotes the one Cashback line');
select is(
  public.pay_bill_quote('00000000-0000-4000-8000-0000000b4789', '00000000-0000-4000-8000-000000014789', 'mxn', false, 50000, 0)->>'line',
  'returning', 'a regular''s first bill quotes the one Cashback line');

insert into public.loyalty_cards_contracts (place_id, signed_by, signer_role, terms_version, text_sha256)
values ('00000000-0000-4000-8000-000000014789', '00000000-0000-4000-8000-0000000f4789', 'owner', 'draft-2026-11', repeat('0', 64));
insert into public.place_payment_settings (place_id, loyalty_cards) values ('00000000-0000-4000-8000-000000014789', true);
insert into public.pay_tabs (id, place_id, consumer_id, token_hash, currency, expires_at, status, bill_cents, tip_cents,
                             origin, paid_at, cash_bill_cents)
values ('00000000-0000-4000-8000-0000000e4789', '00000000-0000-4000-8000-000000014789',
        '00000000-0000-4000-8000-0000000a4789', repeat('e', 64), 'mxn', now() + interval '1 day', 'paid', 10000, 0,
        'guest', now(), 10000);
select public.pay_tab_grant_cashback('00000000-0000-4000-8000-0000000e4789');

select is(
  (select reason || ':' || amount_cents from public.wallet_entries
    where tab_id = '00000000-0000-4000-8000-0000000e4789' and kind = 'cashback'),
  'returning:1000', 'a first paid bill earns the one rate: MX$10 on MX$100');

insert into public.pay_tabs (id, place_id, consumer_id, token_hash, currency, expires_at, status, bill_cents, tip_cents,
                             origin, paid_at, cash_bill_cents)
values ('00000000-0000-4000-8000-000000104789', '00000000-0000-4000-8000-000000014789',
        '00000000-0000-4000-8000-0000000a4789', repeat('f', 64), 'mxn', now() + interval '1 day', 'paid', 10000, 0,
        'guest', now() + interval '1 minute', 10000);
select public.pay_tab_grant_cashback('00000000-0000-4000-8000-000000104789');

select is(
  (select reason || ':' || amount_cents from public.wallet_entries
    where tab_id = '00000000-0000-4000-8000-000000104789' and kind = 'cashback'),
  'returning:1000', 'a later bill earns the same: MX$10 on MX$100');

-- A bill frozen at a VIP line before MESITA-5072 keeps the rate its guest accepted.
insert into public.pay_tabs (id, place_id, consumer_id, token_hash, currency, expires_at, status, bill_cents, tip_cents,
                             origin, paid_at, cash_bill_cents, cashback_line, cashback_bps)
values ('00000000-0000-4000-8000-000000114789', '00000000-0000-4000-8000-000000014789',
        '00000000-0000-4000-8000-0000000a4789', repeat('d', 64), 'mxn', now() + interval '1 day', 'paid', 10000, 0,
        'guest', now() + interval '2 minutes', 10000, 'returning_vip', 2000);
select public.pay_tab_grant_cashback('00000000-0000-4000-8000-000000114789');
select is(
  (select reason || ':' || amount_cents from public.wallet_entries
    where tab_id = '00000000-0000-4000-8000-000000114789' and kind = 'cashback'),
  'returning_vip:2000', 'a frozen VIP rate is honoured as accepted');

-- A bill frozen at Welcome before MESITA-5124 keeps the line and rate too.
insert into public.pay_tabs (id, place_id, consumer_id, token_hash, currency, expires_at, status, bill_cents, tip_cents,
                             origin, paid_at, cash_bill_cents, cashback_line, cashback_bps)
values ('00000000-0000-4000-8000-000000124789', '00000000-0000-4000-8000-000000014789',
        '00000000-0000-4000-8000-0000000b4789', repeat('c', 64), 'mxn', now() + interval '1 day', 'paid', 10000, 0,
        'guest', now() + interval '3 minutes', 10000, 'welcome', 2000);
select public.pay_tab_grant_cashback('00000000-0000-4000-8000-000000124789');
select is(
  (select reason || ':' || amount_cents from public.wallet_entries
    where tab_id = '00000000-0000-4000-8000-000000124789' and kind = 'cashback'),
  'welcome:2000', 'a frozen Welcome rate is honoured as accepted');

select * from finish();
rollback;
