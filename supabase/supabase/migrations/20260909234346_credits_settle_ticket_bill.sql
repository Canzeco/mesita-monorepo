-- Credits settle a bill (MESITA-1678, Pato gate 2026-09-09: restaurant absorbs
-- the bonus gap, no obligor debt recorded). Reviewed via /autoplan — see
-- ~/.gstack/projects/Canzeco-mesita-monorepo/pato-MESITA-1678-plan-20260909.md
-- for the full CEO + Eng review that shaped this.
--
-- Credits settle as a REDUCTION on (subtotal - discount), never the tip
-- (business-ticket-billing.ts:amountDueCents, C4-8). `credits_applied_cents`
-- is additive, never a mutation of `approved_amount_due_cents` — "Approval
-- freezes the amount."
--
-- SINGLE-SHOT, NOT INCREMENTAL. spend_credits carries no idempotency key
-- (credit_ledger.reference is free text, no unique constraint — unlike
-- create_credit_lot's stripe_payment_intent_id). A client retry on an
-- incremental apply would double-debit real Credits. apply_ticket_credits
-- below is single-shot per ticket: credits_applied_cents is either 0 (never
-- applied) or a final value (applied once), so a retry after a
-- successful-but-unconfirmed call is a no-op idempotent success, not a
-- second spend.
--
-- EXECUTE WAS NEVER LOCKED DOWN ON THE EXISTING CREDITS RPCS. Postgres grants
-- EXECUTE to PUBLIC by default on function creation;
-- 20260807170433_alter_default_privileges_no_client.sql only revokes default
-- privileges on tables/sequences, never functions. spend_credits and
-- create_credit_lot (20260908101212_credit_lots_and_ledger.sql) have carried
-- no execute revoke since they shipped — any authenticated (likely anon too)
-- client could call spend_credits directly with an arbitrary consumer_id /
-- organization_id. Closed here, in the same migration that adds the third
-- function to the same family, rather than filed as a separate issue.

-- ── visit_tickets: the new column and the widened paid_method ─────────────

alter table public.visit_tickets
  add column if not exists credits_applied_cents integer not null default 0;

alter table public.visit_tickets
  add constraint visit_tickets_credits_applied_range
  check (credits_applied_cents >= 0);

comment on column public.visit_tickets.credits_applied_cents is
  'Credits applied as a bill REDUCTION on (subtotal - discount), never the tip. Additive to approved_amount_due_cents, never a mutation of it. Single-shot: 0 until applied once, via apply_ticket_credits. MESITA-1678.';

-- Widening a CHECK, never narrowing — safe, same pattern
-- 20260906231502_organization_guest_customers.sql used for this constraint.
alter table public.visit_tickets drop constraint if exists visit_tickets_paid_method_kind;
alter table public.visit_tickets
  add constraint visit_tickets_paid_method_kind
  check (paid_method is null or paid_method in ('at_place', 'mesita', 'mesita_pay', 'credits'));

-- ── apply_ticket_credits: the one new RPC ──────────────────────────────────

create or replace function public.apply_ticket_credits(
  p_ticket_id uuid,
  p_consumer_id uuid,
  p_organization_id uuid,
  p_amount_cents integer
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ticket record;
  v_cap integer;
  v_spend jsonb;
begin
  select id, state, approved_amount_due_cents, tip_cents, credits_applied_cents
    into v_ticket
    from public.visit_tickets
   where id = p_ticket_id and consumer_id = p_consumer_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  -- IDEMPOTENT, NOT AN ERROR. A retried call after a successful-but-timed-out
  -- response must not re-spend. Single-shot means "already applied" is a
  -- terminal, reportable state, not a race to detect.
  if v_ticket.credits_applied_cents > 0 then
    return jsonb_build_object(
      'ok', true, 'idempotent', true,
      'creditsAppliedCents', v_ticket.credits_applied_cents,
      'netAmountDueCents', v_ticket.approved_amount_due_cents - v_ticket.credits_applied_cents
    );
  end if;
  if v_ticket.state <> 'approved' then
    return jsonb_build_object('ok', false, 'code', 'stale_state', 'state', v_ticket.state);
  end if;

  -- C4-8's invariant, restated where it cannot be bypassed: credits may only
  -- reduce (subtotal - discount), never the tip. tip_cents has been nullable
  -- with no default since 0002_tickets.sql and nothing backfills it —
  -- greatest(0, x - NULL) is NULL in Postgres, which would silently zero the
  -- cap and block every apply on a null-tip ticket. coalesce is load-bearing.
  v_cap := greatest(0, v_ticket.approved_amount_due_cents - coalesce(v_ticket.tip_cents, 0));
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > v_cap then
    return jsonb_build_object('ok', false, 'code', 'amount_out_of_range', 'cap', v_cap);
  end if;

  v_spend := public.spend_credits(
    p_consumer_id, p_organization_id, p_amount_cents,
    'ticket:' || p_ticket_id::text
  );
  if not (v_spend ->> 'ok')::boolean then
    return v_spend; -- insufficient_credits / race_lost / amount_not_positive
  end if;

  update public.visit_tickets
     set credits_applied_cents = p_amount_cents
   where id = p_ticket_id and state = 'approved' and credits_applied_cents = 0;

  return jsonb_build_object(
    'ok', true,
    'creditsAppliedCents', p_amount_cents,
    'netAmountDueCents', v_ticket.approved_amount_due_cents - p_amount_cents
  );
end;
$$;

comment on function public.apply_ticket_credits is
  'Applies Credits as a one-time bill reduction on an approved ticket, atomically (ledger spend + ticket write in one transaction). Single-shot and idempotent on credits_applied_cents = 0 — a retry after applying returns the original result rather than double-spending. MESITA-1678.';

-- ── EF-only, explicitly, for all three Credits-moving RPCs ─────────────────

revoke execute on function public.apply_ticket_credits(uuid, uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.apply_ticket_credits(uuid, uuid, uuid, integer)
  to service_role;

revoke execute on function public.create_credit_lot(uuid, uuid, integer, integer, text, timestamptz, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.create_credit_lot(uuid, uuid, integer, integer, text, timestamptz, timestamptz, text)
  to service_role;

revoke execute on function public.spend_credits(uuid, uuid, integer, text)
  from public, anon, authenticated;
grant execute on function public.spend_credits(uuid, uuid, integer, text)
  to service_role;

-- ── get_credit_spend_report: visibility, not reconciliation ────────────────
--
-- Mesita has no POS/register integration to reconcile at_place credit
-- spend against, so a full reconciliation mechanism (the issue's own "other
-- unresolved thing") stays out of scope. This gives an operator something to
-- notice a spike or a mismatch against their own books with — per
-- organization, per rail, over all time (the admin EF can add a date filter
-- later if the volume ever justifies one; today's data is near-zero).
-- Same thin-wrapper shape as get_credit_liability (MESITA-1679).

create or replace function public.get_credit_spend_report()
returns table (
  organization_id uuid,
  organization_name text,
  paid_method text,
  spend_count bigint,
  spend_cents bigint
)
language sql
security definer
set search_path to 'public'
as $$
  -- Aliases are load-bearing, not style: without them ORDER BY resolves
  -- `paid_method` to the raw vt.paid_method column instead of the grouped
  -- output expression, which Postgres refuses outside GROUP BY (verified
  -- live — this exact mistake was caught testing against the real schema).
  select
    cl.organization_id,
    o.name as organization_name,
    coalesce(vt.paid_method, 'unknown') as paid_method,
    count(*)::bigint as spend_count,
    sum(-(le.paid_delta_cents + le.bonus_delta_cents))::bigint as spend_cents
  from public.credit_ledger le
  join public.credit_lots cl on cl.id = le.lot_id
  join public.organizations o on o.id = cl.organization_id
  left join public.visit_tickets vt
    on le.reference = 'ticket:' || vt.id::text
  where le.kind = 'spend'
  group by cl.organization_id, o.name, coalesce(vt.paid_method, 'unknown')
  order by o.name, paid_method;
$$;

comment on function public.get_credit_spend_report is
  'Per-organization, per-paid_method totals of credit_ledger spend entries. Visibility only — there is no POS/register data to reconcile against, so this is not a reconciliation mechanism, only a way for an operator to notice something worth asking about. MESITA-1678.';

revoke execute on function public.get_credit_spend_report()
  from public, anon, authenticated;
grant execute on function public.get_credit_spend_report()
  to service_role;

-- ── Post-flight ──────────────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'visit_tickets'
      and column_name = 'credits_applied_cents') then
    raise exception 'visit_tickets.credits_applied_cents missing after migration';
  end if;

  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'apply_ticket_credits' and p.prosecdef) then
    raise exception 'apply_ticket_credits missing or not security definer';
  end if;

  -- The whole point of this migration's security fix: none of the three
  -- Credits-moving functions may be executable by a client role.
  if has_function_privilege('authenticated', 'public.apply_ticket_credits(uuid,uuid,uuid,integer)', 'execute')
     or has_function_privilege('anon', 'public.apply_ticket_credits(uuid,uuid,uuid,integer)', 'execute')
     or has_function_privilege('authenticated', 'public.spend_credits(uuid,uuid,integer,text)', 'execute')
     or has_function_privilege('anon', 'public.spend_credits(uuid,uuid,integer,text)', 'execute')
     or has_function_privilege('authenticated', 'public.create_credit_lot(uuid,uuid,integer,integer,text,timestamptz,timestamptz,text)', 'execute')
     or has_function_privilege('anon', 'public.create_credit_lot(uuid,uuid,integer,integer,text,timestamptz,timestamptz,text)', 'execute') then
    raise exception 'a Credits-moving RPC is executable by a client role — revoke missing';
  end if;
end $$;

notify pgrst, 'reload schema';
