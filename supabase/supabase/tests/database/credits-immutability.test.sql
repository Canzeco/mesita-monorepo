-- A lot can never change place (MESITA-2051).
--
-- Rule 1 of the cross-venue Credits model: Credits never move between
-- places, not even between two places of one owner. The trigger refuses a
-- place_id change; these tests prove it refuses THAT and nothing else, since
-- a trigger on credit_lots that also blocked a spend or a gift claim would
-- break the money paths while every shape test stayed green.

begin;
select plan(5);

-- Fixtures, the same minimal shapes credits.test.sql documents: an auth row
-- before its consumer, a place_profiles row before its places row.
insert into auth.users (id) values ('55555555-5555-5555-5555-555555555555');
insert into public.consumers (id, code)
values ('55555555-5555-5555-5555-555555555555', '9999-0002');

insert into public.place_profiles (id, google_name) values
  ('33333333-3333-3333-3333-333333333333', 'pgTAP immutability place A'),
  ('44444444-4444-4444-4444-444444444444', 'pgTAP immutability place B');
insert into public.places (id, slug) values
  ('33333333-3333-3333-3333-333333333333', 'pgtap-immutability-a'),
  ('44444444-4444-4444-4444-444444444444', 'pgtap-immutability-b');

select public.create_credit_lot(
  '33333333-3333-3333-3333-333333333333', '55555555-5555-5555-5555-555555555555',
  1000, 100, 'MXN', now() - interval '1 hour', now() + interval '90 days', 'pi_immutable');

select throws_ok(
  $$ update public.credit_lots
        set place_id = '44444444-4444-4444-4444-444444444444'
      where stripe_payment_intent_id = 'pi_immutable' $$,
  '23514',
  'credit_lots.place_id is immutable: a lot belongs to the place that sold it. To move value, refund the lot; the guest buys at the other place.',
  'a lot cannot be moved to another place');

select lives_ok(
  $$ select public.spend_credits('55555555-5555-5555-5555-555555555555',
       '33333333-3333-3333-3333-333333333333', 300, 't_immutable') $$,
  'a spend still writes spent_cents');

select lives_ok(
  $$ update public.credit_lots set consumer_id = null
      where stripe_payment_intent_id = 'pi_immutable' $$,
  'a gift-style owner change still writes consumer_id');

select lives_ok(
  $$ update public.credit_lots set place_id = place_id
      where stripe_payment_intent_id = 'pi_immutable' $$,
  'a no-op place_id write is not a move');

select is(
  (select place_id from public.credit_lots where stripe_payment_intent_id = 'pi_immutable'),
  '33333333-3333-3333-3333-333333333333'::uuid,
  'the lot still belongs to the place that sold it');

select * from finish();
rollback;
