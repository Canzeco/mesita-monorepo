-- MESITA-3563 — Pay at the table T2b: the card part.
--
-- The guest pays the bill and/or the tip with a saved card inside the app:
-- the EF clones the guest's platform card to the place's connected account,
-- creates the PaymentIntent there (no application fee, MESITA-3461), stores
-- it on the row, then confirms it (3-D Secure through Stripe.js when asked).
-- Settlement is T2a's (MESITA-3568): by PaymentIntent, from the receiver,
-- the cron or the guest's poll, through wallet_settle_payment.
--
--   pay_tab_open_parts(...)   now takes a card part: ONE card row carries
--                             the credit (held), the card bill part and the
--                             card tip; a cash bill part is a second,
--                             outside row with no credit. New trailing
--                             arguments have defaults, so the T1b EF keeps
--                             working through the migration-before-functions
--                             window (no account → card_unavailable, as
--                             before).
--   wallet_open_payment_pi    the PaymentIntent exists: the card row names
--                             it and reads open.
--   pay_tab_cash(...)         Received waits while a card part is in flight
--                             (card_pending): cash is only collected once the
--                             card went through.
--   pay_tabs_follow_parts     a trigger: the last part paid → the tab is paid
--                             (cash still owed waits for Received); a card
--                             part that failed with nothing paid → the other
--                             open part is cancelled and the tab is billed
--                             again, so the guest can choose again.
--   wallet_payments_confirmed_by
--                             a row with a PaymentIntent or a Checkout is
--                             confirmed by Stripe (a card row can carry only
--                             a tip by card).
--
-- Cashback: 5% (cashback_bps) of the card bill part only, never the tip or
-- the credit (wallet_settle_payment's existing rule); Mesita's fee is 5% of
-- the card bill part (application_fee_cents, invoiced). A card tip alone with
-- a bill paid entirely in cash is refused (a card row needs credit or a card
-- bill part: amount_cents > 0).

-- ── 1. The guest's split, with a card part ─────────────────────────────────
drop function public.pay_tab_open_parts(uuid, uuid, integer, integer, integer, integer, integer, integer, uuid, text, integer, integer, timestamptz);

create function public.pay_tab_open_parts(
  p_tab_id uuid, p_consumer_id uuid, p_bill_version integer,
  p_credit_cents integer, p_cash_bill_cents integer, p_cash_tip_cents integer,
  p_card_bill_cents integer, p_card_tip_cents integer,
  p_request_id uuid, p_proof_token text, p_outside_cashback_bps integer, p_max_outside_per_day integer,
  p_now timestamptz default now(),
  p_stripe_account_id text default null, p_card_fee_cents integer default 0,
  p_card_cashback_bps integer default 0, p_card_proof_token text default null,
  p_card_expires_at timestamptz default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.pay_tabs;
  v_count integer;
  v_res jsonb;
  v_pay uuid;
  v_card uuid;
  v_status text;
  v_spendable integer;
  v_card_req uuid;
  v_has_card boolean := coalesce(p_card_bill_cents, 0) > 0 or coalesce(p_card_tip_cents, 0) > 0;
  v_expires timestamptz := p_now + interval '30 minutes';
begin
  if p_tab_id is null or p_consumer_id is null or p_request_id is null then
    raise exception 'pay_tab_open_parts: tab, consumer and request_id are required';
  end if;
  select * into v from public.pay_tabs where id = p_tab_id;
  if not found or v.consumer_id is distinct from p_consumer_id then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  perform public.wallet_lock(p_consumer_id, v.place_id);
  select * into v from public.pay_tabs where id = p_tab_id for update;

  if v.pay_request_id = p_request_id and v.status in ('paying', 'paid') then
    select id into v_card from public.wallet_payments where tab_id = v.id and part = 'card'
     order by created_at desc limit 1;
    return jsonb_build_object('ok', true, 'outcome', 'replayed', 'tab_id', v.id, 'status', v.status,
      'card_payment_id', v_card);
  end if;
  if v.status = 'billed' and v.expires_at <= p_now then
    update public.pay_tabs set status = 'expired', updated_at = now() where id = v.id;
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;
  if v.status <> 'billed' then
    return jsonb_build_object('ok', false, 'code', case when v.status = 'waiting_bill' then 'not_billed'
      when v.status in ('paying', 'paid') then 'paying' else v.status end, 'status', v.status);
  end if;
  if p_bill_version is distinct from v.bill_version then
    return jsonb_build_object('ok', false, 'code', 'stale', 'bill_version', v.bill_version);
  end if;
  if coalesce(p_credit_cents, -1) < 0 or coalesce(p_cash_bill_cents, -1) < 0 or coalesce(p_cash_tip_cents, -1) < 0
     or coalesce(p_card_bill_cents, -1) < 0 or coalesce(p_card_tip_cents, -1) < 0
     or p_credit_cents + p_cash_bill_cents + p_card_bill_cents <> v.bill_cents
     or p_cash_tip_cents + p_card_tip_cents > 10000000 then
    return jsonb_build_object('ok', false, 'code', 'parts', 'bill_cents', v.bill_cents);
  end if;
  if v_has_card and (p_stripe_account_id is null or p_card_expires_at is null) then
    return jsonb_build_object('ok', false, 'code', 'card_unavailable');
  end if;
  if v_has_card and p_credit_cents + p_card_bill_cents = 0 then
    -- A card row carries the credit and the card bill part; a tip by card
    -- alone, with the whole bill in cash, has nothing to ride on.
    return jsonb_build_object('ok', false, 'code', 'card_tip_alone', 'bill_cents', v.bill_cents);
  end if;

  if p_cash_bill_cents > 0 then
    -- The guest's daily limit of outside bills here, counted under the lock.
    select count(*) into v_count from public.wallet_payments
     where consumer_id = p_consumer_id and place_id = v.place_id and livemode = v.livemode
       and outside_cents > 0 and created_at > p_now - interval '1 day'
       and status not in ('expired', 'failed');
    if v_count >= p_max_outside_per_day then
      return jsonb_build_object('ok', false, 'code', 'outside_limit', 'max_per_day', p_max_outside_per_day);
    end if;
  end if;

  if v_has_card then
    -- ONE card row: the credit (held: opening rows count in wallet_balance),
    -- the card bill part and the card tip. Its own request id, derived from
    -- the tap's, so the outside row keeps the tap's.
    select b.spendable_cents into v_spendable
      from public.wallet_balance(p_consumer_id, v.place_id, v.currency, v.livemode) b;
    if p_credit_cents > coalesce(v_spendable, 0) then
      return jsonb_build_object('ok', false, 'code', 'insufficient', 'spendable_cents', coalesce(v_spendable, 0));
    end if;
    v_card_req := md5(p_request_id::text || ':card')::uuid;
    if exists (select 1 from public.wallet_payments where consumer_id = p_consumer_id and request_id = v_card_req) then
      -- The same tap after its card part failed: a new tap starts over.
      return jsonb_build_object('ok', false, 'code', 'closed');
    end if;
    insert into public.wallet_payments (consumer_id, place_id, amount_cents, credit_cents, card_cents, tip_cents,
                                        currency, status, stripe_account_id, application_fee_cents, cashback_bps,
                                        request_id, ticket, proof_token, livemode, expires_at,
                                        tab_id, part, charge_amount_cents)
    values (p_consumer_id, v.place_id, p_credit_cents + p_card_bill_cents, p_credit_cents, p_card_bill_cents,
            p_card_tip_cents, v.currency, 'opening', p_stripe_account_id, greatest(coalesce(p_card_fee_cents, 0), 0),
            least(greatest(coalesce(p_card_cashback_bps, 0), 0), 10000), v_card_req, v.ticket, p_card_proof_token,
            v.livemode, p_card_expires_at, v.id, 'card', v.bill_cents)
    returning id into v_card;
    v_pay := v_card;
    v_status := 'paying';
  end if;

  if p_cash_bill_cents > 0 then
    -- The cash bill part (and any cash tip) is one outside row; with a card
    -- part the credit already rides on the card row.
    v_res := public.wallet_open_outside(p_consumer_id, v.place_id,
      case when v_has_card then 0 else p_credit_cents end, p_cash_bill_cents, p_cash_tip_cents,
      v.currency, v.livemode, p_request_id, p_proof_token, v.ticket, p_outside_cashback_bps, v_expires);
    if not coalesce((v_res ->> 'ok')::boolean, false) or v_res ->> 'outcome' <> 'opened' then
      -- Undo the card row of this call (no Stripe object exists yet).
      if v_card is not null then
        delete from public.wallet_payments where id = v_card and status = 'opening' and stripe_payment_intent_id is null;
      end if;
      return coalesce(v_res, '{}'::jsonb) || jsonb_build_object('ok', false);
    end if;
    update public.wallet_payments set tab_id = v.id, part = 'outside', charge_amount_cents = v.bill_cents
     where id = (v_res ->> 'payment_id')::uuid;
    v_pay := coalesce(v_card, (v_res ->> 'payment_id')::uuid);
    v_status := 'paying';
  elsif not v_has_card then
    -- Credits pay the whole bill now.
    v_res := public.wallet_pay_credit(p_consumer_id, v.place_id, p_credit_cents, v.currency, v.livemode,
      p_request_id, p_proof_token, v.ticket);
    if not coalesce((v_res ->> 'ok')::boolean, false) or v_res ->> 'outcome' <> 'paid' then
      return coalesce(v_res, '{}'::jsonb) || jsonb_build_object('ok', false);
    end if;
    v_pay := (v_res ->> 'payment_id')::uuid;
    update public.wallet_payments set tab_id = v.id, part = 'credit', charge_amount_cents = v.bill_cents
     where id = v_pay;
    -- A cash tip still waits for the waiter's Received.
    v_status := case when p_cash_tip_cents > 0 then 'paying' else 'paid' end;
  end if;

  update public.pay_tabs
     set status = v_status, pay_request_id = p_request_id, paying_at = p_now,
         paid_at = case when v_status = 'paid' then p_now end,
         credit_cents = p_credit_cents, cash_bill_cents = p_cash_bill_cents, cash_tip_cents = p_cash_tip_cents,
         card_bill_cents = p_card_bill_cents, card_tip_cents = p_card_tip_cents,
         expires_at = greatest(v.expires_at, v_expires), updated_at = now()
   where id = v.id;
  return jsonb_build_object('ok', true, 'outcome', 'opened', 'tab_id', v.id, 'status', v_status, 'payment_id', v_pay,
    'card_payment_id', v_card,
    'credit_cents', p_credit_cents, 'cash_bill_cents', p_cash_bill_cents, 'cash_tip_cents', p_cash_tip_cents,
    'card_bill_cents', p_card_bill_cents, 'card_tip_cents', p_card_tip_cents);
end;
$function$;

revoke all on function public.pay_tab_open_parts(uuid, uuid, integer, integer, integer, integer, integer, integer, uuid, text, integer, integer, timestamptz, text, integer, integer, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.pay_tab_open_parts(uuid, uuid, integer, integer, integer, integer, integer, integer, uuid, text, integer, integer, timestamptz, text, integer, integer, text, timestamptz)
  to service_role;

-- ── 2. The PaymentIntent exists ─────────────────────────────────────────────
-- opening → open with the PI named; the same PI again answers ok (a retry
-- of the same tap); a different PI on the row is refused.
create or replace function public.wallet_open_payment_pi(p_payment_id uuid, p_payment_intent text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_payments;
begin
  if p_payment_intent is null or p_payment_intent !~ '^pi_[A-Za-z0-9]+$' then
    return jsonb_build_object('ok', false, 'code', 'bad_payment_intent');
  end if;
  select * into v from public.wallet_payments where id = p_payment_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.stripe_payment_intent_id = p_payment_intent then
    return jsonb_build_object('ok', true, 'outcome', 'unchanged', 'status', v.status);
  end if;
  if v.status <> 'opening' or v.stripe_payment_intent_id is not null or v.stripe_checkout_session_id is not null then
    return jsonb_build_object('ok', false, 'code', 'not_opening', 'status', v.status);
  end if;
  update public.wallet_payments
     set status = 'open', stripe_payment_intent_id = p_payment_intent, updated_at = now()
   where id = v.id;
  return jsonb_build_object('ok', true, 'outcome', 'opened', 'status', 'open');
end;
$function$;

revoke all on function public.wallet_open_payment_pi(uuid, text) from public, anon, authenticated;
grant execute on function public.wallet_open_payment_pi(uuid, text) to service_role;

comment on function public.wallet_open_payment_pi(uuid, text) is
  'MESITA-3563: the in-app card part''s PaymentIntent exists on the connected account: the opening row names it and reads open. Idempotent for the same PI. Service role only.';

-- ── 3. Received waits for the card ──────────────────────────────────────────
create or replace function public.pay_tab_cash(
  p_token_hash text, p_staff_key_hash text, p_received_cents integer, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.pay_tabs;
  w public.wallet_payments;
  v_received integer;
  v_tip integer;
  v_res jsonb;
begin
  select * into v from public.pay_tabs where token_hash = p_token_hash;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);
  select * into v from public.pay_tabs where id = v.id for update;
  if v.staff_key_hash is null or p_staff_key_hash is null or v.staff_key_hash <> p_staff_key_hash then
    return jsonb_build_object('ok', false, 'code', 'staff_key');
  end if;
  if v.status = 'paid' then
    return jsonb_build_object('ok', true, 'outcome', 'already_paid', 'tab_id', v.id,
      'cash_received_cents', v.cash_received_cents);
  end if;
  if v.status <> 'paying' or (v.cash_bill_cents = 0 and v.cash_tip_cents = 0) then
    return jsonb_build_object('ok', false, 'code', 'no_cash', 'status', v.status);
  end if;
  if exists (select 1 from public.wallet_payments where tab_id = v.id and part = 'card' and status in ('opening', 'open')) then
    return jsonb_build_object('ok', false, 'code', 'card_pending');
  end if;

  v_received := coalesce(p_received_cents, v.cash_bill_cents + v.cash_tip_cents);
  if v_received < 0 or v_received > 10000000 then
    return jsonb_build_object('ok', false, 'code', 'amount_required');
  end if;
  if v_received < v.cash_bill_cents then
    return jsonb_build_object('ok', false, 'code', 'short', 'missing_cents', v.cash_bill_cents - v_received,
      'cash_bill_cents', v.cash_bill_cents);
  end if;
  v_tip := least(v.cash_tip_cents, v_received - v.cash_bill_cents);

  if v.cash_bill_cents > 0 then
    select * into w from public.wallet_payments
     where tab_id = v.id and part = 'outside' and status in ('opening', 'open', 'paid')
     order by created_at desc limit 1
     for update;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'expired');
    end if;
    if w.paid_at is null then
      update public.wallet_payments set tip_cents = v_tip, updated_at = now() where id = w.id;
    end if;
    v_res := public.wallet_confirm_outside(w.id, p_now);
    if not coalesce((v_res ->> 'ok')::boolean, false) then
      if v_res ->> 'code' in ('expired', 'closed') then
        update public.pay_tabs set status = 'expired', updated_at = now() where id = v.id;
      end if;
      return v_res;
    end if;
  end if;

  update public.pay_tabs
     set status = 'paid', paid_at = p_now, cash_received_cents = v_received, cash_tip_cents = v_tip, updated_at = now()
   where id = v.id;
  return jsonb_build_object('ok', true, 'outcome', 'paid', 'tab_id', v.id, 'cash_received_cents', v_received,
    'cash_tip_cents', v_tip, 'cashback_cents', coalesce((v_res ->> 'cashback_cents')::int, 0));
end;
$function$;

-- ── 4. The tab follows its parts ────────────────────────────────────────────
create or replace function public.pay_tabs_follow_parts()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.tab_id is null then
    return null;
  end if;
  if old.paid_at is null and new.paid_at is not null then
    -- The last part in flight went through: the tab is paid, unless cash is
    -- still owed (the waiter's Received pays it then).
    update public.pay_tabs t
       set status = 'paid', paid_at = new.paid_at, updated_at = now()
     where t.id = new.tab_id and t.status = 'paying'
       and not exists (select 1 from public.wallet_payments w
                        where w.tab_id = t.id and w.status in ('opening', 'open'))
       and (t.cash_bill_cents + t.cash_tip_cents = 0 or t.cash_received_cents is not null);
  elsif new.part = 'card' and old.status in ('opening', 'open') and new.status in ('failed', 'expired') then
    -- The card part failed and nothing of the tab is paid: the other open
    -- part is cancelled (its credit hold, if any, released) and the tab is
    -- billed again so the guest can choose again.
    if not exists (select 1 from public.wallet_payments w where w.tab_id = new.tab_id and w.paid_at is not null) then
      update public.wallet_payments
         set status = 'expired', stripe_error = coalesce(stripe_error, 'card_failed'), updated_at = now()
       where tab_id = new.tab_id and id <> new.id and status in ('opening', 'open');
      update public.pay_tabs
         set status = 'billed', pay_request_id = null, paying_at = null,
             credit_cents = 0, cash_bill_cents = 0, cash_tip_cents = 0, card_bill_cents = 0, card_tip_cents = 0,
             updated_at = now()
       where id = new.tab_id and status = 'paying';
    end if;
  end if;
  return null;
end;
$function$;

revoke all on function public.pay_tabs_follow_parts() from public, anon, authenticated;

create trigger wallet_payments_tab_follow
  after update of paid_at, status on public.wallet_payments
  for each row execute function public.pay_tabs_follow_parts();

-- ── 5. Who confirmed it ─────────────────────────────────────────────────────
create or replace function public.wallet_payments_confirmed_by()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if new.paid_at is not null and new.confirmed_by is null then
    new.confirmed_by := case
      when new.outside_cents > 0 then 'waiter'
      when new.card_cents > 0 or new.stripe_payment_intent_id is not null
        or new.stripe_checkout_session_id is not null then 'stripe'
      else 'credit'
    end;
  end if;
  return new;
end;
$function$;
