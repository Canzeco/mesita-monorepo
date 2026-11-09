-- MESITA-3507: the Story voucher takes two steps. The guest buys it; its
-- credit stays Pending until staff see the guest's Instagram story at the
-- place and tap Activate on visit.mesita.ai (Pato, MESITA-3506: "first buy
-- it, then ... activate it by posting an instagram story tagging the place
-- and showing it [to] the waiter").
--
--   wallet_purchases.story_token         the activation key behind the
--                                        guest's QR, minted when a Story is
--                                        credited (32 hex, 122 random bits)
--   wallet_purchases.story_activated_at  when staff activated it; set once
--   wallet_credit_purchase(...)          marks a Story paid and mints its
--                                        token but writes NO credit yet, so
--                                        the webhook, the cron and a wallet
--                                        read all hold it the same way
--   wallet_activate_story(token)         staff's tap: writes the voucher and
--                                        bonus entries, Available now, once
--   wallet_refund_purchase(...)          a Story refunded before activation
--                                        had no credit to reverse: it reads
--                                        refunded, never needs_review
--
-- wallet_entries stays append-only: a held Story is the absence of entries,
-- never an entry rewritten later.
--
-- Additive: two nullable columns, two replaced function bodies (same
-- signatures) and one new function. Nothing sells Story before this deploys:
-- until MESITA-3507 every Story buy was refused (needs_instagram).

-- ── 1. The activation columns ───────────────────────────────────────────────
alter table public.wallet_purchases
  add column story_token text unique
    constraint wallet_purchases_story_token_chk check (story_token is null or story_token ~ '^[0-9a-f]{32}$'),
  add column story_activated_at timestamptz;

comment on column public.wallet_purchases.story_token is
  'MESITA-3507: the Story voucher''s activation key (the guest''s QR to visit.mesita.ai/story/<token>), minted by wallet_credit_purchase. Null on every other voucher.';
comment on column public.wallet_purchases.story_activated_at is
  'MESITA-3507: when staff activated the Story voucher after seeing the story; set once by wallet_activate_story.';

-- ── 2. Crediting holds a Story ───────────────────────────────────────────────
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
  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
  values (v.consumer_id, v.place_id, v_kind, v.amount_cents, v.currency, v.id, v.livemode, v_at);
  if v.bonus_cents > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'bonus', v.bonus_cents, v.currency, v.id, v.livemode, v_at);
  end if;

  return jsonb_build_object('ok', true, 'outcome', 'credited');
end;
$function$;

revoke all on function public.wallet_credit_purchase(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.wallet_credit_purchase(uuid, text, timestamptz) to service_role;

comment on function public.wallet_credit_purchase(uuid, text, timestamptz) is
  'MESITA-3302 Wallet: marks a purchase paid and writes its voucher (or prepay) entry and its bonus, Pending until p_available_at; a Story is marked paid with its story_token and gets no entries until wallet_activate_story (MESITA-3507); idempotent (already_paid). Service role only.';

-- ── 3. Staff activate a Story ────────────────────────────────────────────────
-- Once: a second tap (or a second phone) answers the stored time. Only a
-- paid purchase activates; a refunded one is gone. Writes the voucher entry
-- and its bonus, Available now.
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
  if v.bonus_cents > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'bonus', v.bonus_cents, v.currency, v.id, v.livemode, v_at);
  end if;
  update public.wallet_purchases
     set story_activated_at = v_at, updated_at = now()
   where id = v.id;
  v.story_activated_at := v_at;

  return jsonb_build_object('ok', true, 'outcome', 'activated', 'activated_at', v.story_activated_at, 'purchase_id', v.id);
end;
$function$;

revoke all on function public.wallet_activate_story(text) from public, anon, authenticated;
grant execute on function public.wallet_activate_story(text) to service_role;

comment on function public.wallet_activate_story(text) is
  'MESITA-3507: staff saw the guest''s Instagram story; writes the Story voucher''s entry and bonus, Available now. Set once (already_active); gone for an unknown, unpaid or refunded token. Service role only.';

-- ── 4. A refund of a Story nobody activated ─────────────────────────────────
create or replace function public.wallet_refund_purchase(p_purchase_id uuid, p_amount_refunded integer)
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
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'reversal', -v_reversed, v.currency, v.id, v.livemode, now());
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

revoke all on function public.wallet_refund_purchase(uuid, integer) from public, anon, authenticated;
grant execute on function public.wallet_refund_purchase(uuid, integer) to service_role;

comment on function public.wallet_refund_purchase(uuid, integer) is
  'MESITA-3302 Wallet: applies Stripe''s cumulative amount_refunded to a purchase: only the delta above refunded_cents is reversed (bonus first), capped at the credit the guest still holds; the rest is uncovered_cents and needs_review; a Story refunded before activation had no credit and reverses nothing (MESITA-3507). Replay-safe. Service role only.';
