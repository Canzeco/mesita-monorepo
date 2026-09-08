-- Credits get operator surfaces: refund/adjust, an expiry-sweep mechanism,
-- and the admin liability aggregate (MESITA-1679, depends on MESITA-1671).
--
-- LEDGER: applied through MCP apply_migration, which stamps its own
-- server-side timestamp, so this FILENAME was renamed to match the stamped
-- version 20260908153425 rather than writing to schema_migrations by hand.
--
-- VERIFIED AGAINST THE LIVE SCHEMA at apply time, not just checked: issued a
-- lot (1000 paid + 100 bonus), partial-refunded 400 (took from principal,
-- idempotent on a replayed reference), then adjusted away the 700 remainder
-- (org-closure claw-back) with nothing left to reverse afterward. Confirmed
-- sweep_expired_credit_lots no-ops while expiryDisposition is unset (today's
-- state). Set 'forfeit', swept an expired 1100-cent lot, confirmed the whole
-- remainder left the ledger as breakage and a re-run scanned zero (the
-- not-exists(kind='expire') idempotency guard held). Set 'return_paid',
-- swept a second expired lot (2000 paid + 200 bonus): only the 200 bonus
-- entered the ledger, the 2000 paid stayed off spent_cents as designed, and
-- a follow-up reverse_credit_lot('refund') retrieved exactly that 2000.
-- get_credit_liability then summed correctly across all three lots — issued
-- 4400, breakage 1300 (the two full-forfeit-equivalent amounts, correctly
-- EXCLUDING the 2000 that came back via refund, not expiry) — grouped by
-- currency with no cross-currency mixing, and flagged no currency mismatch
-- on the single test org. All fixtures deleted afterward (0 lots, 0 ledger
-- rows), and controls_config.expiryDisposition was restored to UNSET before
-- this session ended, matching the post-flight assertion below.
--
-- THREE NEW RPCs, same house shape as create_credit_lot / spend_credits
-- (security definer plpgsql, set search_path, every UPDATE carries a WHERE
-- because the authenticator role's safeupdate extension aborts a WHERE-less
-- UPDATE even inside a SECURITY DEFINER function — 20260906213431):
--
--   reverse_credit_lot   — the refund/cancel/adjust primitive. ONE lot,
--     ONE ledger entry, kind 'refund' or 'adjust'. 'refund' is for money
--     that is actually returning via Stripe (guest dispute, admin-triggered
--     refund) — the admin EF calls Stripe first and this RPC is invoked
--     ONLY by the webhook once Stripe confirms, so the ledger never says
--     "refunded" before Stripe agrees. 'adjust' is for claw-backs that never
--     touch Stripe (an org closes, a bonus was issued in error) — the admin
--     EF calls this directly. Both reduce a lot's spendable remainder the
--     same way spend_credits does: principal before bonus, refuse instead of
--     going negative, and idempotent per (lot_id, reference).
--
--   sweep_expired_credit_lots — the cron target. THE FORFEIT-VS-RETURN
--     QUESTION IS OPEN (controls-config.ts:45-48 says so, and still does)
--     — whether an expired remainder is forfeited to the place or the paid
--     half is returned to the guest is a settlement question with no
--     product/legal answer yet. This function is the MECHANISM, not the
--     decision: it reads app_config.controls_config->>'expiryDisposition'
--     and REFUSES to touch a single row when that key is unset — which is
--     its state today and stays its state until Pato/counsel sets it. The
--     cron job below is created (closing "there is no cron that would sweep
--     it" for real) but is safe to run in production immediately: every
--     invocation until the config is set is a documented no-op. Two-delta
--     ledger rows (paid_delta_cents / bonus_delta_cents, MESITA-1671) are
--     what let ONE function express EITHER disposition with no schema
--     change — forfeit zeroes both halves in the 'expire' row; return_paid
--     zeroes only the bonus half in the 'expire' row and leaves the paid
--     half unswept (still counted as "available" by spent_cents, but
--     unreachable by spend_credits because expires_at <= now() excludes the
--     lot from that RPC's own WHERE) for a follow-up reverse_credit_lot
--     'refund' call — an operator action, not automated, because
--     auto-refunding a card months after purchase is its own product
--     decision this issue does not make either.
--
--   get_credit_liability — the admin console read. Grouped by CURRENCY,
--     never summed across it: MESITA_CONNECT_COUNTRIES already allows US
--     alongside MX (_shared/stripe-connect.ts), credit_lots.currency is
--     free text with no CHECK, and nothing today enforces it against the
--     owning organization's own currency column — so the per-org rows also
--     carry a currencyMismatch flag surfacing that drift instead of hiding
--     it inside a silently-wrong sum. Breakage-to-date falls out of the
--     ledger for free: summing kind='expire' rows counts a forfeit
--     disposition's full remainder and a return_paid disposition's
--     bonus-only remainder correctly, with no need to branch on which
--     disposition wrote it (see the comment above the query).

-- ── credit_ledger gets a fourth movement kind ───────────────────────────
-- 'adjust' is a claw-back that never touches Stripe — the org-closes /
-- correct-an-error case the refund kind does not cover, because nothing
-- refundable ever left the connected account. Named CHECK, house style
-- (20260908101212's own comment: "'cancelled' vs 'canceled' is a live money
-- bug" — the same argument applies to inventing a kind ad hoc in application
-- code instead of naming it here).

alter table public.credit_ledger drop constraint credit_ledger_kind;
alter table public.credit_ledger add constraint credit_ledger_kind
  check (kind in ('issue', 'spend', 'refund', 'expire', 'adjust'));

-- ── controls_config gets the (unset-by-default) expiry disposition knob ─
-- Additive: existing rows keep every other key untouched. NOT set here —
-- deliberately absent, so sweep_expired_credit_lots' "unset = refuse" guard
-- is exercised from the moment this migration lands, not assumed.

comment on column public.credit_ledger.kind is
  'issue | spend | refund | expire | adjust. refund = money actually returning via Stripe, written ONLY by the webhook once Stripe confirms (never optimistically by the admin EF that requested it). adjust = a claw-back with no Stripe leg (org closure, error correction), written directly by an admin action. MESITA-1679.';

-- ── reverse_credit_lot: the refund/cancel/adjust primitive ─────────────

create or replace function public.reverse_credit_lot(
  p_lot_id uuid,
  p_kind text,
  p_amount_cents integer,
  p_reference text
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_lot record;
  v_available integer;
  v_take integer;
  v_take_paid integer;
  v_take_bonus integer;
  v_paid_left integer;
begin
  if p_kind not in ('refund', 'adjust') then
    return jsonb_build_object('ok', false, 'code', 'invalid_kind');
  end if;

  -- Idempotency BEFORE the row lock: a webhook retry (outer stripe_events
  -- dedupe already covers the common case, this is belt-and-suspenders —
  -- same posture as create_credit_lot's own unique-violation catch) or a
  -- doubled admin click must not claw back the same money twice.
  if p_reference is not null and exists (
    select 1 from public.credit_ledger
     where lot_id = p_lot_id and kind = p_kind and reference = p_reference
  ) then
    return jsonb_build_object('ok', true, 'idempotent', true, 'lotId', p_lot_id);
  end if;

  select id, paid_cents, bonus_cents, spent_cents
    into v_lot
    from public.credit_lots
   where id = p_lot_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'lot_not_found');
  end if;

  v_available := v_lot.paid_cents + v_lot.bonus_cents - v_lot.spent_cents;
  v_take := least(coalesce(p_amount_cents, v_available), v_available);

  if v_take is null or v_take <= 0 then
    return jsonb_build_object('ok', false, 'code', 'nothing_to_reverse', 'availableCents', v_available);
  end if;

  -- PRINCIPAL FIRST, same law and same reason as spend_credits: the
  -- guest's actual money is what a Stripe refund can return, so it is what
  -- gets claimed first; whatever remains comes out of the bonus. An
  -- 'adjust' claw-back has no Stripe leg to honor, but reusing the same
  -- order keeps one rule instead of two and is never wrong for a claw-back
  -- that, like an org closure, empties the lot either way.
  v_paid_left := greatest(v_lot.paid_cents - least(v_lot.spent_cents, v_lot.paid_cents), 0);
  v_take_paid := least(v_take, v_paid_left);
  v_take_bonus := v_take - v_take_paid;

  update public.credit_lots
     set spent_cents = spent_cents + v_take
   where id = v_lot.id
     and spent_cents = v_lot.spent_cents;

  insert into public.credit_ledger (
    lot_id, kind, paid_delta_cents, bonus_delta_cents, reference
  ) values (v_lot.id, p_kind, -v_take_paid, -v_take_bonus, p_reference);

  return jsonb_build_object(
    'ok', true, 'lotId', v_lot.id, 'kind', p_kind,
    'centsReversed', v_take, 'paidCents', v_take_paid, 'bonusCents', v_take_bonus
  );
exception
  when check_violation then
    -- credit_lots_spent_range fired: a concurrent write moved spent_cents
    -- between our read and our write. Roll back, report the race honestly.
    return jsonb_build_object('ok', false, 'code', 'race_lost');
end;
$$;

comment on function public.reverse_credit_lot is
  'The refund/cancel/adjust primitive (MESITA-1679). Claws back up to p_amount_cents (or the whole remainder when null) from ONE lot, principal before bonus, refusing rather than going negative. kind=refund is written ONLY once Stripe has actually returned money (the webhook is the only caller with that kind); kind=adjust is a claw-back with no Stripe leg (admin EFs call this directly). Idempotent per (lot_id, kind, reference).';

revoke all on function public.reverse_credit_lot(uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.reverse_credit_lot(uuid, text, integer, text) to service_role;

-- ── sweep_expired_credit_lots: the cron target ──────────────────────────

create or replace function public.sweep_expired_credit_lots(
  p_batch_size integer default 200
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_disposition text;
  v_lot record;
  v_remaining integer;
  v_paid_left integer;
  v_forfeit_paid integer;
  v_forfeit_bonus integer;
  v_scanned integer := 0;
  v_swept integer := 0;
  v_total_bonus_cents integer := 0;
  v_total_paid_cents integer := 0;
begin
  select controls_config ->> 'expiryDisposition'
    into v_disposition
    from public.app_config
   where id = 1;

  -- THE OPEN QUESTION, ENFORCED, NOT JUST DOCUMENTED. Until an operator (on
  -- the counsel answer this issue does not make — MESITA-1680/1678 name the
  -- same gap) sets 'forfeit' or 'return_paid' on controls_config, this
  -- function scans nothing and writes nothing. Scheduling the cron job below
  -- is therefore safe from the moment this migration lands: every tick is a
  -- documented, observable no-op until a human decides.
  if v_disposition is null or v_disposition not in ('forfeit', 'return_paid') then
    return jsonb_build_object('ok', false, 'code', 'expiry_disposition_not_configured');
  end if;

  -- `not exists (... kind='expire')` is the guard that makes this
  -- idempotent under return_paid: that disposition deliberately leaves the
  -- paid half unswept (spent_cents short of the ceiling) so a follow-up
  -- reverse_credit_lot('refund') can return it — without this guard the
  -- same lot would re-enter every subsequent run and get a SECOND 'expire'
  -- row for a bonus that is already zero.
  for v_lot in
    select id, paid_cents, bonus_cents, spent_cents
      from public.credit_lots
     where expires_at <= now()
       and paid_cents + bonus_cents > spent_cents
       and not exists (
         select 1 from public.credit_ledger cl
          where cl.lot_id = credit_lots.id and cl.kind = 'expire'
       )
     order by expires_at asc
     for update skip locked
     limit p_batch_size
  loop
    v_scanned := v_scanned + 1;
    v_remaining := v_lot.paid_cents + v_lot.bonus_cents - v_lot.spent_cents;
    v_paid_left := greatest(v_lot.paid_cents - least(v_lot.spent_cents, v_lot.paid_cents), 0);

    if v_disposition = 'forfeit' then
      -- Whole remainder dies here — both halves, one row, spent_cents
      -- reaches its ceiling. Nothing further ever touches this lot.
      v_forfeit_paid := least(v_remaining, v_paid_left);
      v_forfeit_bonus := v_remaining - v_forfeit_paid;
      update public.credit_lots
         set spent_cents = spent_cents + v_remaining
       where id = v_lot.id and spent_cents = v_lot.spent_cents;
      insert into public.credit_ledger (lot_id, kind, paid_delta_cents, bonus_delta_cents, reference)
        values (v_lot.id, 'expire', -v_forfeit_paid, -v_forfeit_bonus, 'expiry_sweep:forfeit');
      v_total_paid_cents := v_total_paid_cents + v_forfeit_paid;
      v_total_bonus_cents := v_total_bonus_cents + v_forfeit_bonus;
    else -- 'return_paid'
      -- Only the BONUS half dies here (that is always breakage, in either
      -- disposition — it was never the guest's money to begin with). The
      -- paid half is intentionally left out of spent_cents: it stays
      -- "available" by the anchor's own math but unreachable by
      -- spend_credits (expires_at <= now() excludes it), so it sits as a
      -- findable, un-double-payable claim until an operator (or a future
      -- automated follow-up, once that is itself decided) runs
      -- reverse_credit_lot(lot_id, 'refund', null, …) to actually return it.
      update public.credit_lots
         set spent_cents = spent_cents + (v_remaining - v_paid_left)
       where id = v_lot.id and spent_cents = v_lot.spent_cents;
      insert into public.credit_ledger (lot_id, kind, paid_delta_cents, bonus_delta_cents, reference)
        values (v_lot.id, 'expire', 0, -(v_remaining - v_paid_left), 'expiry_sweep:return_paid');
      v_total_bonus_cents := v_total_bonus_cents + (v_remaining - v_paid_left);
    end if;

    v_swept := v_swept + 1;
  end loop;

  return jsonb_build_object(
    'ok', true, 'disposition', v_disposition, 'scanned', v_scanned, 'swept', v_swept,
    'forfeitedPaidCents', v_total_paid_cents, 'forfeitedBonusCents', v_total_bonus_cents
  );
end;
$$;

comment on function public.sweep_expired_credit_lots is
  'The cron target that keeps SUM(credit_ledger) equal to the balance past a lot''s expiry (MESITA-1679). Refuses to touch any row until app_config.controls_config.expiryDisposition is set to forfeit or return_paid — that decision is open (blocked on the same counsel question as MESITA-1680/1678) and this function must never guess it. See the header comment above for what each disposition writes.';

revoke all on function public.sweep_expired_credit_lots(integer) from public, anon, authenticated;
grant execute on function public.sweep_expired_credit_lots(integer) to service_role;

-- Cron owns the schedule; nobody else needs to invoke this directly, but the
-- grant above stays (matching create_credit_lot/spend_credits) rather than
-- narrowing to cron's own role, since EF-callable manual runs (a support
-- "sweep now" button, if one is ever built) would want the same door.
select cron.unschedule('sweep-expired-credit-lots')
where exists (select 1 from cron.job where jobname = 'sweep-expired-credit-lots');

select cron.schedule(
  'sweep-expired-credit-lots',
  '17 * * * *', -- hourly, off the hour so it never contends with on-the-hour jobs
  $cron$ select public.sweep_expired_credit_lots(); $cron$
);

-- ── get_credit_liability: the admin console read ────────────────────────

create or replace function public.get_credit_liability()
returns jsonb
language sql
security definer
set search_path to 'public'
stable
as $$
  select jsonb_build_object(
    'byCurrency', coalesce((
      select jsonb_agg(jsonb_build_object(
        'currency', s.currency,
        'issuedCents', s.issued_cents,
        'outstandingCents', s.outstanding_cents,
        'pendingCents', s.pending_cents,
        'pendingLotCount', s.pending_lot_count,
        'breakageCents', coalesce(b.breakage_cents, 0),
        'lotCount', s.lot_count
      ) order by s.currency)
      from (
        select
          l.currency,
          sum(l.paid_cents + l.bonus_cents)::bigint as issued_cents,
          sum(l.paid_cents + l.bonus_cents - l.spent_cents)::bigint as outstanding_cents,
          sum(l.paid_cents + l.bonus_cents - l.spent_cents)
            filter (where l.activates_at > now())::bigint as pending_cents,
          count(*) filter (
            where l.activates_at > now() and l.paid_cents + l.bonus_cents > l.spent_cents
          ) as pending_lot_count,
          count(*) as lot_count
        from public.credit_lots l
        group by l.currency
      ) s
      left join (
        -- Breakage falls out of the two-delta ledger with no need to branch
        -- on which disposition wrote the 'expire' row: a forfeit row's
        -- deltas are the WHOLE remainder (real breakage); a return_paid
        -- row's paid_delta is always 0 at write time (that half is pending
        -- an operator return, not lost) so summing both deltas together
        -- still counts only what is actually gone either way.
        select gl.currency, sum(-(g.paid_delta_cents + g.bonus_delta_cents))::bigint as breakage_cents
        from public.credit_ledger g
        join public.credit_lots gl on gl.id = g.lot_id
        where g.kind = 'expire'
        group by gl.currency
      ) b on b.currency = s.currency
    ), '[]'::jsonb),
    'byOrganization', coalesce((
      select jsonb_agg(jsonb_build_object(
        'organizationId', o.id,
        'organizationName', o.name,
        'currency', t.currency,
        'issuedCents', t.issued_cents,
        'outstandingCents', t.outstanding_cents,
        'lotCount', t.lot_count,
        -- A currency the lot carries that disagrees with its OWN
        -- organization's currency column — nothing upstream of this
        -- migration enforces the two match (credit_lots.currency defaults
        -- 'MXN' independent of organizations.currency), so surface the drift
        -- rather than silently mixing it into a total.
        'currencyMismatch', t.currency is distinct from o.currency
      ) order by t.outstanding_cents desc)
      from (
        select
          organization_id,
          currency,
          sum(paid_cents + bonus_cents)::bigint as issued_cents,
          sum(paid_cents + bonus_cents - spent_cents)::bigint as outstanding_cents,
          count(*) as lot_count
        from public.credit_lots
        group by organization_id, currency
      ) t
      join public.organizations o on o.id = t.organization_id
    ), '[]'::jsonb),
    'expiryDisposition', (
      select controls_config ->> 'expiryDisposition' from public.app_config where id = 1
    ),
    'generatedAt', now()
  );
$$;

comment on function public.get_credit_liability is
  'Admin console read for MESITA-1679: issued value, outstanding balance, pending (still-held) lots, breakage to date, all grouped by currency (never summed across it — see the header comment), plus a per-organization exposure table flagging any lot whose currency disagrees with its own organization. Read by admin-web-list-credit-liability.';

revoke all on function public.get_credit_liability() from public, anon, authenticated;
grant execute on function public.get_credit_liability() to service_role;

-- ── Post-flight ──────────────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'credit_ledger_kind') then
    raise exception 'credit_ledger_kind missing after migration';
  end if;
  if pg_get_constraintdef(
    (select oid from pg_constraint where conname = 'credit_ledger_kind')
  ) not like '%adjust%' then
    raise exception 'credit_ledger_kind does not accept adjust';
  end if;

  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'reverse_credit_lot' and p.prosecdef) then
    raise exception 'reverse_credit_lot missing or not security definer';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'sweep_expired_credit_lots' and p.prosecdef) then
    raise exception 'sweep_expired_credit_lots missing or not security definer';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_credit_liability' and p.prosecdef) then
    raise exception 'get_credit_liability missing or not security definer';
  end if;

  if not exists (select 1 from cron.job where jobname = 'sweep-expired-credit-lots') then
    raise exception 'sweep-expired-credit-lots cron job missing';
  end if;

  -- The gate that keeps the sweep production-safe with no operator action:
  -- an unset expiryDisposition must be an honest no-op, never a guess.
  if (select controls_config ? 'expiryDisposition' from public.app_config where id = 1) then
    raise exception 'expiryDisposition must NOT be pre-set by this migration — the forfeit-vs-return decision is still open';
  end if;

  if has_function_privilege('authenticated', 'public.reverse_credit_lot(uuid,text,integer,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.get_credit_liability()', 'EXECUTE') then
    raise exception 'credits operator RPCs are callable by authenticated — revoke missing';
  end if;
end $$;

notify pgrst, 'reload schema';
