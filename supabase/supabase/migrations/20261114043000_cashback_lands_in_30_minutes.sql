-- MESITA-3835 (Pato, 2026-11-13: "Update all the money landing. In 30
-- minutes, not 1 hr"): cashback turns Available 30 minutes after the bill,
-- not an hour. The two writers of a cashback entry, wallet_grant_cashback
-- (the card and credit parts) and wallet_confirm_outside (the part the waiter
-- confirms), are restated from 20261113220000 with that one interval changed;
-- nothing else in either body moves. Voucher credit's wait is the Edge
-- Functions' (VOUCHER_CATALOG), 30 minutes in the same PR. Entries already
-- written keep their time.

create or replace function public.wallet_grant_cashback(p_payment_id uuid, p_now timestamptz default now())
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  w public.wallet_payments;
  v_card integer;
  v_credit integer;
begin
  select * into w from public.wallet_payments where id = p_payment_id for update;
  if not found or w.paid_at is null or w.status not in ('paid', 'partly_refunded') or w.outside_cents > 0 then
    return 0;
  end if;
  if exists (select 1 from public.wallet_entries e where e.payment_id = w.id and e.kind = 'cashback') then
    return 0;
  end if;
  if w.tab_id is not null
     and exists (select 1 from public.pay_tabs t where t.id = w.tab_id and t.origin = 'guest' and t.verified_at is null) then
    return 0;
  end if;
  v_card := (w.card_cents * w.cashback_bps) / 10000;
  v_credit := (w.credit_cents * w.credit_cashback_bps) / 10000;
  if v_card + v_credit <= 0 then
    return 0;
  end if;
  update public.wallet_payments set cashback_cents = v_card, credit_cashback_cents = v_credit, updated_at = now()
   where id = w.id;
  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
  values (w.consumer_id, w.place_id, 'cashback', v_card + v_credit, w.currency, w.id, w.livemode, p_now + interval '30 minutes');
  return v_card + v_credit;
end;
$function$;

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
  v_mine integer;
  v_credit_back integer;
  c_ceiling constant integer := 50000;
  -- MESITA-3707: a guest tab's cash earns at most $100MX of cashback per
  -- guest per place per day, so one guest cannot take the place's whole day.
  c_guest_cap constant integer := 10000;
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
  if v_cashback > 0 and v.tab_id is not null
     and exists (select 1 from public.pay_tabs t where t.id = v.tab_id and t.origin = 'guest') then
    select coalesce(sum(cashback_cents), 0) into v_mine from public.wallet_payments
     where consumer_id = v.consumer_id and place_id = v.place_id and livemode = v.livemode and outside_cents > 0
       and paid_at is not null and paid_at > p_now - interval '1 day';
    v_cashback := least(v_cashback, greatest(c_guest_cap - v_mine, 0));
  end if;

  -- MESITA-3827: the credit part's cashback, never under the cash caps.
  v_credit_back := (v.credit_cents * v.credit_cashback_bps) / 10000;

  update public.wallet_payments
     set status = 'paid', paid_at = p_now, confirmed_by = 'waiter', cashback_cents = v_cashback,
         credit_cashback_cents = v_credit_back, updated_at = now()
   where id = v.id;

  if v.credit_cents > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'spend', -v.credit_cents, v.currency, v.id, v.livemode, p_now);
  end if;
  if v_cashback + v_credit_back > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'cashback', v_cashback + v_credit_back, v.currency, v.id, v.livemode, p_now + interval '30 minutes');
  end if;

  return jsonb_build_object('ok', true, 'outcome', 'paid', 'payment_id', v.id, 'status', 'paid',
    'credit_cents', v.credit_cents, 'outside_cents', v.outside_cents, 'tip_cents', v.tip_cents,
    'cashback_cents', v_cashback + v_credit_back, 'currency', v.currency, 'paid_at', p_now, 'proof_token', v.proof_token);
end;
$function$;
