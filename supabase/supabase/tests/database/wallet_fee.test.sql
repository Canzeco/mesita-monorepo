-- MESITA-3461 — fee billing. A refunded or lost-dispute part owes no fee;
-- place_fee_claim bills what is owed once, net of refunds, and nets a late
-- refund on the next one; rows from before the charge model changed are
-- never billed; an overdue invoice sets fee_hold and paying it clears
-- fee_hold only: the owner's own Mesita Pay switch stays off.

begin;

create extension if not exists pgtap with schema public;

select plan(14);

insert into auth.users (id) values ('00000000-0000-4000-8000-0000000a3461');
insert into public.consumers (id) values ('00000000-0000-4000-8000-0000000a3461');
insert into public.place_profiles (id, google_name) values
  ('00000000-0000-4000-8000-000000013461', 'Fee Probe');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000013461', 'mesita-3461-probe', 'active', 'generating', 'MXN');
insert into public.place_payment_accounts (place_id, stripe_account_id, livemode, charges_enabled)
values ('00000000-0000-4000-8000-000000013461', 'acct_test_3461', false, true);
-- The owner turned Mesita Pay off themselves.
insert into public.place_payment_settings (place_id, pay_cards)
values ('00000000-0000-4000-8000-000000013461', false);

-- Four paid card payments, eight days ago: A (MX$100), B (MX$200, refunded
-- in full below), C (MX$100, half lost to a dispute below), D (from before
-- the charge model: Stripe's application fee took its fee).
insert into public.wallet_payments (id, consumer_id, place_id, amount_cents, credit_cents, card_cents, tip_cents, currency, status,
                                    stripe_account_id, cashback_bps, cashback_cents, application_fee_cents, request_id, paid_at, fee_collected)
values
  ('00000000-0000-4000-8000-0000000b3461', '00000000-0000-4000-8000-0000000a3461', '00000000-0000-4000-8000-000000013461',
   10000, 0, 10000, 0, 'mxn', 'paid', 'acct_test_3461', 0, 0, 500, '00000000-0000-4000-8000-00000000b461', now() - interval '8 days', 'invoice'),
  ('00000000-0000-4000-8000-0000000b3462', '00000000-0000-4000-8000-0000000a3461', '00000000-0000-4000-8000-000000013461',
   20000, 0, 20000, 0, 'mxn', 'paid', 'acct_test_3461', 0, 0, 1000, '00000000-0000-4000-8000-00000000b462', now() - interval '8 days', 'invoice'),
  ('00000000-0000-4000-8000-0000000b3463', '00000000-0000-4000-8000-0000000a3461', '00000000-0000-4000-8000-000000013461',
   10000, 0, 10000, 0, 'mxn', 'paid', 'acct_test_3461', 0, 0, 500, '00000000-0000-4000-8000-00000000b463', now() - interval '8 days', 'invoice'),
  ('00000000-0000-4000-8000-0000000b3464', '00000000-0000-4000-8000-0000000a3461', '00000000-0000-4000-8000-000000013461',
   10000, 0, 10000, 0, 'mxn', 'paid', 'acct_test_3461', 0, 0, 500, '00000000-0000-4000-8000-00000000b464', now() - interval '8 days', 'application_fee');

-- ━━━ No fee on a refunded or lost-dispute part ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  (wallet_refund_payment('00000000-0000-4000-8000-0000000b3462', 20000) ->> 'fee_refunded_cents')::int,
  1000,
  'a full refund takes back all of the fee'
);

select is(
  (wallet_refund_payment('00000000-0000-4000-8000-0000000b3463', 5000, 'dispute_lost') ->> 'fee_refunded_cents')::int,
  250,
  'a lost dispute of half the card part takes back half the fee'
);

select ok(
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'wallet_note_fee_refund'),
  'wallet_note_fee_refund is gone'
);

-- ━━━ The claim ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  place_fee_claim('00000000-0000-4000-8000-000000013461', false, 'mxn', 100, 50000, interval '30 days') ->> 'outcome',
  'not_due',
  'under the threshold and younger than the period: not due'
);

select is(
  (place_fee_claim('00000000-0000-4000-8000-000000013461', false, 'mxn', 100, 50000, interval '7 days') ->> 'amount_cents')::int,
  750,
  'a week old: bills A''s MX$5 and C''s MX$2.50; nothing for B, nothing for the legacy D'
);

select is(
  (select count(*)::int from public.place_fee_lines l join public.place_fee_invoices i on i.id = l.invoice_id
    where i.place_id = '00000000-0000-4000-8000-000000013461'),
  2,
  'one line per row that owed'
);

select is(
  place_fee_claim('00000000-0000-4000-8000-000000013461', false, 'mxn', 100, 50000, interval '7 days') ->> 'outcome',
  'draft',
  'the unsent draft is answered again, never a second claim'
);

update public.place_fee_invoices set status = 'open', stripe_invoice_id = 'in_test_3461', due_at = now() - interval '1 day'
 where place_id = '00000000-0000-4000-8000-000000013461';

-- A refunds after it was billed: a credit on the next claim.
do $$ begin perform wallet_refund_payment('00000000-0000-4000-8000-0000000b3461', 10000); end $$;

select is(
  place_fee_claim('00000000-0000-4000-8000-000000013461', false, 'mxn', 100, 50000, interval '7 days') ->> 'owed_cents',
  '-500',
  'a refund after billing nets as a credit, nothing billed twice'
);

-- ━━━ The hold ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  (place_fee_invoice_set((select id from public.place_fee_invoices where stripe_invoice_id = 'in_test_3461'), 'open') ->> 'fee_hold')::boolean,
  true,
  'an open invoice past due holds cards off'
);

select is(
  (select fee_hold from public.place_payment_accounts where place_id = '00000000-0000-4000-8000-000000013461'),
  true,
  'and the account row says so'
);

select is(
  (place_fee_invoice_set((select id from public.place_fee_invoices where stripe_invoice_id = 'in_test_3461'), 'paid') ->> 'fee_hold')::boolean,
  false,
  'paying it clears the hold'
);

select is(
  (select pay_cards from public.place_payment_settings where place_id = '00000000-0000-4000-8000-000000013461'),
  false,
  'the owner''s own cards-off survives paying the invoice'
);

select is(
  place_fee_invoice_set((select id from public.place_fee_invoices where stripe_invoice_id = 'in_test_3461'), 'open') ->> 'status',
  'paid',
  'a stale read never reopens a paid invoice'
);

select ok(
  not has_function_privilege('authenticated', 'public.place_fee_claim(uuid, boolean, text, integer, integer, interval)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.place_fee_invoice_set(uuid, text, text, text, text, timestamptz, timestamptz, text)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.place_fee_claim(uuid, boolean, text, integer, integer, interval)', 'EXECUTE'),
  'the fee RPCs are service-role only'
);

select * from finish();
rollback;
