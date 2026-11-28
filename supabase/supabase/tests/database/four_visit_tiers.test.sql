-- MESITA-4789 — four visit tiers: a guest's first paid bill here is Welcome
-- VIP for a VIP, else Welcome Regular; later bills stay Returning VIP or
-- Returning Regular, read by pay_bill_quote and pay_tab_grant_cashback
-- (Discount is gone, MESITA-5076).

begin;

create extension if not exists pgtap with schema public;

select plan(4);

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
insert into public.place_cashback_settings (place_id, welcome_bps, welcome_vip_bps, returning_bps, returning_vip_bps)
values ('00000000-0000-4000-8000-000000014789', 1000, 2000, 500, 1000);

select is(
  (select r.welcome_vip_bps from public.place_cashback_rates('00000000-0000-4000-8000-000000014789') r),
  2000, 'place_cashback_rates returns the place''s Welcome VIP');

-- The quote names the line: a regular's first bill is Welcome Regular.
select is(
  public.pay_bill_quote('00000000-0000-4000-8000-0000000b4789', '00000000-0000-4000-8000-000000014789', 'mxn', false, 50000, 0)->>'line',
  'welcome', 'a regular''s first bill is Welcome Regular, not Welcome VIP');

-- Cashback: the VIP's first paid bill earns Welcome VIP 20% with reason welcome_vip.
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
  'welcome_vip:2000', 'the VIP''s first paid bill earns Welcome VIP: MX$20 on MX$100, reason welcome_vip');

-- Their next bill is Returning VIP (10%), not Welcome VIP.
insert into public.pay_tabs (id, place_id, consumer_id, token_hash, currency, expires_at, status, bill_cents, tip_cents,
                             origin, paid_at, cash_bill_cents)
values ('00000000-0000-4000-8000-000000104789', '00000000-0000-4000-8000-000000014789',
        '00000000-0000-4000-8000-0000000a4789', repeat('f', 64), 'mxn', now() + interval '1 day', 'paid', 10000, 0,
        'guest', now() + interval '1 minute', 10000);
select public.pay_tab_grant_cashback('00000000-0000-4000-8000-000000104789');

select is(
  (select reason || ':' || amount_cents from public.wallet_entries
    where tab_id = '00000000-0000-4000-8000-000000104789' and kind = 'cashback'),
  'returning_vip:1000', 'their later bill is Returning VIP: MX$10 on MX$100');

select * from finish();
rollback;
