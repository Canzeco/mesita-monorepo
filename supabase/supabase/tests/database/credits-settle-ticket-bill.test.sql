-- Credits settle a bill: apply_ticket_credits behaviour (MESITA-1678).
--
-- A THIRD credits file, on purpose (same reasoning credits.test.sql gives for
-- being a second file, not a growth of schema_invariants.test.sql): this one
-- needs a visit_tickets fixture that neither of the other two carries, and
-- mixing it in would make a failure here unreadable as either "the ledger
-- is wrong" or "the ticket-side apply is wrong".
--
-- WHY THESE CASES. Each one is a bug this feature's own review caught before
-- it shipped (see ~/.gstack/projects/Canzeco-mesita-monorepo/
-- pato-MESITA-1678-plan-20260909.md) — this file is what keeps each one from
-- coming back silently:
--   · a client retry double-spending real Credits (no idempotency key on
--     spend_credits)
--   · a NULL tip_cents silently zeroing the cap via Postgres NULL propagation
--   · the everyday case (Credits fully cover the bill) needing paid_method
--     'credits', which the CHECK constraint would otherwise reject
--   · the three Credits-moving RPCs never having their EXECUTE grant revoked

begin;
select plan(16);

-- ── Fixtures ────────────────────────────────────────────────────────────
insert into auth.users (id) values ('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.organizations (id, name)
  values ('aaaaaaaa-0000-0000-0000-000000000002', 'pgTAP settle-bill org');
insert into public.consumers (id, code)
  values ('aaaaaaaa-0000-0000-0000-000000000001', '9999-0003');
insert into public.place_profiles (id, google_name)
  values ('aaaaaaaa-0000-0000-0000-000000000003', 'pgTAP settle-bill place');
insert into public.places (id, slug)
  values ('aaaaaaaa-0000-0000-0000-000000000003', 'pgtap-settle-bill-place');

-- A lot: 900 principal + 100 bonus, matured, funding this org.
select public.create_credit_lot(
  'aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001',
  900, 100, 'MXN', now() - interval '1 hour', now() + interval '90 days', 'pi_settle_bill');

-- An approved ticket, amount due 1000, tip_cents left NULL on purpose — the
-- exact shape that would silently zero the cap without the coalesce fix.
insert into public.visit_tickets (
  id, place_id, consumer_id, opened_by, state, approved_amount_due_cents, tip_cents
) values (
  'aaaaaaaa-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000003',
  'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
  'approved', 1000, null
);

-- A second ticket, never approved, for the stale_state case.
insert into public.visit_tickets (id, place_id, consumer_id, opened_by, state)
values (
  'aaaaaaaa-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000003',
  'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'open'
);

-- ── Regression: NULL tip_cents must not zero the cap ───────────────────
select is(
  ((public.apply_ticket_credits('aaaaaaaa-0000-0000-0000-000000000004',
     'aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000002', 1100)
   )->>'cap')::int,
  1000,
  'a null tip_cents does not zero the cap (greatest(0, x - coalesce(tip,0)))');

-- ── Error paths ──────────────────────────────────────────────────────────
select is(
  ((public.apply_ticket_credits('99999999-9999-9999-9999-999999999999',
     'aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000002', 100)
   )->>'code'),
  'not_found',
  'a nonexistent ticket returns not_found');

select is(
  ((public.apply_ticket_credits('aaaaaaaa-0000-0000-0000-000000000004',
     '99999999-9999-9999-9999-999999999999','aaaaaaaa-0000-0000-0000-000000000002', 100)
   )->>'code'),
  'not_found',
  'the wrong consumer_id also returns not_found, never leaking whose ticket it is');

select is(
  ((public.apply_ticket_credits('aaaaaaaa-0000-0000-0000-000000000005',
     'aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000002', 100)
   )->>'code'),
  'stale_state',
  'a ticket that is not approved refuses with stale_state');

-- ── The happy path, and the single-shot idempotency it depends on ────────
select is(
  ((public.apply_ticket_credits('aaaaaaaa-0000-0000-0000-000000000004',
     'aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000002', 400)
   )->>'ok')::boolean,
  true,
  'an apply within the cap and the balance succeeds');

select is(
  (select credits_applied_cents from public.visit_tickets
    where id = 'aaaaaaaa-0000-0000-0000-000000000004'),
  400,
  'the ticket records the applied amount');

select is(
  (select spent_cents from public.credit_lots where stripe_payment_intent_id = 'pi_settle_bill'),
  400,
  'the lot is debited by exactly the applied amount');

select is(
  (select count(*)::int from public.credit_ledger le
     join public.credit_lots cl on cl.id = le.lot_id
    where cl.stripe_payment_intent_id = 'pi_settle_bill' and le.kind = 'spend'),
  1,
  'exactly one spend ledger entry exists after the first apply');

-- THE double-spend regression: a retry with the SAME amount must be a no-op.
select is(
  ((public.apply_ticket_credits('aaaaaaaa-0000-0000-0000-000000000004',
     'aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000002', 400)
   )->>'idempotent')::boolean,
  true,
  'a retry with the same amount is flagged idempotent, not a fresh spend');

-- THE double-spend regression, harder case: a retry with a DIFFERENT amount
-- must still be a no-op, returning the ORIGINAL applied amount — never the
-- new one, and never a second spend.
select is(
  ((public.apply_ticket_credits('aaaaaaaa-0000-0000-0000-000000000004',
     'aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000002', 999)
   )->>'creditsAppliedCents')::int,
  400,
  'a retry with a different amount returns the ORIGINAL applied amount, not the new one');

select is(
  (select spent_cents from public.credit_lots where stripe_payment_intent_id = 'pi_settle_bill'),
  400,
  'two retries after the first apply still leave the lot debited exactly once');

select is(
  (select count(*)::int from public.credit_ledger le
     join public.credit_lots cl on cl.id = le.lot_id
    where cl.stripe_payment_intent_id = 'pi_settle_bill' and le.kind = 'spend'),
  1,
  'still exactly one spend ledger entry after two retries — no double-spend');

-- ── Schema: paid_method accepts 'credits' (the $0-net close path) ────────
select lives_ok(
  $$ update public.visit_tickets set paid_method = 'credits'
      where id = 'aaaaaaaa-0000-0000-0000-000000000005' $$,
  'paid_method accepts credits (visit_tickets_paid_method_kind widened)');

-- ── Security: EXECUTE is locked down for every client role, on all three
-- Credits-moving RPCs — the hole this feature's review found in the two
-- that already existed (create_credit_lot, spend_credits) and closed here.
select ok(
  not has_function_privilege('authenticated',
    'public.apply_ticket_credits(uuid,uuid,uuid,integer)', 'execute')
  and not has_function_privilege('anon',
    'public.apply_ticket_credits(uuid,uuid,uuid,integer)', 'execute')
  and not has_function_privilege('authenticated',
    'public.spend_credits(uuid,uuid,integer,text)', 'execute')
  and not has_function_privilege('anon',
    'public.spend_credits(uuid,uuid,integer,text)', 'execute')
  and not has_function_privilege('authenticated',
    'public.create_credit_lot(uuid,uuid,integer,integer,text,timestamptz,timestamptz,text)', 'execute')
  and not has_function_privilege('anon',
    'public.create_credit_lot(uuid,uuid,integer,integer,text,timestamptz,timestamptz,text)', 'execute'),
  'no client role can execute apply_ticket_credits, spend_credits, or create_credit_lot directly');

-- ── §6 addendum: the spend-visibility report ─────────────────────────────
-- The one apply above (400 cents, at a ticket with no paid_method set yet)
-- should show up once, attributed to 'unknown' — the ticket's paid_method
-- is still null at this point in the test (consumer-web-select-ticket-payment
-- sets it later, in the real flow, not this RPC).
select is(
  (select spend_cents from public.get_credit_spend_report()
    where organization_id = 'aaaaaaaa-0000-0000-0000-000000000002'
      and paid_method = 'unknown'),
  400,
  'get_credit_spend_report attributes the spend to this organization, unknown rail (paid_method not yet set)');

select ok(
  not has_function_privilege('authenticated', 'public.get_credit_spend_report()', 'execute')
  and not has_function_privilege('anon', 'public.get_credit_spend_report()', 'execute'),
  'get_credit_spend_report is also EF-only, not client-executable');

select * from finish();
rollback;
