-- MESITA-3460: a lost dispute takes the cashback back like a refund.
--
-- The Connect receiver now handles charge.dispute.closed: on a lost close it
-- reads the charge's current amount_refunded from Stripe and hands
-- min(charge amount, amount_refunded + dispute.amount) to the same refund
-- RPCs, with p_reason 'dispute_lost'. The arithmetic does not change; the
-- reversal entry it writes now says why. No new status: a fully lost
-- dispute reads refunded. wallet_note_fee_refund stays as it is.
--
--   1. wallet_entries.reason: null on every other kind; on a reversal,
--      'refund' or 'dispute_lost' (reversals written before today read null).
--   2. The two-argument refund RPCs are dropped; the three-argument ones
--      default p_reason to 'refund', so a caller that names two arguments
--      still resolves. Service role only.

-- ── 1. Why a reversal happened ─────────────────────────────────────────────
alter table public.wallet_entries add column if not exists reason text;

alter table public.wallet_entries drop constraint if exists wallet_entries_reason_chk;
alter table public.wallet_entries add constraint wallet_entries_reason_chk check (
  reason is null or (kind = 'reversal' and reason in ('refund', 'dispute_lost'))
);

comment on column public.wallet_entries.reason is
  'MESITA-3460: why a reversal was written: refund (Stripe refunded the charge) or dispute_lost (the card holder won a dispute). Null on every other kind and on reversals written before 2026-11-09.';

-- ── 2. The refund RPCs take a reason ───────────────────────────────────────
drop function if exists public.wallet_refund_payment(uuid, integer);
drop function if exists public.wallet_refund_purchase(uuid, integer);

create or replace function public.wallet_refund_payment(p_payment_id uuid, p_amount_refunded integer, p_reason text default 'refund')
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_payments;
  v_ceiling integer;
  v_new_refunded integer;
  v_delta integer;
  v_card_refunded integer;
  v_tip_refunded integer;
  v_target integer := 0;
  v_done integer;
  v_to_reverse integer := 0;
  v_unspent integer;
  v_reversed integer := 0;
  v_status text;
begin
  if p_amount_refunded is null or p_amount_refunded < 0 then
    return jsonb_build_object('ok', false, 'code', 'bad_amount');
  end if;
  if p_reason is null or p_reason not in ('refund', 'dispute_lost') then
    return jsonb_build_object('ok', false, 'code', 'bad_reason');
  end if;
  select * into v from public.wallet_payments where id = p_payment_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.paid_at is null then
    return jsonb_build_object('ok', false, 'code', 'not_paid');
  end if;
  v_ceiling := v.card_cents + v.tip_cents;
  v_new_refunded := least(p_amount_refunded, v_ceiling);
  v_delta := v_new_refunded - v.refunded_cents;
  if v_delta <= 0 then
    return jsonb_build_object('ok', true, 'outcome', 'already_applied', 'refunded_cents', v.refunded_cents);
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);

  v_card_refunded := least(v_new_refunded, v.card_cents);
  v_tip_refunded := v_new_refunded - v_card_refunded;

  if v.cashback_cents > 0 and v.card_cents > 0 then
    v_target := case when v_card_refunded >= v.card_cents then v.cashback_cents
                     else (v.cashback_cents * v_card_refunded) / v.card_cents end;
    v_done := coalesce((select -sum(amount_cents) from public.wallet_entries
                         where payment_id = v.id and kind = 'reversal'), 0) + v.uncovered_cents;
    v_to_reverse := greatest(v_target - v_done, 0);
    if v_to_reverse > 0 then
      select greatest(available_cents + pending_cents, 0) into v_unspent
        from public.wallet_balance(v.consumer_id, v.place_id, v.currency, v.livemode, now());
      v_reversed := least(v_to_reverse, v_unspent);
      if v_reversed > 0 then
        insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at, reason)
        values (v.consumer_id, v.place_id, 'reversal', -v_reversed, v.currency, v.id, v.livemode, now(), p_reason);
      end if;
    end if;
  end if;

  v_status := case
    when v.uncovered_cents + (v_to_reverse - v_reversed) > 0 then 'needs_review'
    when v_new_refunded >= v_ceiling then 'refunded'
    else 'partly_refunded'
  end;

  update public.wallet_payments
     set refunded_cents = v_new_refunded,
         tip_refunded_cents = v_tip_refunded,
         uncovered_cents = uncovered_cents + (v_to_reverse - v_reversed),
         status = v_status,
         updated_at = now()
   where id = v.id;

  return jsonb_build_object('ok', true, 'outcome', 'applied', 'delta_cents', v_delta,
    'card_refunded_cents', v_card_refunded, 'tip_refunded_cents', v_tip_refunded,
    'reversed_cents', v_reversed, 'uncovered_cents', v_to_reverse - v_reversed, 'status', v_status);
end;
$function$;

revoke all on function public.wallet_refund_payment(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.wallet_refund_payment(uuid, integer, text) to service_role;

comment on function public.wallet_refund_payment(uuid, integer, text) is
  'MESITA-3305 Wallet: applies Stripe''s cumulative amount_refunded over card + tip: card first, then tip; the refunded share of the card part takes back that share of the cashback (all of it on a full card refund), capped at the credit the guest still holds; the rest is uncovered_cents and needs_review. p_reason (refund | dispute_lost, MESITA-3460) is stored on the reversal entry; a lost dispute passes amount_refunded + the disputed amount. Replay-safe. Service role only.';

create or replace function public.wallet_refund_purchase(p_purchase_id uuid, p_amount_refunded integer, p_reason text default 'refund')
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_purchases;
  v_new_refunded integer;
  v_delta integer;
  v_target integer;
  v_done integer;
  v_to_reverse integer;
  v_unspent integer;
  v_reversed integer;
  v_status text;
begin
  if p_amount_refunded is null or p_amount_refunded < 0 then
    return jsonb_build_object('ok', false, 'code', 'bad_amount');
  end if;
  if p_reason is null or p_reason not in ('refund', 'dispute_lost') then
    return jsonb_build_object('ok', false, 'code', 'bad_reason');
  end if;
  select * into v from public.wallet_purchases where id = p_purchase_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.status not in ('paid', 'refunded', 'partly_refunded', 'needs_review') then
    return jsonb_build_object('ok', false, 'code', 'not_paid');
  end if;
  v_new_refunded := least(p_amount_refunded, v.amount_cents);
  v_delta := v_new_refunded - v.refunded_cents;
  if v_delta <= 0 then
    return jsonb_build_object('ok', true, 'outcome', 'already_applied', 'refunded_cents', v.refunded_cents);
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);

  -- A Story refunded before staff activated it was never credited
  -- (MESITA-3507): nothing to reverse, nothing uncovered. It can no longer be
  -- activated (wallet_activate_story needs status paid).
  if v.voucher = 'voucher_story' and v.story_activated_at is null then
    v_status := case when v_new_refunded >= v.amount_cents then 'refunded' else 'partly_refunded' end;
    update public.wallet_purchases
       set refunded_cents = v_new_refunded, status = v_status, updated_at = now()
     where id = v.id;
    return jsonb_build_object('ok', true, 'outcome', 'applied', 'delta_cents', v_delta,
      'reversed_cents', 0, 'uncovered_cents', 0, 'status', v_status);
  end if;

  -- What should be gone in total once this refund is applied: the refunded
  -- principal plus the bonus's share of it (all of the bonus on a full
  -- refund). What is already gone: earlier reversals plus what could not be
  -- reversed. The difference is this call's reversal, whatever order the
  -- events arrived in.
  v_target := v_new_refunded + (v.bonus_cents * v_new_refunded) / v.amount_cents;
  v_done := coalesce((select -sum(amount_cents) from public.wallet_entries
                       where purchase_id = v.id and kind = 'reversal'), 0) + v.uncovered_cents;
  v_to_reverse := greatest(v_target - v_done, 0);

  select greatest(available_cents + pending_cents, 0) into v_unspent
    from public.wallet_balance(v.consumer_id, v.place_id, v.currency, v.livemode, now());
  v_reversed := least(v_to_reverse, v_unspent);

  if v_reversed > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at, reason)
    values (v.consumer_id, v.place_id, 'reversal', -v_reversed, v.currency, v.id, v.livemode, now(), p_reason);
  end if;

  v_status := case
    when v.uncovered_cents + (v_to_reverse - v_reversed) > 0 then 'needs_review'
    when v_new_refunded >= v.amount_cents then 'refunded'
    else 'partly_refunded'
  end;
  update public.wallet_purchases
     set refunded_cents = v_new_refunded,
         uncovered_cents = uncovered_cents + (v_to_reverse - v_reversed),
         status = v_status,
         updated_at = now()
   where id = v.id;

  return jsonb_build_object('ok', true, 'outcome', 'applied', 'delta_cents', v_delta,
    'reversed_cents', v_reversed, 'uncovered_cents', v_to_reverse - v_reversed, 'status', v_status);
end;
$function$;

revoke all on function public.wallet_refund_purchase(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.wallet_refund_purchase(uuid, integer, text) to service_role;

comment on function public.wallet_refund_purchase(uuid, integer, text) is
  'MESITA-3302 Wallet: applies Stripe''s cumulative amount_refunded to a purchase: only the delta above refunded_cents is reversed (bonus first), capped at the credit the guest still holds; the rest is uncovered_cents and needs_review; a Story refunded before activation had no credit and reverses nothing (MESITA-3507). p_reason (refund | dispute_lost, MESITA-3460) is stored on the reversal entry. Replay-safe. Service role only.';

-- ── 3. Post-flight ─────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname in ('wallet_refund_payment', 'wallet_refund_purchase')
               and p.pronargs <> 3) then
    raise exception 'a two-argument refund RPC survived';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in ('wallet_refund_payment', 'wallet_refund_purchase')
        and p.pronargs = 3) <> 2 then
    raise exception 'the three-argument refund RPCs are missing after apply';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'wallet_entries_reason_chk') then
    raise exception 'wallet_entries_reason_chk is missing after apply';
  end if;
end $$;
