-- MESITA-3545 — Payments Flow v2, step A: the waiter's charge takes the tip,
-- the cash path's bill survives the sweep, and an outside bill can be
-- refunded (MESITA-3541; the ledger's outside part is MESITA-3544).
--
--   place_charges.tip_cents             the tip the waiter asked out loud and
--                                       typed (0 to MAX_PAYMENT_INPUT_CENTS);
--                                       the guest may change it on Pay
--   wallet_payments.charge_amount_cents the waiter's bill, copied when a
--                                       payment binds a charge, so "Bill MX$Y"
--                                       outlives the charge's 24-hour sweep
--   wallet_open_outside_capped(...)     the outside start under the pair lock:
--                                       credit = least(spendable, bill),
--                                       credit_covers from SQL, and the
--                                       guest's daily limit of outside bills
--                                       at a place (outside_limit)
--   wallet_open_outside                 a replay of an EXPIRED bill (the
--                                       guest cancelled, or its 30 minutes
--                                       passed) answers closed, never reopens
--   wallet_confirm_outside              tells a cancel (closed) from a
--                                       timeout (expired), and caps the
--                                       place's outside cashback per day
--                                       (past the ceiling the bill still
--                                       confirms, with what is left, or 0)
--   wallet_refund_outside(payment_id)   an operator refunds an outside bill
--                                       whole: credit part back, cashback
--                                       reversed (capped at what the guest
--                                       holds; the rest uncovered), refunded
--
-- Additive: two columns with a default or null; one new function. The EFs deploy minutes after this applies; the
-- old ones never write these columns and keep working.

-- ── 1. Columns ──────────────────────────────────────────────────────────────
alter table public.place_charges
  add column tip_cents integer not null default 0 check (tip_cents >= 0 and tip_cents <= 10000000);

alter table public.wallet_payments
  add column charge_amount_cents integer check (charge_amount_cents is null or charge_amount_cents > 0);

comment on column public.place_charges.tip_cents is
  'MESITA-3545: the tip staff typed after asking the guest (0 to MAX_PAYMENT_INPUT_CENTS); the guest''s Pay form starts from it and may change it.';
comment on column public.wallet_payments.charge_amount_cents is
  'MESITA-3545: the waiter''s bill (place_charges.amount_cents) when this payment paid a charge; null otherwise. Kept on the payment because the charge row is swept after 24 hours.';

-- ── 2. Refunding an outside bill ────────────────────────────────────────────
-- An outside bill refunds whole (the operator's answer to a Received that
-- should not have happened): the credit part comes back as a `refund` entry,
-- Available at once; the cashback goes, capped at what the guest holds (the
-- rest is uncovered_cents and the row reads needs_review), as a card refund
-- takes its cashback. The tip was paid at the table and is not Mesita's. No
-- Stripe. A second call answers already_refunded.
create or replace function public.wallet_refund_outside(p_payment_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_payments;
  v_credit integer;
  v_owed integer;
  v_holds integer;
  v_take integer := 0;
  v_uncovered integer;
  v_status text;
begin
  select * into v from public.wallet_payments where id = p_payment_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.outside_cents = 0 then
    return jsonb_build_object('ok', false, 'code', 'not_outside');
  end if;
  if v.paid_at is null then
    return jsonb_build_object('ok', false, 'code', 'not_paid');
  end if;
  if v.status in ('refunded', 'needs_review') then
    return jsonb_build_object('ok', true, 'outcome', 'already_refunded', 'status', v.status,
      'credit_refunded_cents', 0);
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);

  v_credit := v.credit_cents - v.credit_refunded_cents;
  if v_credit > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'refund', v_credit, v.currency, v.id, v.livemode, now());
  end if;

  select v.cashback_cents + coalesce(sum(amount_cents), 0) into v_owed
    from public.wallet_entries where payment_id = v.id and kind = 'reversal';
  v_owed := greatest(coalesce(v_owed, 0), 0);
  if v_owed > 0 then
    select greatest(b.spendable_cents + b.pending_cents, 0) into v_holds
      from public.wallet_balance(v.consumer_id, v.place_id, v.currency, v.livemode) b;
    v_take := least(v_owed, coalesce(v_holds, 0));
    if v_take > 0 then
      insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
      values (v.consumer_id, v.place_id, 'reversal', -v_take, v.currency, v.id, v.livemode, now());
    end if;
  end if;
  v_uncovered := v.uncovered_cents + (v_owed - v_take);
  v_status := case when v_uncovered > 0 then 'needs_review' else 'refunded' end;

  update public.wallet_payments
     set credit_refunded_cents = v.credit_cents, uncovered_cents = v_uncovered, status = v_status, updated_at = now()
   where id = v.id;

  return jsonb_build_object('ok', true, 'outcome', 'applied', 'status', v_status,
    'credit_refunded_cents', v_credit, 'cashback_reversed_cents', v_take, 'uncovered_cents', v_uncovered);
end;
$function$;

revoke all on function public.wallet_refund_outside(uuid) from public, anon, authenticated;
grant execute on function public.wallet_refund_outside(uuid) to service_role;

comment on function public.wallet_refund_outside(uuid) is
  'MESITA-3545 Wallet (operator): refunds an outside bill whole: the credit part back as a refund entry, the cashback reversed (capped at what the guest holds; the rest uncovered, needs_review). The tip was paid at the table. No Stripe. Replay-safe (already_refunded). Service role only.';

-- ── 3. The outside start, capped (MESITA-3545, folds MESITA-3553) ─────────
-- Estimated limits, Pato sets the numbers (money.ts twins them):
--   p_max_per_day   outside bills one guest may open at one place in a
--                   rolling day (open, paid or refunded; a cancelled or
--                   expired one does not count)
-- Under the pair lock: a replayed request_id goes to wallet_open_outside
-- (which answers its row); otherwise credit = least(spendable, bill),
-- outside = bill - credit, credit_covers when nothing is left outside, and
-- outside_limit past the daily count.
create or replace function public.wallet_open_outside_capped(
  p_consumer_id uuid, p_place_id uuid, p_bill_cents integer, p_tip_cents integer,
  p_currency text, p_livemode boolean, p_request_id uuid, p_proof_token text, p_ticket text,
  p_outside_cashback_bps integer, p_expires_at timestamptz, p_max_per_day integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_spendable integer;
  v_credit integer;
  v_count integer;
  v_prior public.wallet_payments;
  v_res jsonb;
begin
  if p_bill_cents is null or p_bill_cents <= 0 then
    return jsonb_build_object('ok', false, 'code', 'amount_required');
  end if;
  p_currency := lower(p_currency);
  perform public.wallet_lock(p_consumer_id, p_place_id);

  select * into v_prior from public.wallet_payments where consumer_id = p_consumer_id and request_id = p_request_id;
  if found then
    v_res := public.wallet_open_outside(p_consumer_id, p_place_id, v_prior.credit_cents, greatest(v_prior.outside_cents, 1),
      v_prior.tip_cents, p_currency, p_livemode, p_request_id, p_proof_token, p_ticket, p_outside_cashback_bps, p_expires_at);
    return v_res || jsonb_build_object('credit_cents', v_prior.credit_cents, 'outside_cents', v_prior.outside_cents,
      'tip_cents', v_prior.tip_cents);
  end if;

  select b.spendable_cents into v_spendable
    from public.wallet_balance(p_consumer_id, p_place_id, p_currency, p_livemode) b;
  v_credit := least(greatest(coalesce(v_spendable, 0), 0), p_bill_cents);
  if p_bill_cents - v_credit <= 0 then
    return jsonb_build_object('ok', false, 'code', 'credit_covers',
      'spendable_cents', coalesce(v_spendable, 0), 'bill_cents', p_bill_cents);
  end if;

  select count(*) into v_count from public.wallet_payments
   where consumer_id = p_consumer_id and place_id = p_place_id and livemode = p_livemode
     and outside_cents > 0 and created_at > now() - interval '1 day'
     and status not in ('expired', 'failed');
  if v_count >= p_max_per_day then
    return jsonb_build_object('ok', false, 'code', 'outside_limit', 'max_per_day', p_max_per_day);
  end if;

  v_res := public.wallet_open_outside(p_consumer_id, p_place_id, v_credit, p_bill_cents - v_credit, p_tip_cents,
    p_currency, p_livemode, p_request_id, p_proof_token, p_ticket, p_outside_cashback_bps, p_expires_at);
  if (v_res ->> 'ok')::boolean then
    v_res := v_res || jsonb_build_object('credit_cents', v_credit, 'outside_cents', p_bill_cents - v_credit, 'tip_cents', p_tip_cents);
  end if;
  return v_res;
end;
$function$;

revoke all on function public.wallet_open_outside_capped(uuid, uuid, integer, integer, text, boolean, uuid, text, text, integer, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.wallet_open_outside_capped(uuid, uuid, integer, integer, text, boolean, uuid, text, text, integer, timestamptz, integer)
  to service_role;

comment on function public.wallet_open_outside_capped(uuid, uuid, integer, integer, text, boolean, uuid, text, text, integer, timestamptz, integer) is
  'MESITA-3545 Wallet: opens a bill paid outside from the waiter''s charge: under the pair lock, credit = least(spendable, bill), credit_covers when nothing is left outside, outside_limit past p_max_per_day outside bills per guest per place per rolling day; a replayed request_id answers through wallet_open_outside. Service role only.';

-- ── 4. A replay never reopens an expired outside bill ───────────────────────
-- Same body as MESITA-3544 except: an `expired` row (the guest cancelled,
-- or its 30 minutes passed) answers closed; only a `failed` row reopens.
create or replace function public.wallet_open_outside(
  p_consumer_id uuid, p_place_id uuid, p_credit_cents integer, p_outside_cents integer, p_tip_cents integer,
  p_currency text, p_livemode boolean, p_request_id uuid, p_proof_token text, p_ticket text,
  p_outside_cashback_bps integer, p_expires_at timestamptz)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_prior public.wallet_payments;
  v_spendable integer;
  v_id uuid;
begin
  if p_outside_cents is null or p_outside_cents <= 0
     or p_credit_cents is null or p_credit_cents < 0 or p_tip_cents is null or p_tip_cents < 0 then
    return jsonb_build_object('ok', false, 'code', 'amount_required');
  end if;
  if p_consumer_id is null or p_request_id is null or p_expires_at is null then
    raise exception 'wallet_open_outside: consumer, request_id and expiry are required';
  end if;
  p_currency := lower(p_currency);

  perform public.wallet_lock(p_consumer_id, p_place_id);

  select * into v_prior from public.wallet_payments
   where consumer_id = p_consumer_id and request_id = p_request_id;
  if found then
    if v_prior.place_id <> p_place_id or v_prior.outside_cents = 0 or v_prior.livemode <> p_livemode then
      return jsonb_build_object('ok', false, 'code', 'taken', 'payment_id', v_prior.id);
    end if;
    if v_prior.paid_at is not null then
      return jsonb_build_object('ok', true, 'outcome', 'already_paid', 'payment_id', v_prior.id,
        'status', v_prior.status, 'credit_cents', v_prior.credit_cents, 'outside_cents', v_prior.outside_cents,
        'tip_cents', v_prior.tip_cents, 'currency', v_prior.currency, 'paid_at', v_prior.paid_at,
        'proof_token', v_prior.proof_token);
    end if;
    if v_prior.status in ('opening', 'open') then
      return jsonb_build_object('ok', true, 'outcome', 'in_progress', 'payment_id', v_prior.id,
        'expires_at', v_prior.expires_at);
    end if;
    if v_prior.status = 'expired' then
      return jsonb_build_object('ok', false, 'code', 'closed', 'payment_id', v_prior.id);
    end if;
    if v_prior.status = 'failed' then
      select b.spendable_cents into v_spendable
        from public.wallet_balance(p_consumer_id, p_place_id, p_currency, p_livemode) b;
      if p_credit_cents > coalesce(v_spendable, 0) then
        return jsonb_build_object('ok', false, 'code', 'insufficient', 'spendable_cents', coalesce(v_spendable, 0));
      end if;
      update public.wallet_payments
         set status = 'open', credit_cents = p_credit_cents, outside_cents = p_outside_cents,
             amount_cents = p_credit_cents + p_outside_cents,
             tip_cents = p_tip_cents, outside_cashback_bps = p_outside_cashback_bps, expires_at = p_expires_at,
             ticket = p_ticket, proof_token = coalesce(proof_token, p_proof_token), updated_at = now()
       where id = v_prior.id;
      return jsonb_build_object('ok', true, 'outcome', 'opened', 'payment_id', v_prior.id, 'expires_at', p_expires_at);
    end if;
    return jsonb_build_object('ok', false, 'code', 'taken', 'payment_id', v_prior.id);
  end if;

  select b.spendable_cents into v_spendable
    from public.wallet_balance(p_consumer_id, p_place_id, p_currency, p_livemode) b;
  v_spendable := coalesce(v_spendable, 0);
  if p_credit_cents > v_spendable then
    return jsonb_build_object('ok', false, 'code', 'insufficient', 'spendable_cents', v_spendable);
  end if;

  begin
    insert into public.wallet_payments (consumer_id, place_id, amount_cents, credit_cents, card_cents, outside_cents,
                                        tip_cents, currency, status, outside_cashback_bps, request_id, ticket,
                                        proof_token, livemode, expires_at)
    values (p_consumer_id, p_place_id, p_credit_cents + p_outside_cents, p_credit_cents, 0, p_outside_cents,
            p_tip_cents, p_currency, 'open', p_outside_cashback_bps, p_request_id, p_ticket,
            p_proof_token, p_livemode, p_expires_at)
    returning id into v_id;
  exception when unique_violation then
    select id into v_id from public.wallet_payments
     where consumer_id = p_consumer_id and request_id = p_request_id;
    return jsonb_build_object('ok', false, 'code', 'taken', 'payment_id', v_id);
  end;

  return jsonb_build_object('ok', true, 'outcome', 'opened', 'payment_id', v_id, 'expires_at', p_expires_at);
end;
$function$;

-- ── 5. Received: a cancel is not a timeout; the place's daily ceiling ───────
-- Same as MESITA-3544, plus: a row the guest cancelled (expired with
-- stripe_error 'cancelled') answers closed, any other expired or failed row
-- answers expired; and the place's outside cashback over a rolling day is
-- capped at 50,000 centavos ($500MX, estimated, Pato sets it; money.ts
-- OUTSIDE_CASHBACK_DAILY_CEILING_CENTS twins it): past it the bill still
-- confirms, with what is left of the ceiling, or no cashback.
create or replace function public.wallet_confirm_outside(p_payment_id uuid, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_payments;
  v_cashback integer;
  v_today integer;
  c_ceiling constant integer := 50000;
begin
  select * into v from public.wallet_payments where id = p_payment_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.outside_cents = 0 then
    return jsonb_build_object('ok', false, 'code', 'not_outside');
  end if;
  if v.paid_at is not null then
    return jsonb_build_object('ok', true, 'outcome', 'already_paid', 'payment_id', v.id, 'status', v.status,
      'credit_cents', v.credit_cents, 'outside_cents', v.outside_cents, 'tip_cents', v.tip_cents,
      'cashback_cents', v.cashback_cents, 'currency', v.currency, 'paid_at', v.paid_at, 'proof_token', v.proof_token);
  end if;
  if v.status not in ('opening', 'open') then
    if v.status = 'expired' and v.stripe_error = 'cancelled' then
      return jsonb_build_object('ok', false, 'code', 'closed', 'bill_cents', coalesce(v.charge_amount_cents, v.amount_cents));
    end if;
    return jsonb_build_object('ok', false, 'code', 'expired', 'bill_cents', coalesce(v.charge_amount_cents, v.amount_cents));
  end if;
  if v.expires_at is not null and v.expires_at <= p_now then
    update public.wallet_payments set status = 'expired', updated_at = now() where id = v.id;
    return jsonb_build_object('ok', false, 'code', 'expired', 'bill_cents', coalesce(v.charge_amount_cents, v.amount_cents));
  end if;

  perform public.wallet_lock(v.consumer_id, v.place_id);
  v_cashback := (v.outside_cents * v.outside_cashback_bps) / 10000;
  if v_cashback > 0 then
    select coalesce(sum(cashback_cents), 0) into v_today from public.wallet_payments
     where place_id = v.place_id and livemode = v.livemode and outside_cents > 0
       and paid_at is not null and paid_at > p_now - interval '1 day';
    v_cashback := least(v_cashback, greatest(c_ceiling - v_today, 0));
  end if;

  update public.wallet_payments
     set status = 'paid', paid_at = p_now, confirmed_by = 'waiter', cashback_cents = v_cashback, updated_at = now()
   where id = v.id;

  if v.credit_cents > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'spend', -v.credit_cents, v.currency, v.id, v.livemode, p_now);
  end if;
  if v_cashback > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'cashback', v_cashback, v.currency, v.id, v.livemode, p_now + interval '1 hour');
  end if;

  return jsonb_build_object('ok', true, 'outcome', 'paid', 'payment_id', v.id, 'status', 'paid',
    'credit_cents', v.credit_cents, 'outside_cents', v.outside_cents, 'tip_cents', v.tip_cents,
    'cashback_cents', v_cashback, 'currency', v.currency, 'paid_at', p_now, 'proof_token', v.proof_token);
end;
$function$;

-- ── 6. Post-flight ──────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'place_charges' and column_name = 'tip_cents')
     or not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'wallet_payments' and column_name = 'charge_amount_cents') then
    raise exception 'MESITA-3545 columns missing after apply';
  end if;
end $$;
