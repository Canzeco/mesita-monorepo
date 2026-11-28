-- MESITA-4717 — the Offers steps are the money's steps. Prepay: what the
-- guest paid lands with its bonus 3 hours later; a refund inside those hours
-- never eats other credit. Pay: cashback lands 1 hour after the bill, on cash
-- and card only. (Post, the Instagram story reward, was removed by
-- MESITA-4766; its cases went with it.)

begin;

create extension if not exists pgtap with schema public;

select plan(13);

insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000a4717'),
  ('00000000-0000-4000-8000-0000000b4717'),
  ('00000000-0000-4000-8000-0000000c4717');
insert into public.consumers (id) values
  ('00000000-0000-4000-8000-0000000a4717'),
  ('00000000-0000-4000-8000-0000000b4717');
-- MESITA-4746: a story pays only a guest with the followers badge (public,
-- more than 1,000 followers). Both story guests wear it; d does not.
update public.consumers
   set instagram_verified_at = now(), instagram_followers_count = 5000
 where id in ('00000000-0000-4000-8000-0000000a4717', '00000000-0000-4000-8000-0000000b4717');
insert into auth.users (id) values ('00000000-0000-4000-8000-0000000d4747');
insert into public.consumers (id, instagram_verified_at, instagram_followers_count)
values ('00000000-0000-4000-8000-0000000d4747', now(), 500);
insert into public.place_profiles (id, google_name)
values ('00000000-0000-4000-8000-000000014717', 'Steps Probe');
insert into public.places (id, slug, state, content_state, currency)
values ('00000000-0000-4000-8000-000000014717', 'mesita-4717-probe', 'active', 'generating', 'MXN');
insert into public.loyalty_cards_contracts (place_id, signed_by, signer_role, terms_version, text_sha256)
values ('00000000-0000-4000-8000-000000014717', '00000000-0000-4000-8000-0000000c4717', 'owner', 'draft-2026-11', repeat('0', 64));
insert into public.place_payment_settings (place_id, loyalty_cards)
values ('00000000-0000-4000-8000-000000014717', true);

-- ━━━ Prepay: pay, wait 3 hours, receive it all ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, application_fee_cents, stripe_checkout_session_id)
values ('00000000-0000-4000-8000-0000000d4717', '00000000-0000-4000-8000-0000000a4717',
        '00000000-0000-4000-8000-000000014717', 20000, 'mxn', 'open', 'acct_test_4717',
        'voucher_200', 2000, 1000, 'cs_test_4717');

select is(
  wallet_credit_purchase('00000000-0000-4000-8000-0000000d4717', 'pi_test_4717', now() + interval '3 hours') ->> 'outcome',
  'credited', 'a paid voucher is credited');

select is(
  (select count(*)::int from public.wallet_entries
    where purchase_id = '00000000-0000-4000-8000-0000000d4717' and available_at = now() + interval '3 hours'),
  2, 'both lines (what was paid and the bonus) land at p_available_at');

select is(
  (select available_cents from wallet_balance('00000000-0000-4000-8000-0000000a4717', '00000000-0000-4000-8000-000000014717', 'mxn', false, now())),
  0, 'nothing is spendable before the 3 hours');

select is(
  (select pending_cents from wallet_balance('00000000-0000-4000-8000-0000000a4717', '00000000-0000-4000-8000-000000014717', 'mxn', false, now())),
  22000, 'all of it (price + bonus) is pending');

select is(
  (select available_cents from wallet_balance('00000000-0000-4000-8000-0000000a4717', '00000000-0000-4000-8000-000000014717', 'mxn', false, now() + interval '3 hours')),
  22000, 'and all of it lands together');

-- A refund inside the 3 hours: other credit at the place is untouched.
insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, application_fee_cents, stripe_checkout_session_id)
values ('00000000-0000-4000-8000-0000000e4717', '00000000-0000-4000-8000-0000000a4717',
        '00000000-0000-4000-8000-000000014717', 10000, 'mxn', 'open', 'acct_test_4717',
        null, 0, 0, 'cs_test_4717b');
do $$ begin
  perform wallet_credit_purchase('00000000-0000-4000-8000-0000000e4717', 'pi_test_4717b', now() - interval '1 minute');
end $$;

select is(
  (select available_cents from wallet_balance('00000000-0000-4000-8000-0000000a4717', '00000000-0000-4000-8000-000000014717', 'mxn', false, now())),
  10000, 'probe: MX$100 of other credit is available');

select is(
  wallet_refund_purchase('00000000-0000-4000-8000-0000000d4717', 10000) ->> 'outcome',
  'applied', 'half the voucher is refunded inside the 3 hours');

select is(
  (select available_cents from wallet_balance('00000000-0000-4000-8000-0000000a4717', '00000000-0000-4000-8000-000000014717', 'mxn', false, now())),
  10000, 'the reversal waits with the purchase: other credit stays spendable');

select is(
  (select available_cents from wallet_balance('00000000-0000-4000-8000-0000000a4717', '00000000-0000-4000-8000-000000014717', 'mxn', false, now() + interval '3 hours')),
  10000 + 22000 - 11000, 'after landing: the other credit plus what was not refunded');

select is(
  wallet_refund_purchase('00000000-0000-4000-8000-0000000e4717', 5000) ->> 'outcome',
  'applied', 'a refund of a purchase that already landed');

select is(
  (select available_at <= now() from public.wallet_entries
    where purchase_id = '00000000-0000-4000-8000-0000000e4717' and kind = 'reversal'),
  true, 'its reversal is available at once, as before');

-- ━━━ Pay: cashback 1 hour after the bill, cash and card only ━━━━━━━━━━━━━━━━

insert into public.pay_tabs (id, place_id, consumer_id, token_hash, currency, expires_at, status, bill_cents, tip_cents,
                             origin, paid_at, card_bill_cents, cash_bill_cents)
values ('00000000-0000-4000-8000-0000000f4717', '00000000-0000-4000-8000-000000014717',
        '00000000-0000-4000-8000-0000000b4717', repeat('d', 64), 'mxn', now() + interval '1 day', 'paid', 30000, 0,
        'waiter', now(), 10000, 0);

select is(
  (select available_at from public.wallet_entries where tab_id = '00000000-0000-4000-8000-0000000f4717' and kind = 'cashback'),
  now() + interval '1 hour', 'cashback lands 1 hour after the bill');

select is(
  (select amount_cents from public.wallet_entries where tab_id = '00000000-0000-4000-8000-0000000f4717' and kind = 'cashback'),
  500, 'Cashback 5% (the one line, MESITA-5124) of the MX$100 paid by card, not of the MX$300 bill (MX$200 was credit)');

select * from finish();
rollback;
