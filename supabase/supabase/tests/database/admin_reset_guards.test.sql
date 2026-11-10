-- MESITA-3590 — admin_reset_database() refuses while money is open or a
-- Stripe row is live, lists what blocks it, changes nothing when it refuses,
-- and after a wipe leaves no auth.flow_state row pointing at a missing user
-- and names the Stripe ids it left behind.
--
-- The last block RUNS the wipe. This file is one transaction that rolls back.

begin;

create extension if not exists pgtap with schema public;

select plan(17);

insert into public.super_admins (email)
  select 'reset-guard-probe@mesita.test'
   where not exists (select 1 from public.super_admins);

insert into public.place_profiles (id, google_name) values ('00000000-0000-4000-8000-000000013590', 'Reset Guard Probe');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000013590', 'mesita-3590-probe', 'active', 'generating', 'MXN');

-- ━━━ open money refuses ━━━

insert into public.place_fee_invoices (id, place_id, livemode, currency, amount_cents, status)
  values ('00000000-0000-4000-8000-0000000f3590', '00000000-0000-4000-8000-000000013590', false, 'usd', 500, 'open');
-- A tab past its expiry is dead (tabs expire lazily) and must not block.
insert into public.pay_tabs (id, place_id, token_hash, currency, expires_at, status)
  values ('00000000-0000-4000-8000-0000000a3590', '00000000-0000-4000-8000-000000013590', repeat('a', 64), 'mxn', now() - interval '1 minute', 'waiting_bill');

create temp table r1 as select public.admin_reset_database() as r;

select is((select r->>'ok' from r1), 'false', 'an open fee invoice refuses the reset');
select ok((select r->'refused' from r1) ? 'open_money', 'the refusal names open_money');
select ok(
  not (select r->'open_money' from r1) @> '[{"table": "pay_tabs", "id": "00000000-0000-4000-8000-0000000a3590"}]'::jsonb,
  'a past-expiry waiting_bill tab is not open money'
);
select ok(
  (select r->'open_money' from r1)
    @> '[{"table": "place_fee_invoices", "id": "00000000-0000-4000-8000-0000000f3590", "status": "open"}]'::jsonb,
  'the refusal lists the open row by table, id and status'
);
select ok(
  exists (select 1 from public.places where id = '00000000-0000-4000-8000-000000013590'),
  'a refused reset wipes nothing'
);

-- An open tab (before its expiry) blocks too.
update public.place_fee_invoices set status = 'paid', paid_at = now() where id = '00000000-0000-4000-8000-0000000f3590';
insert into public.pay_tabs (id, place_id, token_hash, currency, expires_at, status)
  values ('00000000-0000-4000-8000-0000000b3590', '00000000-0000-4000-8000-000000013590', repeat('b', 64), 'mxn', now() + interval '10 minutes', 'waiting_bill');
select ok(
  public.admin_reset_database()->'open_money' @> '[{"table": "pay_tabs", "id": "00000000-0000-4000-8000-0000000b3590"}]'::jsonb,
  'an open tab refuses the reset'
);
delete from public.pay_tabs where id = '00000000-0000-4000-8000-0000000b3590';

-- A pending refund attempt is a Stripe refund in flight.
insert into public.wallet_purchases (id, place_id, amount_cents, currency, stripe_account_id, status)
  values ('00000000-0000-4000-8000-000000103590', '00000000-0000-4000-8000-000000013590', 10000, 'mxn', 'acct_test3590', 'failed');
insert into public.wallet_refund_attempts (id, purchase_id, amount_cents, status)
  values ('00000000-0000-4000-8000-000000113590', '00000000-0000-4000-8000-000000103590', 100, 'pending');
select ok(
  public.admin_reset_database()->'open_money' @> '[{"table": "wallet_refund_attempts", "id": "00000000-0000-4000-8000-000000113590", "status": "pending"}]'::jsonb,
  'a pending refund attempt refuses the reset'
);
update public.wallet_refund_attempts set status = 'failed' where id = '00000000-0000-4000-8000-000000113590';

-- A ready pledge with a change-plan Checkout in flight blocks too.
insert into public.place_backings (id, place_id, tier, billing_interval, amount_cents, status, stripe_checkout_session_id, checkout_kind)
  values ('00000000-0000-4000-8000-000000123590', '00000000-0000-4000-8000-000000013590', 'boost_2x', 'month', 500, 'ready', 'cs_test3590', 'change');
select ok(
  public.admin_reset_database()->'open_money' @> '[{"table": "place_backings", "id": "00000000-0000-4000-8000-000000123590", "status": "ready:change"}]'::jsonb,
  'a ready pledge with a Checkout in flight refuses the reset'
);
update public.place_backings set stripe_checkout_session_id = null, checkout_kind = null
 where id = '00000000-0000-4000-8000-000000123590';

-- ━━━ a live row in any livemode table refuses ━━━

update public.place_fee_invoices set livemode = true where id = '00000000-0000-4000-8000-0000000f3590';
select ok(
  public.admin_reset_database()->'livemode_rows' @> '[{"table": "place_fee_invoices", "id": "00000000-0000-4000-8000-0000000f3590"}]'::jsonb,
  'a live fee invoice refuses the reset'
);
update public.place_fee_invoices set livemode = false where id = '00000000-0000-4000-8000-0000000f3590';

-- ━━━ a live Stripe row refuses ━━━

insert into auth.users (id) values ('00000000-0000-4000-8000-0000000c3590');
insert into public.consumers (id) values ('00000000-0000-4000-8000-0000000c3590');
insert into public.premier_customers (consumer_id, livemode, stripe_customer)
  values ('00000000-0000-4000-8000-0000000c3590', true, 'cus_live3590');

create temp table r2 as select public.admin_reset_database() as r;

select ok((select r->'refused' from r2) ? 'livemode', 'a livemode customer refuses the reset');
select ok(
  (select r->'livemode_rows' from r2) @> '[{"table": "premier_customers", "id": "cus_live3590"}]'::jsonb,
  'the refusal lists the live Stripe id'
);

-- ━━━ the wipe: flow_state orphans go, Stripe ids come back ━━━

update public.premier_customers set livemode = false, stripe_customer = 'cus_test3590'
 where consumer_id = '00000000-0000-4000-8000-0000000c3590';
insert into public.place_payment_accounts (place_id, stripe_account_id, livemode)
  values ('00000000-0000-4000-8000-000000013590', 'acct_test3590', false);
insert into auth.flow_state (id, user_id, provider_type, authentication_method)
  values ('00000000-0000-4000-8000-0000000d3590', '00000000-0000-4000-8000-0000000e3590', 'google', 'oauth'),
         ('00000000-0000-4000-8000-0000000d3591', null, 'google', 'oauth');

create temp table r3 as select public.admin_reset_database() as r;

select is((select r->>'ok' from r3), 'true', 'with nothing open and nothing live the reset runs');
select ok(
  not exists (select 1 from public.places where id = '00000000-0000-4000-8000-000000013590'),
  'the reset wiped the probe place'
);
select is_empty(
  $$select 1 from auth.flow_state f
     where f.user_id is null
        or not exists (select 1 from auth.users u where u.id = f.user_id)$$,
  'no auth.flow_state row points at a missing user after the reset'
);
select cmp_ok((select (r->>'deleted_flow_states')::int from r3), '>=', 2, 'the reset counts the flow_state rows it deleted');
select ok(
  (select r->'stripe_left_behind'->'connected_accounts' from r3) ? 'acct_test3590',
  'the reset returns the connected account it left in Stripe'
);
select ok(
  (select r->'stripe_left_behind'->'customers' from r3) ? 'cus_test3590',
  'the reset returns the customer it left in Stripe'
);

select * from finish();

rollback;
