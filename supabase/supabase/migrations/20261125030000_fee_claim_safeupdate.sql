-- MESITA-4907: the hourly fee billing failed on every run: "DELETE requires a
-- WHERE clause". The body is 20261109103200's, with that one WHERE.

create or replace function public.place_fee_claim(
  p_place_id uuid, p_livemode boolean, p_currency text,
  p_min_cents integer, p_threshold_cents integer, p_period interval)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_draft public.place_fee_invoices;
  v_owed bigint;
  v_oldest timestamptz;
  v_invoice uuid;
  v_lines integer;
begin
  if p_place_id is null or p_livemode is null or p_currency is null
     or p_min_cents is null or p_threshold_cents is null or p_period is null then
    return jsonb_build_object('ok', false, 'code', 'bad_args');
  end if;
  -- One claim per place at a time.
  perform pg_advisory_xact_lock(hashtextextended('place_fee_claim:' || p_place_id::text, 0));

  -- A draft left by a failed Stripe call is retried as it is.
  select * into v_draft from public.place_fee_invoices
   where place_id = p_place_id and livemode = p_livemode and status = 'draft'
   order by created_at limit 1;
  if found then
    return jsonb_build_object('ok', true, 'outcome', 'draft', 'invoice_id', v_draft.id,
      'amount_cents', v_draft.amount_cents, 'currency', v_draft.currency);
  end if;

  create temporary table if not exists pg_temp.fee_owed (
    payment_id uuid, purchase_id uuid, delta integer, paid_at timestamptz) on commit drop;
  -- safeupdate (PostgREST) refuses a DELETE with no WHERE.
  delete from pg_temp.fee_owed where true;

  insert into pg_temp.fee_owed
  select y.id, null, (y.application_fee_cents - y.fee_refunded_cents) - y.fee_billed_cents, y.paid_at
    from public.wallet_payments y
   where y.place_id = p_place_id and y.livemode = p_livemode and y.currency = p_currency
     and y.paid_at is not null and y.fee_collected = 'invoice'
     and (y.application_fee_cents - y.fee_refunded_cents) <> y.fee_billed_cents
   for update of y;
  insert into pg_temp.fee_owed
  select null, p.id, (p.application_fee_cents - p.fee_refunded_cents) - p.fee_billed_cents, p.paid_at
    from public.wallet_purchases p
   where p.place_id = p_place_id and p.livemode = p_livemode and p.currency = p_currency
     and p.paid_at is not null and p.fee_collected = 'invoice'
     and (p.application_fee_cents - p.fee_refunded_cents) <> p.fee_billed_cents
   for update of p;

  select coalesce(sum(delta), 0), min(paid_at) filter (where delta > 0)
    into v_owed, v_oldest from pg_temp.fee_owed;

  if v_owed < p_min_cents then
    return jsonb_build_object('ok', true, 'outcome', 'below_minimum', 'owed_cents', v_owed);
  end if;
  if v_owed < p_threshold_cents and (v_oldest is null or v_oldest > now() - p_period) then
    return jsonb_build_object('ok', true, 'outcome', 'not_due', 'owed_cents', v_owed);
  end if;

  insert into public.place_fee_invoices (place_id, livemode, currency, amount_cents)
  values (p_place_id, p_livemode, p_currency, v_owed::integer)
  returning id into v_invoice;

  insert into public.place_fee_lines (invoice_id, payment_id, purchase_id, amount_cents)
  select v_invoice, payment_id, purchase_id, delta from pg_temp.fee_owed where delta <> 0;
  get diagnostics v_lines = row_count;

  update public.wallet_payments y set fee_billed_cents = y.fee_billed_cents + o.delta, updated_at = now()
    from pg_temp.fee_owed o where o.payment_id = y.id;
  update public.wallet_purchases p set fee_billed_cents = p.fee_billed_cents + o.delta, updated_at = now()
    from pg_temp.fee_owed o where o.purchase_id = p.id;

  return jsonb_build_object('ok', true, 'outcome', 'claimed', 'invoice_id', v_invoice,
    'amount_cents', v_owed, 'currency', p_currency, 'lines', v_lines);
end;
$function$;
