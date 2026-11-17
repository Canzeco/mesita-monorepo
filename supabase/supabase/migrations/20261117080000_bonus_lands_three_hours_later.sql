-- MESITA-4214: YOUR MONEY NOW, THE BONUS IN 3 HOURS (Pato, 2026-11-17: "Pay
-- now, get X right now, get Y in [3] hours"; Notion Main §8, MESITA-4213).
-- A voucher purchase already writes two ledger lines, the voucher (what the
-- guest paid) and its bonus. Until now both waited for p_available_at. Now
-- the voucher line is Available the moment the purchase is credited, so it
-- can pay that night's bill, and only the bonus waits for p_available_at
-- (the catalog's available_after_sec, 3 hours for every voucher). A meal is
-- shorter than that, so a bonus never pays the bill it was bought at.
-- A Story's lines are written when staff activate it (MESITA-3507): the
-- voucher line at once, its bonus 3 hours later, the same rule.

create or replace function public.wallet_credit_purchase(
  p_purchase_id uuid, p_payment_intent text, p_available_at timestamptz default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_purchases;
  v_kind text;
  v_at timestamptz := coalesce(p_available_at, now());
begin
  select * into v from public.wallet_purchases where id = p_purchase_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.status in ('paid', 'refunded', 'partly_refunded', 'needs_review') then
    return jsonb_build_object('ok', true, 'outcome', 'already_paid');
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);

  -- An expired or failed purchase that Stripe nevertheless paid is still
  -- credited: the guest's money arrived.
  update public.wallet_purchases
     set status = 'paid', paid_at = now(), updated_at = now(),
         stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id)
   where id = p_purchase_id;

  -- A Story waits for staff (MESITA-3507): paid, its activation key minted,
  -- no credit until wallet_activate_story writes it.
  if v.voucher = 'voucher_story' then
    update public.wallet_purchases
       set story_token = coalesce(story_token, replace(gen_random_uuid()::text, '-', ''))
     where id = p_purchase_id;
    return jsonb_build_object('ok', true, 'outcome', 'credited', 'held', true);
  end if;

  v_kind := case when v.voucher is null then 'prepay' else 'voucher' end;
  -- What the guest paid: Available now (MESITA-4214).
  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
  values (v.consumer_id, v.place_id, v_kind, v.amount_cents, v.currency, v.id, v.livemode, least(v_at, now()));
  -- The bonus: Available at p_available_at.
  if v.bonus_cents > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'bonus', v.bonus_cents, v.currency, v.id, v.livemode, v_at);
  end if;

  return jsonb_build_object('ok', true, 'outcome', 'credited');
end;
$function$;

create or replace function public.wallet_activate_story(p_token text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_purchases;
  v_at timestamptz := now();
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then
    return jsonb_build_object('ok', false, 'code', 'gone');
  end if;
  select * into v from public.wallet_purchases
   where story_token = p_token and voucher = 'voucher_story'
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'gone');
  end if;
  if v.story_activated_at is not null then
    return jsonb_build_object('ok', true, 'outcome', 'already_active', 'activated_at', v.story_activated_at, 'purchase_id', v.id);
  end if;
  if v.status <> 'paid' then
    return jsonb_build_object('ok', false, 'code', 'gone');
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);

  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
  values (v.consumer_id, v.place_id, 'voucher', v.amount_cents, v.currency, v.id, v.livemode, v_at);
  -- The bonus 3 hours after activation (MESITA-4214).
  if v.bonus_cents > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'bonus', v.bonus_cents, v.currency, v.id, v.livemode, v_at + interval '3 hours');
  end if;
  update public.wallet_purchases
     set story_activated_at = v_at, updated_at = now()
   where id = v.id;
  v.story_activated_at := v_at;

  return jsonb_build_object('ok', true, 'outcome', 'activated', 'activated_at', v.story_activated_at, 'purchase_id', v.id);
end;
$function$;
