-- MESITA-3460 — a lost dispute takes the cashback back like a refund. The
-- refund RPCs take a third argument, p_reason (refund | dispute_lost,
-- default refund), and store it on the reversal entry; the two-argument
-- versions are gone; an unknown reason changes nothing; only the service
-- role runs them.

begin;

create extension if not exists pgtap with schema public;

select plan(10);

insert into auth.users (id) values ('00000000-0000-4000-8000-0000000a3460');
insert into public.consumers (id) values ('00000000-0000-4000-8000-0000000a3460');
insert into public.place_profiles (id, google_name) values
  ('00000000-0000-4000-8000-000000013460', 'Dispute Probe');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000013460', 'mesita-3460-probe', 'active', 'generating', 'MXN');

-- A paid MX$100 card payment with MX$5 of cashback, Available an hour ago.
insert into public.wallet_payments (id, consumer_id, place_id, amount_cents, credit_cents, card_cents, tip_cents, currency, status,
                                    stripe_account_id, cashback_bps, cashback_cents, request_id, paid_at)
values ('00000000-0000-4000-8000-0000000b3460', '00000000-0000-4000-8000-0000000a3460', '00000000-0000-4000-8000-000000013460',
        10000, 0, 10000, 0, 'mxn', 'paid', 'acct_test_3460', 500, 500, '00000000-0000-4000-8000-00000000b460', now() - interval '2 hours');
insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
values ('00000000-0000-4000-8000-0000000a3460', '00000000-0000-4000-8000-000000013460', 'cashback', 500, 'mxn',
        '00000000-0000-4000-8000-0000000b3460', false, now() - interval '1 hour');

-- A paid MX$200 voucher purchase with its MX$20 bonus.
insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, application_fee_cents, stripe_checkout_session_id)
values ('00000000-0000-4000-8000-0000000c3460', '00000000-0000-4000-8000-0000000a3460',
        '00000000-0000-4000-8000-000000013460', 20000, 'mxn', 'open', 'acct_test_3460',
        'voucher_200', 2000, 1000, 'cs_test_3460');
do $$ begin
  perform wallet_credit_purchase('00000000-0000-4000-8000-0000000c3460', 'pi_test_3460', now() - interval '1 minute');
end $$;

-- ━━━ Shape and access ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select ok(
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname in ('wallet_refund_payment', 'wallet_refund_purchase') and p.pronargs <> 3),
  'only the three-argument refund RPCs exist'
);

select ok(
  not has_function_privilege('anon', 'public.wallet_refund_payment(uuid, integer, text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.wallet_refund_payment(uuid, integer, text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.wallet_refund_purchase(uuid, integer, text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.wallet_refund_purchase(uuid, integer, text)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.wallet_refund_payment(uuid, integer, text)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.wallet_refund_purchase(uuid, integer, text)', 'EXECUTE'),
  'the refund RPCs are service-role only'
);

select throws_ok(
  $$insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at, reason)
    values ('00000000-0000-4000-8000-0000000a3460', '00000000-0000-4000-8000-000000013460', 'cashback', 1, 'mxn',
            '00000000-0000-4000-8000-0000000b3460', false, now(), 'dispute_lost')$$,
  '23514',
  null,
  'only a reversal carries a reason'
);

-- ━━━ An unknown reason changes nothing ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  wallet_refund_payment('00000000-0000-4000-8000-0000000b3460', 10000, 'chargeback') ->> 'code',
  'bad_reason',
  'an unknown reason is refused'
);

select is(
  (select refunded_cents || ':' || status from public.wallet_payments where id = '00000000-0000-4000-8000-0000000b3460'),
  '0:paid',
  'and the payment is untouched'
);

-- ━━━ A lost dispute on the payment ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- A partial dispute of MX$40 first: 40% of the cashback (MX$2) back.
select is(
  wallet_refund_payment('00000000-0000-4000-8000-0000000b3460', 4000, 'dispute_lost') ->> 'reversed_cents',
  '200',
  'a lost partial dispute reverses its share of the cashback'
);

-- Then the place refunds the rest: the default reason is refund.
select is(
  wallet_refund_payment('00000000-0000-4000-8000-0000000b3460', 10000) ->> 'status',
  'refunded',
  'a refund after the lost dispute completes it and reads refunded'
);

select is(
  (select string_agg(reason || ':' || (-amount_cents)::text, ',' order by created_at, reason)
     from public.wallet_entries where payment_id = '00000000-0000-4000-8000-0000000b3460' and kind = 'reversal'),
  'dispute_lost:200,refund:300',
  'each reversal entry says why it was written'
);

-- ━━━ A lost dispute on the purchase ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  wallet_refund_purchase('00000000-0000-4000-8000-0000000c3460', 20000, 'dispute_lost') ->> 'status',
  'refunded',
  'a fully lost dispute on a voucher reads refunded'
);

select is(
  (select reason || ':' || (-amount_cents)::text from public.wallet_entries
    where purchase_id = '00000000-0000-4000-8000-0000000c3460' and kind = 'reversal'),
  'dispute_lost:22000',
  'and its reversal takes the voucher and the bonus back as dispute_lost'
);

select * from finish();

rollback;
