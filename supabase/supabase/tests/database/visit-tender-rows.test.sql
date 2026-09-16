-- A visit is settled by tender rows: record_visit_tenders (MESITA-1910).
--
-- A FOURTH money file, for the reason credits-settle-ticket-bill.test.sql
-- gives for being a third: a failure here must read as "the tender model is
-- wrong", never as "the ledger is wrong" or "the ticket-side apply is wrong".
--
-- WHY THESE CASES. Each is something the scalar `paid_method` could not say,
-- or something the arithmetic would get wrong if nobody pinned it:
--   · two tenders on one bill — the whole point, and unrepresentable before
--   · cash and card telling themselves apart, having both been `at_place`
--   · Credits covering the bill with ZERO tender rows, which is the case the
--     old model needed a `paid_method = 'credits'` sentinel for
--   · a ZERO bill with no credits, where that sentinel would be a lie
--   · a retry recording the money twice
--   · the sum not matching net due, which is the invariant itself

begin;
select plan(26);

-- ── Fixtures ────────────────────────────────────────────────────────────
insert into auth.users (id) values ('bbbbbbbb-0000-0000-0000-000000000001');
insert into public.consumers (id, code)
  values ('bbbbbbbb-0000-0000-0000-000000000001', '9999-0910');

-- `places.id` carries an FK to `place_profiles.id`, hence the order; `name` is
-- GENERATED from mesita_name/google_name and cannot be written directly.
insert into public.place_profiles (id, google_name)
  values ('bbbbbbbb-0000-0000-0000-000000000003', 'pgTAP tender place');
insert into public.places (id, slug)
  values ('bbbbbbbb-0000-0000-0000-000000000003', 'pgtap-tender-place');

-- T1 one tender · T2 two · T3 credits cover it all · T4 a zero bill ·
-- T5 never approved · T6 the refusal cases.
insert into public.visit_tickets (
  id, place_id, consumer_id, opened_by, state,
  approved_amount_due_cents, credits_applied_cents
) values
  ('bbbbbbbb-0000-0000-0000-00000000000a', 'bbbbbbbb-0000-0000-0000-000000000003',
   'bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
   'approved', 1000, 0),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000003',
   'bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
   'approved', 1000, 300),
  ('bbbbbbbb-0000-0000-0000-00000000000c', 'bbbbbbbb-0000-0000-0000-000000000003',
   'bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
   'approved', 1000, 1000),
  ('bbbbbbbb-0000-0000-0000-00000000000d', 'bbbbbbbb-0000-0000-0000-000000000003',
   'bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
   'approved', 0, 0),
  ('bbbbbbbb-0000-0000-0000-00000000000e', 'bbbbbbbb-0000-0000-0000-000000000003',
   'bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
   'open', null, 0),
  ('bbbbbbbb-0000-0000-0000-00000000000f', 'bbbbbbbb-0000-0000-0000-000000000003',
   'bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
   'approved', 500, 0);

-- ── Refusals ─────────────────────────────────────────────────────────────

select is(
  (public.record_visit_tenders('99999999-9999-9999-9999-999999999999', '[]'::jsonb))->>'code',
  'not_found',
  'a nonexistent ticket returns not_found');

select is(
  (public.record_visit_tenders('bbbbbbbb-0000-0000-0000-00000000000e', '[]'::jsonb))->>'code',
  'stale_state',
  'a ticket that was never approved cannot have tenders recorded against it');

select is(
  (public.record_visit_tenders('bbbbbbbb-0000-0000-0000-00000000000f', '"cash"'::jsonb))->>'code',
  'tenders_not_an_array',
  'a scalar where the tender array belongs is refused by name');

-- THE INVARIANT, stated as a refusal: 100 against a net due of 500.
select is(
  (public.record_visit_tenders('bbbbbbbb-0000-0000-0000-00000000000f',
    '[{"method":"cash","amount_cents":100}]'::jsonb))->>'code',
  'sum_mismatch',
  'tenders that do not sum to net amount due are refused');

select is(
  (public.record_visit_tenders('bbbbbbbb-0000-0000-0000-00000000000f',
    '[{"method":"credits","amount_cents":500}]'::jsonb))->>'code',
  'bad_method',
  'credits is NOT a tender — it is a bill reduction, and the RPC says so by name');

select is(
  (public.record_visit_tenders('bbbbbbbb-0000-0000-0000-00000000000f',
    '[{"method":"cash","amount_cents":0}]'::jsonb))->>'code',
  'bad_amount',
  'a zero-amount tender is not a tender');

-- ── One tender ───────────────────────────────────────────────────────────

select is(
  ((public.record_visit_tenders('bbbbbbbb-0000-0000-0000-00000000000a',
    '[{"method":"cash","amount_cents":1000}]'::jsonb))->>'ok')::boolean,
  true,
  'one cash tender covering the whole net due is recorded');

select is(
  (select paid_method from public.visit_tickets
    where id = 'bbbbbbbb-0000-0000-0000-00000000000a'),
  'cash',
  'one row derives paid_method to that row''s method — cash, which `at_place` could never say');

select is(
  (select count(*)::int from public.visit_ticket_payments
    where ticket_id = 'bbbbbbbb-0000-0000-0000-00000000000a'),
  1,
  'exactly one tender row was written');

-- Single-shot: a retry after a successful-but-timed-out response.
select is(
  ((public.record_visit_tenders('bbbbbbbb-0000-0000-0000-00000000000a',
    '[{"method":"card","amount_cents":1000}]'::jsonb))->>'idempotent')::boolean,
  true,
  'a retry reports itself idempotent rather than recording the money twice');

select is(
  (select count(*)::int from public.visit_ticket_payments
    where ticket_id = 'bbbbbbbb-0000-0000-0000-00000000000a'),
  1,
  'and the retry left the row count alone');

-- ── Two tenders: the case the scalar column could not hold ───────────────

select is(
  ((public.record_visit_tenders('bbbbbbbb-0000-0000-0000-00000000000b',
    '[{"method":"cash","amount_cents":400},{"method":"card","amount_cents":300}]'::jsonb))
   ->>'ok')::boolean,
  true,
  'cash AND card on one bill, over a 300-cent credits reduction, is recordable');

select is(
  (select paid_method from public.visit_tickets
    where id = 'bbbbbbbb-0000-0000-0000-00000000000b'),
  'split',
  'two rows derive paid_method to split');

select is(
  (select sum(amount_cents)::int from public.visit_ticket_payments
    where ticket_id = 'bbbbbbbb-0000-0000-0000-00000000000b'),
  700,
  'the rows sum to approved_amount_due_cents - credits_applied_cents, not to the bill');

-- ── Credits covering the whole bill: zero rows, and no sentinel needed ───

select is(
  ((public.record_visit_tenders('bbbbbbbb-0000-0000-0000-00000000000c', '[]'::jsonb))
   ->>'ok')::boolean,
  true,
  'a bill fully covered by Credits settles with ZERO tender rows');

select is(
  (select paid_method from public.visit_tickets
    where id = 'bbbbbbbb-0000-0000-0000-00000000000c'),
  'credits',
  'zero rows with credits applied still derives credits, for get_credit_spend_report');

-- ── A zero bill is not a credits bill ────────────────────────────────────

select is(
  ((public.record_visit_tenders('bbbbbbbb-0000-0000-0000-00000000000d', '[]'::jsonb))
   ->>'ok')::boolean,
  true,
  'a zero bill settles with zero tender rows too');

select is(
  (select paid_method from public.visit_tickets
    where id = 'bbbbbbbb-0000-0000-0000-00000000000d'),
  null,
  'a zero bill with no credits leaves paid_method NULL — nothing was taken and nothing reduced');

-- ── The lockdown ─────────────────────────────────────────────────────────

select ok(
  (select relrowsecurity from pg_class
    where oid = 'public.visit_ticket_payments'::regclass),
  'visit_ticket_payments has RLS enabled');

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'visit_ticket_payments'),
  0,
  'and ZERO policies — the EF-only lockdown its parent visit_tickets uses, where a policy would OPEN access');

select ok(
  not has_table_privilege('anon', 'public.visit_ticket_payments', 'SELECT')
  and not has_table_privilege('authenticated', 'public.visit_ticket_payments', 'SELECT'),
  'no client role can read the tender rows');

select ok(
  not has_function_privilege('authenticated',
    'public.record_visit_tenders(uuid,jsonb)', 'execute')
  and not has_function_privilege('anon',
    'public.record_visit_tenders(uuid,jsonb)', 'execute'),
  'record_visit_tenders is EF-only — SECURITY DEFINER without this revoke would let any caller record money');

-- ── The walls, bypassing the RPC ─────────────────────────────────────────
-- No savepoints: pgTAP's throws_ok runs its statement inside a PL/pgSQL
-- EXCEPTION block, which is its own implicit savepoint, so a caught violation
-- never reaches this transaction.

select throws_ok(
  $$insert into public.visit_ticket_payments (ticket_id, method, amount_cents, stripe_payment_intent_id)
     values ('bbbbbbbb-0000-0000-0000-00000000000f', 'cash', 100, 'pi_wrong_rail')$$,
  '23514'::char(5), null::text,
  'a cash row carrying a PaymentIntent is refused — no PSP ever saw that money');

select throws_ok(
  $$insert into public.visit_ticket_payments (ticket_id, method, amount_cents)
     values ('bbbbbbbb-0000-0000-0000-00000000000f', 'cash', 0)$$,
  '23514'::char(5), null::text,
  'the database refuses a zero-amount tender even when the RPC is bypassed');

select throws_ok(
  $$insert into public.visit_ticket_payments (ticket_id, method, amount_cents)
     values ('bbbbbbbb-0000-0000-0000-00000000000f', 'credits', 500)$$,
  '23514'::char(5), null::text,
  'and it refuses credits as a method at the wall, not only at the door');

-- The widened CHECK accepts the derived labels it now has to hold.
select lives_ok(
  $$update public.visit_tickets set paid_method = 'split'
     where id = 'bbbbbbbb-0000-0000-0000-00000000000f'$$,
  'visit_tickets.paid_method accepts the derived label split');

select * from finish();
rollback;
