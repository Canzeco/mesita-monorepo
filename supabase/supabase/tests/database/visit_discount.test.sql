-- MESITA-4770 — visit offers: Discount or Cashback over the same Welcome /
-- Returning rates. pay_guest_begin works the discount out (the printed bill,
-- rounded down, no Credits Agreement needed), refuses parts that don't add
-- up to bill - discount (discount_changed), records it on the ticket, and a
-- bill recorded as discount never earns cashback.

begin;

create extension if not exists pgtap with schema public;

select plan(8);

insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000a4770'),
  ('00000000-0000-4000-8000-0000000f4770');
insert into public.consumers (id) values ('00000000-0000-4000-8000-0000000a4770');
insert into public.place_profiles (id, google_name) values ('00000000-0000-4000-8000-000000014770', 'Discount Probe');
insert into public.places (id, slug, state, content_state, currency)
values ('00000000-0000-4000-8000-000000014770', 'mesita-4770-probe', 'active', 'generating', 'MXN');
-- No Credits Agreement, Loyalty Cards Off: a discount still applies.
insert into public.place_cashback_settings (place_id, welcome_bps, returning_bps, visit_mechanism)
values ('00000000-0000-4000-8000-000000014770', 2000, 500, 'discount');

select is(public.place_visit_mechanism('00000000-0000-4000-8000-000000014770'), 'discount',
  'the place''s own row names its mechanism');

-- MX$500 printed bill, Welcome 20% = MX$100 off: the phone that sends parts
-- for the whole MX$500 is refused with the right numbers.
select throws_like(
  $$select public.pay_guest_begin('00000000-0000-4000-8000-0000000a4770', '00000000-0000-4000-8000-000000014770', 'mxn', false,
      repeat('a', 64), 50000, 0, 50000, 0, 0, 0, '00000000-0000-4000-8000-0000000b4770', null, 0)$$,
  '%discount_changed%',
  'parts for the whole printed bill are refused: discount_changed');

select lives_ok(
  $$select public.pay_guest_begin('00000000-0000-4000-8000-0000000a4770', '00000000-0000-4000-8000-000000014770', 'mxn', false,
      repeat('b', 64), 50000, 0, 40000, 5000, 0, 0, '00000000-0000-4000-8000-0000000c4770', null, 0)$$,
  'cash for bill - discount, plus a tip, opens the ticket');

select is(
  (select discount_cents from public.guest_pay_attempts where request_id = '00000000-0000-4000-8000-0000000c4770'),
  10000, 'the ticket records MX$100 off the MX$500 bill (Welcome 20%)');

select is(
  (select visit_mechanism from public.guest_pay_attempts where request_id = '00000000-0000-4000-8000-0000000c4770'),
  'discount', 'the ticket records the mechanism that applied');

select is(
  (select cash_cents from public.guest_pay_attempts where request_id = '00000000-0000-4000-8000-0000000c4770'),
  45000, 'cash due is MX$400 plus the MX$50 tip: the tip is never discounted');

-- A paid bill recorded as discount earns no cashback, even once the place
-- turns cashback and Loyalty Cards on.
insert into public.loyalty_cards_contracts (place_id, signed_by, signer_role, terms_version, text_sha256)
values ('00000000-0000-4000-8000-000000014770', '00000000-0000-4000-8000-0000000f4770', 'owner', 'draft-2026-11', repeat('0', 64));
insert into public.place_payment_settings (place_id, loyalty_cards) values ('00000000-0000-4000-8000-000000014770', true);
update public.place_cashback_settings set visit_mechanism = 'cashback' where place_id = '00000000-0000-4000-8000-000000014770';
insert into public.pay_tabs (id, place_id, consumer_id, token_hash, currency, expires_at, status, bill_cents, tip_cents,
                             origin, paid_at, cash_bill_cents, visit_mechanism, discount_bps, discount_cents)
values ('00000000-0000-4000-8000-0000000d4770', '00000000-0000-4000-8000-000000014770',
        '00000000-0000-4000-8000-0000000a4770', repeat('d', 64), 'mxn', now() + interval '1 day', 'paid', 50000, 0,
        'guest', now(), 40000, 'discount', 2000, 10000);

select is(
  (select count(*)::int from public.wallet_entries where tab_id = '00000000-0000-4000-8000-0000000d4770' and kind = 'cashback'),
  0, 'a discounted bill never earns cashback, whatever the place picks later');

select is(public.place_visit_mechanism('00000000-0000-4000-8000-0000000e4770'), 'cashback',
  'a place with no row reads the defaults: cashback');

select * from finish();
rollback;
