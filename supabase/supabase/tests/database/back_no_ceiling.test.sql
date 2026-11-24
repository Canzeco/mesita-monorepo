-- MESITA-4728, MESITA-4831 — one bill earns MX$1,000 at most and there is no
-- once-a-day rule: a second bill the same day earns too, credit and the tip
-- never earn, and one bill still earns once.

begin;

create extension if not exists pgtap with schema public;

select plan(6);

insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000a4728'),
  ('00000000-0000-4000-8000-0000000c4728');
insert into public.consumers (id) values ('00000000-0000-4000-8000-0000000a4728');
insert into public.place_profiles (id, google_name) values ('00000000-0000-4000-8000-000000014728', 'Back Probe');
insert into public.places (id, slug, state, content_state, currency)
values ('00000000-0000-4000-8000-000000014728', 'mesita-4728-probe', 'active', 'generating', 'MXN');
insert into public.loyalty_cards_contracts (place_id, signed_by, signer_role, terms_version, text_sha256)
values ('00000000-0000-4000-8000-000000014728', '00000000-0000-4000-8000-0000000c4728', 'owner', 'draft-2026-11', repeat('0', 64));
insert into public.place_payment_settings (place_id, loyalty_cards) values ('00000000-0000-4000-8000-000000014728', true);

-- A MX$50,000 bill (MX$49,000 by card, MX$1,000 cash) plus a MX$1,000 tip
-- that never earns; the first bill here, so Welcome.
insert into public.pay_tabs (id, place_id, consumer_id, token_hash, currency, expires_at, status, bill_cents, tip_cents,
                             origin, paid_at, card_bill_cents, cash_bill_cents)
values ('00000000-0000-4000-8000-0000000d4728', '00000000-0000-4000-8000-000000014728',
        '00000000-0000-4000-8000-0000000a4728', repeat('d', 64), 'mxn', now() + interval '1 day', 'paid', 5000000, 100000,
        'waiter', now(), 4900000, 100000);

select is(
  (select amount_cents from public.wallet_entries where tab_id = '00000000-0000-4000-8000-0000000d4728' and kind = 'cashback'),
  100000, 'a MX$50,000 bill earns MX$1,000: the ceiling of one bill');
select ok(not has_function_privilege('authenticated', 'public.visit_cashback_cap_cents()', 'execute'), 'guests never call the ceiling');

-- A second bill the same day, half paid with credit.
insert into public.pay_tabs (id, place_id, consumer_id, token_hash, currency, expires_at, status, bill_cents, tip_cents,
                             origin, paid_at, card_bill_cents, cash_bill_cents)
values ('00000000-0000-4000-8000-0000000e4728', '00000000-0000-4000-8000-000000014728',
        '00000000-0000-4000-8000-0000000a4728', repeat('e', 64), 'mxn', now() + interval '1 day', 'paid', 40000, 0,
        'waiter', now() + interval '1 minute', 20000, 0);

select is(
  (select count(*)::int from public.wallet_entries where tab_id = '00000000-0000-4000-8000-0000000e4728' and kind = 'cashback'),
  1, 'a second bill the same day earns too: no once-a-day rule');

select is(
  (select amount_cents from public.wallet_entries where tab_id = '00000000-0000-4000-8000-0000000e4728' and kind = 'cashback'),
  coalesce((select r.returning_bps from public.place_cashback_rates('00000000-0000-4000-8000-000000014728') r), 500) * 20000 / 10000,
  'the Returning rate on the MX$200 paid by card, never on the credit part');

select is(
  public.pay_tab_grant_cashback('00000000-0000-4000-8000-0000000e4728'),
  0, 'one bill still earns once');

select is(
  (select reason from public.wallet_entries where tab_id = '00000000-0000-4000-8000-0000000d4728' and kind = 'cashback'),
  'welcome', 'the first bill is Welcome');

select * from finish();
rollback;
