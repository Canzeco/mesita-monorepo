-- MESITA-3841 — the voucher basket. Several wallet_purchases rows share one
-- PaymentIntent only when one is the basket's lead and the others point to
-- it (basket_lead_id); two leads (or two single purchases) with the same
-- PaymentIntent are refused; a follower carries no request_id; each row of
-- a basket credits itself through wallet_credit_purchase.

begin;

create extension if not exists pgtap with schema public;

select plan(10);

insert into auth.users (id) values ('00000000-0000-4000-8000-0000000a3841');
insert into public.consumers (id) values ('00000000-0000-4000-8000-0000000a3841');
insert into public.place_profiles (id, google_name) values
  ('00000000-0000-4000-8000-000000013841', 'Basket Probe');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000013841', 'mesita-3841-probe', 'active', 'generating', 'MXN');

select has_column('public', 'wallet_purchases', 'basket_lead_id', 'purchases name their basket''s lead');

-- The lead, opening under the tap's request_id.
insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, request_id)
values ('00000000-0000-4000-8000-0000000d3841', '00000000-0000-4000-8000-0000000a3841',
        '00000000-0000-4000-8000-000000013841', 20000, 'mxn', 'opening', 'acct_test_3841',
        'voucher_200', 2000, '00000000-0000-4000-8000-0000000e3841');

select lives_ok(
  $$insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                         voucher, bonus_cents, basket_lead_id)
    values ('00000000-0000-4000-8000-0000000f3841', '00000000-0000-4000-8000-0000000a3841',
            '00000000-0000-4000-8000-000000013841', 100000, 'mxn', 'opening', 'acct_test_3841',
            'voucher_1000', 20000, '00000000-0000-4000-8000-0000000d3841')$$,
  'a follower opens under its lead'
);

select throws_ok(
  $$insert into public.wallet_purchases (consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                         voucher, bonus_cents, basket_lead_id, request_id)
    values ('00000000-0000-4000-8000-0000000a3841', '00000000-0000-4000-8000-000000013841', 20000, 'mxn', 'opening',
            'acct_test_3841', 'voucher_200', 2000, '00000000-0000-4000-8000-0000000d3841',
            '00000000-0000-4000-8000-0000000c3841')$$,
  '23514', null,
  'a follower carries no request_id'
);

-- Opening names the PaymentIntent on the lead and its follower in one write.
select lives_ok(
  $$update public.wallet_purchases set status = 'open', stripe_payment_intent_id = 'pi_basket_3841'
     where id = '00000000-0000-4000-8000-0000000d3841' or basket_lead_id = '00000000-0000-4000-8000-0000000d3841'$$,
  'the lead and its follower share one PaymentIntent'
);

select throws_ok(
  $$insert into public.wallet_purchases (consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                         voucher, bonus_cents, stripe_payment_intent_id)
    values ('00000000-0000-4000-8000-0000000a3841', '00000000-0000-4000-8000-000000013841', 20000, 'mxn', 'open',
            'acct_test_3841', 'voucher_200', 2000, 'pi_basket_3841')$$,
  '23505', null,
  'a second lead with the same PaymentIntent is refused'
);

-- Another single purchase, with its own PaymentIntent.
insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, stripe_payment_intent_id)
values ('00000000-0000-4000-8000-0000000b3841', '00000000-0000-4000-8000-0000000a3841',
        '00000000-0000-4000-8000-000000013841', 20000, 'mxn', 'open', 'acct_test_3841',
        'voucher_200', 2000, 'pi_single_3841');

select throws_ok(
  $$insert into public.wallet_purchases (consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                         voucher, bonus_cents, basket_lead_id, stripe_payment_intent_id)
    values ('00000000-0000-4000-8000-0000000a3841', '00000000-0000-4000-8000-000000013841', 20000, 'mxn', 'open',
            'acct_test_3841', 'voucher_200', 2000, '00000000-0000-4000-8000-0000000b3841', 'pi_basket_3841')$$,
  '23503', null,
  'a follower cannot carry a PaymentIntent that is not its lead''s'
);

select throws_ok(
  $$update public.wallet_purchases set basket_lead_id = id where id = '00000000-0000-4000-8000-0000000b3841'$$,
  '23514', null,
  'a row is never its own lead'
);

-- Each row credits itself from the shared PaymentIntent.
do $$ begin
  perform wallet_credit_purchase('00000000-0000-4000-8000-0000000d3841', 'pi_basket_3841', now() - interval '1 minute');
  perform wallet_credit_purchase('00000000-0000-4000-8000-0000000f3841', 'pi_basket_3841', now() - interval '1 minute');
end $$;

select is(
  (select count(*)::int from public.wallet_purchases where stripe_payment_intent_id = 'pi_basket_3841' and status = 'paid'),
  2,
  'both rows of the basket are paid'
);
select is(
  (select sum(amount_cents)::int from public.wallet_entries
    where purchase_id in ('00000000-0000-4000-8000-0000000d3841', '00000000-0000-4000-8000-0000000f3841')
      and kind in ('voucher', 'bonus')),
  142000,
  'each row wrote its own voucher and bonus: MX$220 + MX$1,200'
);

-- A refund spread over the basket lands per row.
select is(
  (public.wallet_refund_purchase('00000000-0000-4000-8000-0000000f3841', 100000) ->> 'status'),
  'refunded',
  'a follower refunds through the same RPC'
);

select * from finish();
rollback;
