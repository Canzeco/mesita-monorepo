-- A visit is settled by tender ROWS, not one word (MESITA-1910).
--
-- Pato, 2026-09-16: "visits can be paid with multiple amounts (like credits
-- and cash and extrnal card and blabalbala)", naming the four: Cash, Card
-- (the venue's own terminal), Mesita Payments, Mesita Credits.
--
-- `visit_tickets.paid_method` is ONE text value, so it cannot carry two
-- amounts — and two of those four collapse onto the same value, because Cash
-- and Card both store as `at_place` (Docs › Checkout §0: "Cash and Card need
-- no capability"). A screen showing them as separate chips is inventing a
-- distinction the database cannot make.
--
-- ── WHAT IS AND IS NOT A TENDER ───────────────────────────────────────────
--
-- CREDITS IS NOT ONE, and putting it in this table would break the law that
-- 20260831121954_credits_rename.sql froze: Credits settle as a bill REDUCTION,
-- never a payment method, on (subtotal - discount), never the tip. It would
-- also make the sum below meaningless — a reduction and a settlement cannot
-- be added together. `credits_applied_cents` stays exactly where it is.
--
-- `at_place` IS NOT ONE EITHER. That value exists only because a scalar
-- column could not tell cash from card. Rows can, so it does not come along;
-- it stays a legal `paid_method` for every ticket written before this
-- migration, and for the rail a guest SELECTS before paying.
--
-- THE KEY IS `mesita_pay`, THE NOUN IS "Mesita Online Payments". Docs ›
-- Checkout §0 is explicit that Mesita Pay is the name of the whole package
-- and "is never a tender". The stored key still matches the spelling
-- `paid_method`, `select-ticket-payment-method.ts` and the Stripe webhook
-- already use, for the same reason `lib/product-keys.ts` kept `pay` when the
-- label became Payments: a persisted spelling is not worth a migration to
-- align with a word on a screen.
--
-- ── THE INVARIANT, AND WHERE IT IS ENFORCED ───────────────────────────────
--
-- `apply_ticket_credits` already returns the number this has to hit, and
-- already calls it `netAmountDueCents`:
--
--     sum(tender rows) = approved_amount_due_cents - credits_applied_cents
--
-- It is enforced in `record_visit_tenders` below, NOT as a table constraint
-- and NOT as a trigger on the ticket's close. A guest mid-way through handing
-- over the second tender is a legitimate state where the rows do not sum yet,
-- and a trigger at close would reject every close the three EFs that already
-- own it perform today (validate-web-mark-paid, business-web-mark-ticket-paid,
-- consumer-web-select-ticket-payment) — none of which records a tender.
-- Migrating those four call sites onto this RPC is MESITA-1913.
--
-- CREDITS COVERING THE WHOLE BILL NEEDS NO SPECIAL CASE. netAmountDue is 0,
-- there are zero rows, and zero rows sum to zero. Today that case needs
-- `paid_method = 'credits'` as a sentinel (MESITA-1678 widened the CHECK for
-- exactly it); here it falls out of the arithmetic.
--
-- WIPED BY `admin_reset_database` ON PURPOSE. It discovers every public base
-- table at run time and truncates all but `admin_reset_preserve`. This is
-- transactional data and belongs in the truncate, so there is no registry
-- insert here — the absence is the decision, not an oversight.

-- ── The table ─────────────────────────────────────────────────────────────

create table if not exists public.visit_ticket_payments (
  id            uuid primary key default gen_random_uuid(),
  ticket_id     uuid not null references public.visit_tickets(id) on delete cascade,
  method        text not null,
  amount_cents  integer not null,
  -- A `mesita_pay` row carries the PaymentIntent it settled through; cash and
  -- card rows never do, because no PSP saw them.
  stripe_payment_intent_id text,
  created_at    timestamptz not null default now(),
  constraint visit_ticket_payments_method_kind
    check (method in ('cash', 'card', 'mesita_pay')),
  constraint visit_ticket_payments_amount_positive
    check (amount_cents > 0),
  -- The comment above, made a wall. A cash row carrying a PaymentIntent means
  -- somebody mapped the wrong tender onto the wrong rail.
  constraint visit_ticket_payments_intent_only_on_mesita_pay
    check (stripe_payment_intent_id is null or method = 'mesita_pay')
);

create index if not exists visit_ticket_payments_ticket_idx
  on public.visit_ticket_payments (ticket_id);

comment on table public.visit_ticket_payments is
  'One row per tender that settled a visit. Cash and Card are the place''s own money (the `at_place` rail, finally told apart); mesita_pay is a Stripe direct charge on the place''s connected account. Credits is NEVER here — it is a bill REDUCTION on visit_tickets.credits_applied_cents. On a settled ticket the rows sum to approved_amount_due_cents - credits_applied_cents. MESITA-1910.';

comment on column public.visit_ticket_payments.method is
  'cash | card | mesita_pay. Cash and Card both stored as paid_method `at_place` before this table, which is why no screen could tell them apart. The noun for `mesita_pay` is "Mesita Online Payments" (Docs › Checkout §0); the key keeps the persisted spelling.';

comment on column public.visit_ticket_payments.amount_cents is
  'Always > 0. A zero-amount tender is not a tender.';

-- EF-ONLY, exactly like its parent. `visit_tickets` is rls_enabled with ZERO
-- policies — the deliberate lockdown supabase/CLAUDE.md names, where adding a
-- policy OPENS access rather than closing it. A child of an EF-only table that
-- carried policies would be a wider door onto the same money.
alter table public.visit_ticket_payments enable row level security;

revoke all on public.visit_ticket_payments from public, anon, authenticated;
grant select, insert on public.visit_ticket_payments to service_role;

-- ── paid_method becomes DERIVED, and gains three labels ───────────────────
--
-- It survives because `get_credit_spend_report()` groups by it. The RPC is
-- its only writer from here: zero rows + credits -> 'credits', one row -> that
-- method, two or more -> 'split'. The spend report gains a `split` bucket.
--
-- Widening a CHECK, never narrowing — the same pattern
-- 20260906231502_organization_guest_customers.sql and
-- 20260909234346_credits_settle_ticket_bill.sql both used on this constraint.
-- `at_place` and the retired `mesita` stay legal: rows written before this
-- migration keep their value, and the rail a guest SELECTS is still at_place.
alter table public.visit_tickets drop constraint if exists visit_tickets_paid_method_kind;
alter table public.visit_tickets
  add constraint visit_tickets_paid_method_kind
  check (paid_method is null or paid_method in
    ('at_place', 'mesita', 'mesita_pay', 'credits', 'cash', 'card', 'split'));

comment on column public.visit_tickets.paid_method is
  'DERIVED from visit_ticket_payments by record_visit_tenders, never hand-set: zero rows with credits applied -> credits, one row -> that row''s method, two or more -> split. `at_place` and `mesita` are historical, and `at_place` is still the rail a guest selects before paying (consumer-web-select-ticket-payment). validateTicketPatch deliberately excludes the derived labels from what an EF may patch, exactly as it already excludes credits. MESITA-1910.';

-- ── record_visit_tenders: the one writer ──────────────────────────────────

create or replace function public.record_visit_tenders(
  p_ticket_id uuid,
  p_tenders jsonb
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ticket record;
  v_net integer;
  v_sum integer;
  v_count integer;
  v_existing integer;
  v_method text;
  v_amount integer;
  v_derived text;
begin
  select id, state, approved_amount_due_cents, credits_applied_cents
    into v_ticket
    from public.visit_tickets
   where id = p_ticket_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  -- SINGLE-SHOT AND IDEMPOTENT, the shape apply_ticket_credits established: a
  -- retry after a successful-but-timed-out response must not double-record
  -- money. "Already recorded" is a terminal, reportable state, not a race.
  select count(*) into v_existing
    from public.visit_ticket_payments where ticket_id = p_ticket_id;
  if v_existing > 0 then
    return jsonb_build_object(
      'ok', true, 'idempotent', true,
      'tenderCount', v_existing,
      'paidMethod', (select paid_method from public.visit_tickets where id = p_ticket_id)
    );
  end if;

  -- The settle window. `revealed` is allowed because the three EFs that close
  -- a ticket today do it in one write, so a caller recording tenders at the
  -- moment of close arrives here with the ticket already closed.
  if v_ticket.state not in ('approved', 'paying', 'revealed') then
    return jsonb_build_object('ok', false, 'code', 'stale_state', 'state', v_ticket.state);
  end if;

  if jsonb_typeof(p_tenders) <> 'array' then
    return jsonb_build_object('ok', false, 'code', 'tenders_not_an_array');
  end if;

  -- coalesce is load-bearing for the same reason it is in apply_ticket_credits:
  -- approved_amount_due_cents is nullable, and NULL - 0 is NULL, which would
  -- make every comparison below vacuously false instead of refusing.
  v_net := coalesce(v_ticket.approved_amount_due_cents, 0)
         - coalesce(v_ticket.credits_applied_cents, 0);

  if v_net < 0 then
    return jsonb_build_object('ok', false, 'code', 'net_due_negative', 'netAmountDueCents', v_net);
  end if;

  -- Validate every row BEFORE inserting any, so a bad third tender cannot
  -- leave the first two recorded. The table's own CHECKs would catch both of
  -- these, but as a 23514 the caller cannot tell apart from any other write
  -- failure; a named code says WHICH tender was wrong.
  for v_method, v_amount in
    select t->>'method', (t->>'amount_cents')::int
      from jsonb_array_elements(p_tenders) as t
  loop
    if v_method is null or v_method not in ('cash', 'card', 'mesita_pay') then
      return jsonb_build_object('ok', false, 'code', 'bad_method', 'method', v_method);
    end if;
    if v_amount is null or v_amount <= 0 then
      return jsonb_build_object('ok', false, 'code', 'bad_amount', 'method', v_method);
    end if;
  end loop;

  select coalesce(sum((t->>'amount_cents')::int), 0), count(*)
    into v_sum, v_count
    from jsonb_array_elements(p_tenders) as t;

  -- THE INVARIANT.
  if v_sum <> v_net then
    return jsonb_build_object(
      'ok', false, 'code', 'sum_mismatch',
      'sumCents', v_sum, 'netAmountDueCents', v_net);
  end if;

  insert into public.visit_ticket_payments (ticket_id, method, amount_cents, stripe_payment_intent_id)
  select p_ticket_id, t->>'method', (t->>'amount_cents')::int, t->>'stripe_payment_intent_id'
    from jsonb_array_elements(p_tenders) as t;

  -- The derivation. Zero rows with no credits is a zero bill: nothing was
  -- taken and nothing was reduced, so `credits` would be a lie and NULL is
  -- the honest answer.
  if v_count = 0 then
    v_derived := case when coalesce(v_ticket.credits_applied_cents, 0) > 0 then 'credits' else null end;
  elsif v_count = 1 then
    select method into v_derived from public.visit_ticket_payments where ticket_id = p_ticket_id;
  else
    v_derived := 'split';
  end if;

  update public.visit_tickets
     set paid_method = v_derived
   where id = p_ticket_id;

  return jsonb_build_object(
    'ok', true,
    'tenderCount', v_count,
    'sumCents', v_sum,
    'netAmountDueCents', v_net,
    'paidMethod', v_derived);
end;
$$;

comment on function public.record_visit_tenders is
  'Records the tenders that settled a visit, atomically, and derives visit_tickets.paid_method from them. Single-shot and idempotent on "no rows yet" — a retry after recording returns the original result rather than double-recording. Refuses unless the rows sum to approved_amount_due_cents - credits_applied_cents. MESITA-1910.';

-- EF-only, the same posture as the three Credits-moving RPCs: no client role
-- may move money, and SECURITY DEFINER without this revoke would let any
-- authenticated caller record arbitrary tenders against any ticket.
revoke execute on function public.record_visit_tenders(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_visit_tenders(uuid, jsonb)
  to service_role;
