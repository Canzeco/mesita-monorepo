-- MESITA-3544 — Payments Flow v2, step 2: the ledger learns a bill's outside
-- part (MESITA-3541; Pato, 2026-11-09: "credit is born only from a bill the
-- place confirmed … Mesita Pay 5%, cash 2% … the ledger must not know which").
--
-- A guest at the waiter's code may pay the bill outside Mesita (cash or the
-- place's own terminal). The credit part is held exactly like a card part
-- (wallet_balance counts every opening/open row's credit_cents); the staff's
-- Received tap is the confirmer, and the cashback on the outside part is the
-- same `cashback` entry kind, Pending one hour, at the rate stored at open.
-- No function here names Stripe: Stripe is one confirmer (wallet_settle_payment),
-- the waiter another (wallet_confirm_outside), and the entries cannot tell.
--
--   wallet_payments.outside_cents         the part paid outside Mesita;
--                                         amount = credit + card + outside
--   wallet_payments.outside_cashback_bps  the rate stored at open (200 today,
--                                         OUTSIDE_CASHBACK_BPS); confirm never
--                                         re-reads it
--   wallet_payments.confirmed_by          who said this bill was paid:
--                                         credit (nothing outside the ledger
--                                         moved) · stripe · waiter
--   wallet_open_outside(...)              holds the credit part, opens the row
--   wallet_confirm_outside(id)            the waiter's Received: paid, spend,
--                                         cashback on the outside part
--   wallet_expire_outside()               an unconfirmed row past its expiry
--                                         closes with nothing born
--   wallet_settle_batch                   never hands an outside row to the
--                                         Stripe cron
--   place_charges_sweep                   expires outside rows first, so their
--                                         charges free their codes
--
-- One bill is credit + card or credit + outside, never card + outside (v1:
-- the waiter's door offers one or the other). A tip never earns and never
-- takes credit; outside, it is recorded as typed. Additive: new columns are
-- defaulted or nullable, so the EFs of main keep working through the
-- migration-before-functions window.

-- ── 1. Columns ──────────────────────────────────────────────────────────────
alter table public.wallet_payments
  add column outside_cents integer not null default 0 check (outside_cents >= 0),
  add column outside_cashback_bps integer not null default 0
    check (outside_cashback_bps >= 0 and outside_cashback_bps <= 10000),
  add column confirmed_by text check (confirmed_by is null or confirmed_by in ('credit', 'stripe', 'waiter'));

comment on column public.wallet_payments.outside_cents is
  'MESITA-3544: the part of the bill paid outside Mesita (cash or the place''s terminal), confirmed by the waiter''s Received. amount_cents = credit_cents + card_cents + outside_cents.';
comment on column public.wallet_payments.outside_cashback_bps is
  'MESITA-3544: the cashback rate on the outside part, stored at open (OUTSIDE_CASHBACK_BPS). wallet_confirm_outside writes bps(outside_cents, outside_cashback_bps) and never re-reads it.';
comment on column public.wallet_payments.confirmed_by is
  'MESITA-3544: who confirmed the bill was paid: credit (credit-only, nothing moved outside the ledger), stripe (a card part), waiter (an outside part). Null until paid.';

-- ── 2. The parts, and one rail per bill ─────────────────────────────────────
alter table public.wallet_payments drop constraint wallet_payments_parts_chk;
alter table public.wallet_payments add constraint wallet_payments_parts_chk
  check (amount_cents = credit_cents + card_cents + outside_cents);
alter table public.wallet_payments add constraint wallet_payments_one_rail_chk
  check (card_cents = 0 or outside_cents = 0);

-- ── 3. confirmed_by follows paid_at ─────────────────────────────────────────
update public.wallet_payments
   set confirmed_by = case when card_cents > 0 then 'stripe' else 'credit' end
 where paid_at is not null and confirmed_by is null;

-- The writers of W2a and W2b keep their bodies: a row becoming paid without a
-- confirmer named gets the one its parts imply. wallet_confirm_outside names
-- 'waiter' itself.
create or replace function public.wallet_payments_confirmed_by()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if new.paid_at is not null and new.confirmed_by is null then
    new.confirmed_by := case
      when new.outside_cents > 0 then 'waiter'
      when new.card_cents > 0 then 'stripe'
      else 'credit'
    end;
  end if;
  return new;
end;
$function$;

revoke all on function public.wallet_payments_confirmed_by() from public, anon, authenticated;

drop trigger if exists wallet_payments_confirmed_by on public.wallet_payments;
create trigger wallet_payments_confirmed_by
  before insert or update of paid_at on public.wallet_payments
  for each row
  execute function public.wallet_payments_confirmed_by();

-- ── 4. Opening an outside bill ──────────────────────────────────────────────
-- Under the pair lock: a replayed request_id answers its row (already_paid,
-- in_progress while it waits for the waiter, a fresh open on an expired or
-- failed row of the same shape), anything else under that id is taken; more
-- credit than spendable is insufficient; otherwise one `open` row whose
-- credit_cents is the hold.
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
    if v_prior.place_id <> p_place_id or v_prior.amount_cents <> p_credit_cents + p_outside_cents
       or v_prior.outside_cents = 0 or v_prior.livemode <> p_livemode then
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
    if v_prior.status in ('failed', 'expired') then
      select b.spendable_cents into v_spendable
        from public.wallet_balance(p_consumer_id, p_place_id, p_currency, p_livemode) b;
      if p_credit_cents > coalesce(v_spendable, 0) then
        return jsonb_build_object('ok', false, 'code', 'insufficient', 'spendable_cents', coalesce(v_spendable, 0));
      end if;
      update public.wallet_payments
         set status = 'open', credit_cents = p_credit_cents, outside_cents = p_outside_cents,
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

revoke all on function public.wallet_open_outside(uuid, uuid, integer, integer, integer, text, boolean, uuid, text, text, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.wallet_open_outside(uuid, uuid, integer, integer, integer, text, boolean, uuid, text, text, integer, timestamptz)
  to service_role;

comment on function public.wallet_open_outside(uuid, uuid, integer, integer, integer, text, boolean, uuid, text, text, integer, timestamptz) is
  'MESITA-3544 Wallet: opens a bill paid outside Mesita, holding its credit part (wallet_balance counts it); waits for the waiter''s Received. Replays by request_id: already_paid, in_progress, a new open on a failed or expired row, else taken. Service role only.';

-- ── 5. The waiter's Received ────────────────────────────────────────────────
-- Under the row lock and the pair lock: the hold becomes the spend entry
-- (Available at once), and floor(outside_cents * outside_cashback_bps /
-- 10000) lands as cashback one hour after paid_at, same place only. The tip
-- never earns. A second tap answers already_paid and writes nothing; a row
-- past its expiry closes as expired with nothing born.
create or replace function public.wallet_confirm_outside(p_payment_id uuid, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_payments;
  v_cashback integer;
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
    return jsonb_build_object('ok', false, 'code', 'closed', 'status', v.status);
  end if;
  if v.expires_at is not null and v.expires_at <= p_now then
    update public.wallet_payments set status = 'expired', updated_at = now() where id = v.id;
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;

  perform public.wallet_lock(v.consumer_id, v.place_id);
  v_cashback := (v.outside_cents * v.outside_cashback_bps) / 10000;

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

revoke all on function public.wallet_confirm_outside(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.wallet_confirm_outside(uuid, timestamptz) to service_role;

comment on function public.wallet_confirm_outside(uuid, timestamptz) is
  'MESITA-3544 Wallet: the waiter''s Received on a bill paid outside: paid (confirmed_by waiter), the hold becomes its spend entry, bps(outside_cents, outside_cashback_bps) lands as cashback one hour later; idempotent (already_paid); past its expiry it closes expired with nothing born. Service role only.';

-- ── 6. Unconfirmed outside bills expire with nothing ────────────────────────
create or replace function public.wallet_expire_outside(p_now timestamptz default now())
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_n integer;
begin
  update public.wallet_payments
     set status = 'expired', updated_at = now()
   where outside_cents > 0 and status in ('opening', 'open')
     and expires_at is not null and expires_at <= p_now;
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;

revoke all on function public.wallet_expire_outside(timestamptz) from public, anon, authenticated;
grant execute on function public.wallet_expire_outside(timestamptz) to service_role;

comment on function public.wallet_expire_outside(timestamptz) is
  'MESITA-3544 Wallet: closes every outside bill nobody confirmed by its expiry as expired, releasing its hold; writes no entry. Run by place_charges_sweep. Service role only.';

-- The cron's sweep expires those first, so a charge bound to one frees its code.
create or replace function public.place_charges_sweep()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_n integer;
begin
  perform public.wallet_expire_outside();
  delete from public.place_charges c
   where (c.paid_at is not null and c.paid_at < now() - interval '24 hours')
      or (c.paid_at is null and c.payment_id is null and c.expires_at < now())
      or (c.paid_at is null and c.expires_at < now() and exists (
            select 1 from public.wallet_payments p
             where p.id = c.payment_id and p.status in ('failed', 'expired')));
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;

revoke all on function public.place_charges_sweep() from public, anon, authenticated;
grant execute on function public.place_charges_sweep() to service_role;

-- ── 7. The Stripe cron never sees an outside bill ───────────────────────────
-- (An outside row has no Checkout session: the cron would fail it as
-- no_session.) Same body as MESITA-3305, plus `outside_cents = 0`.
create or replace function public.wallet_settle_batch(p_limit integer)
 returns table (
   kind text, id uuid, consumer_id uuid, place_id uuid, stripe_checkout_session_id text,
   stripe_account_id text, created_at timestamptz, expires_at timestamptz, settle_tries integer,
   status text, voucher text, livemode boolean)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  return query
  with p as (
    select wp.id from public.wallet_purchases wp
     where wp.status in ('opening', 'open')
     order by wp.created_at
     limit greatest(p_limit, 0)
     for update skip locked
  ), pu as (
    update public.wallet_purchases wp
       set settle_tries = wp.settle_tries + 1, updated_at = now()
      from p where wp.id = p.id
    returning 'purchase'::text as kind, wp.id, wp.consumer_id, wp.place_id, wp.stripe_checkout_session_id,
              wp.stripe_account_id, wp.created_at, null::timestamptz as expires_at, wp.settle_tries,
              wp.status, wp.voucher, wp.livemode
  ), y as (
    select wy.id from public.wallet_payments wy
     where wy.status in ('opening', 'open') and wy.outside_cents = 0
     order by wy.created_at
     limit greatest(p_limit, 0)
     for update skip locked
  ), yu as (
    update public.wallet_payments wy
       set settle_tries = wy.settle_tries + 1, updated_at = now()
      from y where wy.id = y.id
    returning 'payment'::text as kind, wy.id, wy.consumer_id, wy.place_id, wy.stripe_checkout_session_id,
              wy.stripe_account_id, wy.created_at, wy.expires_at, wy.settle_tries,
              wy.status, null::text as voucher, wy.livemode
  )
  select * from pu
  union all
  select * from yu
  order by created_at;
end;
$function$;

revoke all on function public.wallet_settle_batch(integer) from public, anon, authenticated;
grant execute on function public.wallet_settle_batch(integer) to service_role;

comment on function public.wallet_settle_batch(integer) is
  'MESITA-3305 Wallet: the cron''s batch: up to p_limit open purchases and p_limit open payments with no outside part (MESITA-3544), oldest first, for update skip locked, settle_tries bumped. Service role only.';

-- ── 8. Post-flight ──────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from public.wallet_payments where paid_at is not null and confirmed_by is null) then
    raise exception 'a paid payment has no confirmer after the backfill';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'wallet_payments_confirmed_by') then
    raise exception 'the confirmed_by trigger is missing after apply';
  end if;
end $$;
