-- MESITA-4789 — four visit tiers: a guest's first paid bill here is Welcome
-- VIP for a VIP, else Welcome Regular; later bills stay Returning VIP or
-- Returning Regular. Both mechanisms read the same line: Discount in
-- pay_guest_begin, Cashback in pay_tab_grant_cashback.

begin;

create extension if not exists pgtap with schema public;

select plan(6);

insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000a4789'),
  ('00000000-0000-4000-8000-0000000b4789'),
  ('00000000-0000-4000-8000-0000000f4789');
-- a: a VIP by invitation; b: a regular guest.
insert into public.consumers (id, vip_invited_at) values
  ('00000000-0000-4000-8000-0000000a4789', now()),
  ('00000000-0000-4000-8000-0000000b4789', null);
insert into public.place_profiles (id, google_name) values ('00000000-0000-4000-8000-000000014789', 'Four Tiers Probe');
insert into public.places (id, slug, state, content_state, currency)
values ('00000000-0000-4000-8000-000000014789', 'mesita-4789-probe', 'active', 'generating', 'MXN');
-- Welcome Regular 10%, Welcome VIP 20%, Returning Regular 5%, Returning VIP 10%.
insert into public.place_cashback_settings (place_id, welcome_bps, welcome_vip_bps, returning_bps, returning_vip_bps, visit_mechanism)
values ('00000000-0000-4000-8000-000000014789', 1000, 2000, 500, 1000, 'discount');

select is(
  (select r.welcome_vip_bps from public.place_cashback_rates('00000000-0000-4000-8000-000000014789') r),
  2000, 'place_cashback_rates returns the place''s Welcome VIP');

-- Discount: MX$500 first bill. The VIP gets 20% (MX$100) off, the regular 10%.
select lives_ok(
  $$select public.pay_guest_begin('00000000-0000-4000-8000-0000000a4789', '00000000-0000-4000-8000-000000014789', 'mxn', false,
      repeat('a', 64), 50000, 0, 40000, 0, 0, 0, '00000000-0000-4000-8000-0000000c4789', null, 0)$$,
  'a VIP''s first bill opens at bill - 20% (Welcome VIP)');

select is(
  (select discount_cents from public.guest_pay_attempts where request_id = '00000000-0000-4000-8000-0000000c4789'),
  10000, 'the VIP''s ticket records MX$100 off: Welcome VIP 20%');

select throws_like(
  $$select public.pay_guest_begin('00000000-0000-4000-8000-0000000b4789', '00000000-0000-4000-8000-000000014789', 'mxn', false,
      repeat('b', 64), 50000, 0, 40000, 0, 0, 0, '00000000-0000-4000-8000-0000000d4789', null, 0)$$,
  '%"line": "welcome"%',
  'a regular''s first bill is Welcome Regular (10%), not Welcome VIP');

-- Cashback: the VIP's first paid bill earns Welcome VIP 20% with reason welcome_vip.
insert into public.loyalty_cards_contracts (place_id, signed_by, signer_role, terms_version, text_sha256)
values ('00000000-0000-4000-8000-000000014789', '00000000-0000-4000-8000-0000000f4789', 'owner', 'draft-2026-11', repeat('0', 64));
insert into public.place_payment_settings (place_id, loyalty_cards) values ('00000000-0000-4000-8000-000000014789', true);
update public.place_cashback_settings set visit_mechanism = 'cashback' where place_id = '00000000-0000-4000-8000-000000014789';
insert into public.pay_tabs (id, place_id, consumer_id, token_hash, currency, expires_at, status, bill_cents, tip_cents,
                             origin, paid_at, cash_bill_cents, visit_mechanism)
values ('00000000-0000-4000-8000-0000000e4789', '00000000-0000-4000-8000-000000014789',
        '00000000-0000-4000-8000-0000000a4789', repeat('e', 64), 'mxn', now() + interval '1 day', 'paid', 10000, 0,
        'guest', now(), 10000, 'cashback');
select public.pay_tab_grant_cashback('00000000-0000-4000-8000-0000000e4789');

select is(
  (select reason || ':' || amount_cents from public.wallet_entries
    where tab_id = '00000000-0000-4000-8000-0000000e4789' and kind = 'cashback'),
  'welcome_vip:2000', 'the VIP''s first paid bill earns Welcome VIP: MX$20 on MX$100, reason welcome_vip');

-- Their next bill is Returning VIP (10%), not Welcome VIP.
insert into public.pay_tabs (id, place_id, consumer_id, token_hash, currency, expires_at, status, bill_cents, tip_cents,
                             origin, paid_at, cash_bill_cents, visit_mechanism)
values ('00000000-0000-4000-8000-000000104789', '00000000-0000-4000-8000-000000014789',
        '00000000-0000-4000-8000-0000000a4789', repeat('f', 64), 'mxn', now() + interval '1 day', 'paid', 10000, 0,
        'guest', now() + interval '1 minute', 10000, 'cashback');
select public.pay_tab_grant_cashback('00000000-0000-4000-8000-000000104789');

select is(
  (select reason || ':' || amount_cents from public.wallet_entries
    where tab_id = '00000000-0000-4000-8000-000000104789' and kind = 'cashback'),
  'returning_vip:1000', 'their later bill is Returning VIP: MX$10 on MX$100');

select * from finish();
rollback;
