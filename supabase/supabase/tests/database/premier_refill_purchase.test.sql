-- MESITA-3168 — Premier Refill purchase: the check before a sale refuses
-- what premier_add_days would; a paid purchase is granted its days exactly
-- once; a refusal at settle adds nothing and stays paid for the refund;
-- nobody but the EFs touches the table or the two functions.

begin;

create extension if not exists pgtap with schema public;

select plan(14);

insert into auth.users (id) values ('00000000-0000-4000-8000-0000000a3168');
insert into public.consumers (id) values ('00000000-0000-4000-8000-0000000a3168');
insert into public.place_profiles (id, google_name) values
  ('00000000-0000-4000-8000-000000316800', 'Pack Open'),
  ('00000000-0000-4000-8000-000000316801', 'Pack Archived'),
  ('00000000-0000-4000-8000-000000316802', 'Pack Disabled'),
  ('00000000-0000-4000-8000-000000316803', 'Pack Paid 5X');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000316800', 'mesita-316800-probe', 'active', 'ready', 'USD'),
  ('00000000-0000-4000-8000-000000316801', 'mesita-316801-probe', 'archived', 'ready', 'USD'),
  ('00000000-0000-4000-8000-000000316802', 'mesita-316802-probe', 'paused', 'ready', 'USD'),
  ('00000000-0000-4000-8000-000000316803', 'mesita-316803-probe', 'active', 'ready', 'USD');
insert into public.place_premier_periods (place_id, tier, billing_interval, starts_at, ends_at, status) values
  ('00000000-0000-4000-8000-000000316803', 2, 'month', now() - interval '1 day', now() + interval '29 days', 'paid');

insert into public.premier_refill_purchases (id, consumer_id, place_id, tier, days, amount_cents, stripe_checkout_session_id) values
  ('00000000-0000-4000-8000-0000000b3168', '00000000-0000-4000-8000-0000000a3168',
   '00000000-0000-4000-8000-000000316800', 2, 30, 15000, 'cs_test_3168_a'),
  ('00000000-0000-4000-8000-0000000c3168', '00000000-0000-4000-8000-0000000a3168',
   '00000000-0000-4000-8000-000000316803', 1, 30, 1500, 'cs_test_3168_b');

-- ━━━ EF-only ━━━
select ok(
  (select relrowsecurity from pg_class where oid = 'public.premier_refill_purchases'::regclass)
    and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'premier_refill_purchases')
    and not has_table_privilege('authenticated', 'public.premier_refill_purchases', 'SELECT')
    and not has_table_privilege('anon', 'public.premier_refill_purchases', 'SELECT')
    and not has_function_privilege('authenticated', 'public.premier_refill_check(uuid, smallint, integer)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.premier_refill_settle(uuid, text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.premier_refill_settle(uuid, text)', 'EXECUTE'),
  'purchases are EF-only; the check and the settle are service-role only'
);

-- ━━━ The check before a sale ━━━
select is(premier_refill_check('00000000-0000-4000-8000-000000316800', 2::smallint, 30) ->> 'result', 'ok',
  'an active place with nothing running sells a 5X pack');
select is(premier_refill_check('00000000-0000-4000-8000-000000316801', 1::smallint, 30) ->> 'code', 'archived',
  'an archived place is refused');
select is(premier_refill_check('00000000-0000-4000-8000-000000316802', 1::smallint, 30) ->> 'code', 'unlisted',
  'a Disabled place is refused unlisted');
select is(premier_refill_check('00000000-0000-4000-8000-000000316803', 1::smallint, 30) ->> 'code', 'paid_higher',
  'a 2X pack under a paid 5X is refused paid_higher');
select is(premier_refill_check('00000000-0000-4000-8000-0000000fffff', 1::smallint, 30) ->> 'code', 'not_found',
  'an unknown place is refused not_found');

-- ━━━ Settle: granted once ━━━
select is(premier_refill_settle('00000000-0000-4000-8000-0000000b3168', 'pi_test_3168_a') ->> 'outcome', 'granted',
  'a paid purchase is granted');
select ok(
  (select status = 'granted' and paid_at is not null and stripe_payment_intent_id = 'pi_test_3168_a'
          and ends_at = now() + interval '30 days'
     from public.premier_refill_purchases where id = '00000000-0000-4000-8000-0000000b3168'),
  'the purchase records the payment and the 5X end'
);
select ok(
  (select count(*) = 1 and min(source) = 'purchase' and min(tier) = 2
     from public.place_manual_premier
    where place_id = '00000000-0000-4000-8000-000000316800' and request_id = 'purchase:00000000-0000-4000-8000-0000000b3168'),
  'one purchase row of Refill days, keyed by the purchase'
);
select is((select boost_tier from public.places where id = '00000000-0000-4000-8000-000000316800'), 2::smallint,
  'the place is Premier 5X at once');
select is(premier_refill_settle('00000000-0000-4000-8000-0000000b3168', 'pi_test_3168_a') ->> 'replayed', 'true',
  'settling again answers granted, replayed');
select is((select count(*)::int from public.place_manual_premier where place_id = '00000000-0000-4000-8000-000000316800'), 1,
  'and adds nothing');

-- ━━━ Settle: refused stays paid for the refund ━━━
select is(premier_refill_settle('00000000-0000-4000-8000-0000000c3168', 'pi_test_3168_b') ->> 'code', 'paid_higher',
  'a pack the place can no longer take is refused at settle');
select ok(
  (select status = 'paid' and refusal_code = 'paid_higher' from public.premier_refill_purchases
    where id = '00000000-0000-4000-8000-0000000c3168')
    and not exists (select 1 from public.place_manual_premier where place_id = '00000000-0000-4000-8000-000000316803'),
  'it stays paid with its refusal and adds no days'
);

select * from finish();
rollback;
