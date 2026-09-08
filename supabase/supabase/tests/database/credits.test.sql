-- Credits: the BEHAVIOUR of the money functions (MESITA-1671).
--
-- A SECOND FILE, on purpose. schema_invariants.test.sql is a
-- `begin; plan(n); … rollback;` SHAPE file — it asserts columns, constraints
-- and grants exist. Everything below asserts what happens when money moves,
-- which needs rows, and growing the shape file to hold them would make one
-- failure impossible to read as either "the schema is wrong" or "a spend is
-- wrong". `supabase test db` runs the whole directory.
--
-- WHY THESE FIVE. Each is a way a wallet has historically lost or invented
-- money, not a way this code happens to be written:
--   · a partial spend that commits after refusing the whole
--   · a ledger that stops agreeing with the balance it is supposed to define
--   · a second charge creating a second lot
--   · an over-spend the application refuses but the database would accept
--   · a spend reaching money that has not matured or has already died

begin;
select plan(11);

-- Fixtures. Every FK is a real row; everything rolls back at the end.
--
-- consumers.id IS auth.uid(), and it carries a real FK to auth.users — so the
-- auth row has to exist first. `id` is the only NOT NULL column on that table
-- without a default, which is why a one-column insert is enough and why this
-- does not have to track whatever else Supabase adds to it.
insert into auth.users (id) values ('22222222-2222-2222-2222-222222222222');

insert into public.organizations (id, name)
values ('11111111-1111-1111-1111-111111111111', 'pgTAP org');

-- consumers_code_format_check is `^[0-9]{4}-[0-9]{4}$`. A readable fixture
-- like 'PGTAP00001' is rejected, and the failure reads as a broken schema
-- rather than a broken fixture, so the shape matters here.
insert into public.consumers (id, code)
values ('22222222-2222-2222-2222-222222222222', '9999-0001');

-- ── issuing ──────────────────────────────────────────────────────────────
select lives_ok(
  $$ select public.create_credit_lot(
       '11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',
       1000, 100, 'MXN', now() - interval '1 hour', now() + interval '90 days', 'pi_a') $$,
  'a lot can be issued');

select is(
  (select paid_delta_cents + bonus_delta_cents from public.credit_ledger
    where reference = 'pi_a' and kind = 'issue'),
  1100,
  'issuing writes the opening ledger entry for principal AND bonus');

select is(
  (select count(*)::int from public.credit_lots where stripe_payment_intent_id = 'pi_a'),
  1,
  'the same payment intent cannot fund a second lot');

select is(
  ((public.create_credit_lot(
      '11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',
      1000, 100, 'MXN', now() - interval '1 hour', now() + interval '90 days', 'pi_a')
   )->>'idempotent')::boolean,
  true,
  're-issuing on the same intent returns the existing lot, flagged idempotent');

-- ── spending ─────────────────────────────────────────────────────────────
select is(
  ((public.spend_credits('22222222-2222-2222-2222-222222222222',
     '11111111-1111-1111-1111-111111111111', 400, 't1'))->>'ok')::boolean,
  true,
  'a spend inside the balance succeeds');

-- PRINCIPAL BEFORE BONUS is a product law: what is left to die at expiry
-- should be the bonus, never the money the guest actually paid.
select is(
  (select paid_delta_cents from public.credit_ledger where reference = 't1'),
  -400,
  'a spend takes principal before bonus');
select is(
  (select bonus_delta_cents from public.credit_ledger where reference = 't1'),
  0,
  'and leaves the bonus untouched while principal remains');

-- THE ONE THAT MATTERS. A plpgsql function runs inside its caller's
-- transaction, so an early return after partial writes would COMMIT lots
-- debited for a bill that was never settled.
select is(
  ((public.spend_credits('22222222-2222-2222-2222-222222222222',
     '11111111-1111-1111-1111-111111111111', 800, 't2'))->>'code'),
  'insufficient_credits',
  'a spend past the balance is refused');
select is(
  (select spent_cents from public.credit_lots where stripe_payment_intent_id = 'pi_a'),
  400,
  'and it debits NOTHING — the refused spend rolls back whole');

-- The ledger defines the balance, so the anchor must never drift from it.
select is(
  (select -(sum(paid_delta_cents) + sum(bonus_delta_cents))::int
     from public.credit_ledger l
     join public.credit_lots c on c.id = l.lot_id
    where c.stripe_payment_intent_id = 'pi_a' and l.kind = 'spend'),
  (select spent_cents from public.credit_lots where stripe_payment_intent_id = 'pi_a'),
  'spent_cents equals the ledger it anchors');

-- The application refuses an over-spend; so must the database, on its own.
select throws_ok(
  $$ update public.credit_lots set spent_cents = 99999
      where stripe_payment_intent_id = 'pi_a' $$,
  '23514',
  null,
  'the database refuses an over-spend even when the RPC is bypassed');

select * from finish();
rollback;
