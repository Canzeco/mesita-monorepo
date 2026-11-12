-- MESITA-3772 — One open guest payment at a time; the waiter's signature
-- turns cashback on, card too; the guest can close their own payment.
--
-- 1. A guest holds at most ONE open guest payment, across every place, per
--    money mode. Open = origin guest, not signed (verified_at null), status
--    paying or paid, window not over (expires_at > now). A second tap is
--    refused too_many_open and the refusal names the open one (open_tab_id,
--    open_place_id). A replay of the same tap still answers its own tab.
-- 2. Cashback only on signing. A card part of an unsigned guest tab settles
--    with no cashback (cashback_cents 0); the waiter's Verify writes it for
--    every settled card part (plus the cash 2% as before). A card that
--    settles after the signature earns at settle, as before. One cashback
--    entry per payment row, ever (a unique index; no live row has two).
-- 3. The guest closes: pay_tab_change mode 'close' on the guest's own guest
--    tab cancels it when nothing moved (as cancel does today), else ends it
--    now with the cron's closing logic (cash expires not_verified, the
--    declared credit is spent, no cashback). A signed tab answers verified.
--
--   pay_tab_guest_end(...)        the closing logic, shared by the cron and
--                                 the guest's close (internal)
--   pay_tab_card_cashback(...)    the card cashback a signature writes
--                                 (internal)
--   pay_tab_guest_pay, wallet_settle_payment, pay_tab_verify,
--   pay_tab_change, pay_tabs_close_guest   redefined
--
-- Past rows are not touched: no backfill, no claw-back.

-- ── 1. Indexes ──────────────────────────────────────────────────────────────
-- The open-payment count reads a guest's unsigned guest tabs.
create index if not exists pay_tabs_guest_open on public.pay_tabs (consumer_id, livemode)
  where origin = 'guest' and verified_at is null;

-- One cashback entry per payment row (settle, Verify and confirm_outside
-- all write at most one; this makes it a rule).
create unique index if not exists wallet_entries_cashback_once on public.wallet_entries (payment_id)
  where kind = 'cashback';

-- ── 2. The closing logic, one copy ─────────────────────────────────────────
-- The caller holds the pair lock. A tab still paying, unsigned, with no card
-- in flight: its unpaid cash row expires (not_verified), the credit declared
-- with it is spent anyway (never for a row the guest cancelled), and the tab
-- reads paid when any part was paid, else expired. Answers whether it acted.
create or replace function public.pay_tab_guest_end(p_tab_id uuid, p_now timestamptz default now())
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.pay_tabs;
  w public.wallet_payments;
  v_res jsonb;
  v_pay uuid;
begin
  select * into v from public.pay_tabs where id = p_tab_id for update;
  if not found or v.origin <> 'guest' or v.status <> 'paying' or v.verified_at is not null then
    return false;
  end if;
  if exists (select 1 from public.wallet_payments
              where tab_id = v.id and part = 'card' and status in ('opening', 'open')) then
    return false;
  end if;

  select * into w from public.wallet_payments
   where tab_id = v.id and part = 'outside' and paid_at is null
   order by created_at desc limit 1
   for update;
  if found then
    if w.status in ('opening', 'open') then
      update public.wallet_payments set status = 'expired', stripe_error = coalesce(stripe_error, 'not_verified'), updated_at = now()
       where id = w.id;
    end if;
    if w.credit_cents > 0 and coalesce(w.stripe_error, '') <> 'cancelled' then
      v_res := public.wallet_pay_credit(v.consumer_id, v.place_id, w.credit_cents, v.currency, v.livemode,
        md5(v.id::text || ':close')::uuid, null, v.ticket);
      if coalesce((v_res ->> 'ok')::boolean, false) then
        v_pay := (v_res ->> 'payment_id')::uuid;
        update public.wallet_payments set tab_id = v.id, part = 'credit', charge_amount_cents = v.bill_cents
         where id = v_pay and tab_id is null;
      end if;
    end if;
  end if;

  update public.pay_tabs t
     set status = case when exists (select 1 from public.wallet_payments p where p.tab_id = t.id and p.paid_at is not null)
                       then 'paid' else 'expired' end,
         paid_at = case when exists (select 1 from public.wallet_payments p where p.tab_id = t.id and p.paid_at is not null)
                        then coalesce(t.paid_at, p_now) end,
         updated_at = now()
   where t.id = v.id;
  return true;
end;
$function$;

-- ── 3. The card cashback a signature writes ────────────────────────────────
-- Every settled card part of the tab that has no cashback entry yet:
-- floor(card_cents * cashback_bps / 10000), Available an hour later, as
-- settle wrote it before. Answers the total written.
create or replace function public.pay_tab_card_cashback(p_tab_id uuid, p_now timestamptz default now())
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  w public.wallet_payments;
  c integer;
  v_total integer := 0;
begin
  for w in
    select * from public.wallet_payments
     where tab_id = p_tab_id and part = 'card' and paid_at is not null and status in ('paid', 'partly_refunded')
     order by created_at
     for update
  loop
    continue when exists (select 1 from public.wallet_entries e where e.payment_id = w.id and e.kind = 'cashback');
    c := (w.card_cents * w.cashback_bps) / 10000;
    continue when c <= 0;
    update public.wallet_payments set cashback_cents = c, updated_at = now() where id = w.id;
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
    values (w.consumer_id, w.place_id, 'cashback', c, w.currency, w.id, w.livemode, p_now + interval '1 hour');
    v_total := v_total + c;
  end loop;
  return v_total;
end;
$function$;

-- ── 4. Settling a card part: no cashback before the signature ──────────────
create or replace function public.wallet_settle_payment(p_payment_id uuid, p_payment_intent text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_payments;
  v_cashback integer;
  v_paid_at timestamptz := now();
begin
  select * into v from public.wallet_payments where id = p_payment_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.paid_at is not null then
    return jsonb_build_object('ok', true, 'outcome', 'already_paid', 'payment_id', v.id, 'status', v.status,
      'credit_cents', v.credit_cents, 'card_cents', v.card_cents, 'tip_cents', v.tip_cents,
      'cashback_cents', v.cashback_cents, 'currency', v.currency, 'paid_at', v.paid_at, 'proof_token', v.proof_token);
  end if;
  if v.status in ('failed', 'expired', 'needs_review') then
    update public.wallet_payments
       set stripe_error = 'late_completion',
           stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id),
           status = 'needs_review', updated_at = now()
     where id = v.id;
    return jsonb_build_object('ok', true, 'outcome', 'late_completion', 'payment_id', v.id, 'was', v.status);
  end if;

  perform public.wallet_lock(v.consumer_id, v.place_id);
  v_cashback := (v.card_cents * v.cashback_bps) / 10000;
  -- MESITA-3772: a guest tab's card earns only once the waiter signs it
  -- (pay_tab_verify writes it then). Verify runs under the same pair lock.
  if v_cashback > 0 and v.tab_id is not null
     and exists (select 1 from public.pay_tabs t where t.id = v.tab_id and t.origin = 'guest' and t.verified_at is null) then
    v_cashback := 0;
  end if;
  if v_cashback > 0 and exists (select 1 from public.wallet_entries e where e.payment_id = v.id and e.kind = 'cashback') then
    v_cashback := 0;
  end if;

  update public.wallet_payments
     set status = 'paid', paid_at = v_paid_at, updated_at = now(),
         stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id),
         cashback_cents = v_cashback, stripe_error = null
   where id = v.id;

  if v.credit_cents > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'spend', -v.credit_cents, v.currency, v.id, v.livemode, v_paid_at);
  end if;
  if v_cashback > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'cashback', v_cashback, v.currency, v.id, v.livemode, v_paid_at + interval '1 hour');
  end if;

  return jsonb_build_object('ok', true, 'outcome', 'paid', 'payment_id', v.id, 'status', 'paid',
    'credit_cents', v.credit_cents, 'card_cents', v.card_cents, 'tip_cents', v.tip_cents,
    'cashback_cents', v_cashback, 'currency', v.currency, 'paid_at', v_paid_at, 'proof_token', v.proof_token);
end;
$function$;

comment on function public.wallet_settle_payment(uuid, text) is
  'MESITA-3305, MESITA-3772 Wallet: marks a mixed payment paid, turns the hold into its spend entry and writes bps(card_cents, cashback_bps) as cashback one hour later, except on an unsigned guest tab (the signature writes it); idempotent (already_paid, one cashback entry per row); a failed, expired or needs_review row gets stripe_error late_completion and no credit. Service role only.';

-- ── 5. The guest's tap: one open guest payment, everywhere ─────────────────
create or replace function public.pay_tab_guest_pay(
  p_consumer_id uuid, p_place_id uuid, p_currency text, p_livemode boolean, p_token_hash text,
  p_bill_cents integer,
  p_credit_cents integer, p_cash_bill_cents integer, p_cash_tip_cents integer,
  p_card_bill_cents integer, p_card_tip_cents integer,
  p_request_id uuid, p_proof_token text, p_outside_cashback_bps integer,
  p_now timestamptz default now(),
  p_stripe_account_id text default null, p_card_fee_cents integer default 0,
  p_card_cashback_bps integer default 0, p_card_proof_token text default null,
  p_card_expires_at timestamptz default null,
  p_window interval default interval '3 hours', p_max_open integer default 3)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.pay_tabs;
  o public.pay_tabs;
  v_res jsonb;
  v_expires timestamptz := p_now + p_window;
  v_card uuid;
begin
  if p_consumer_id is null or p_place_id is null or p_token_hash is null or p_request_id is null then
    raise exception 'pay_tab_guest_pay: consumer, place, token and request_id are required';
  end if;
  if p_bill_cents is null or p_bill_cents <= 0 or p_bill_cents > 10000000 then
    raise exception 'guest_refused:%', jsonb_build_object('code', 'amount_required');
  end if;
  perform public.wallet_lock(p_consumer_id, p_place_id);
  -- MESITA-3772: the one-open rule spans places, so two taps at two places
  -- serialize on the guest too (only this function takes this lock).
  perform pg_advisory_xact_lock(hashtextextended('pay_tab_guest_open:' || p_consumer_id::text, 0));

  -- The same tap again (a lost answer): its tab, with this call's QR.
  select * into v from public.pay_tabs
   where consumer_id = p_consumer_id and place_id = p_place_id and pay_request_id = p_request_id and origin = 'guest'
   for update;
  if found then
    if v.verified_at is null and v.status in ('paying', 'paid') and v.expires_at > p_now then
      update public.pay_tabs set token_hash = p_token_hash, updated_at = now() where id = v.id;
    end if;
    select id into v_card from public.wallet_payments where tab_id = v.id and part = 'card'
     order by created_at desc limit 1;
    return jsonb_build_object('ok', true, 'outcome', 'replayed', 'tab_id', v.id, 'status', v.status,
      'card_payment_id', v_card, 'expires_at', v.expires_at);
  end if;

  -- One open guest payment per guest per money mode, at any place. The
  -- rule is one; p_max_open is kept for old callers and ignored.
  select * into o from public.pay_tabs
   where consumer_id = p_consumer_id and livemode = p_livemode
     and origin = 'guest' and verified_at is null
     and status in ('paying', 'paid') and expires_at > p_now
   order by created_at desc
   limit 1;
  if found then
    raise exception 'guest_refused:%', jsonb_build_object('code', 'too_many_open', 'max_open', 1,
      'open_tab_id', o.id, 'open_place_id', o.place_id);
  end if;

  -- The guest's own waiter tab still waiting for a bill here is stale now.
  update public.pay_tabs set status = 'cancelled', updated_at = now()
   where consumer_id = p_consumer_id and place_id = p_place_id and livemode = p_livemode
     and origin = 'waiter' and status = 'waiting_bill' and parent_tab_id is null;

  insert into public.pay_tabs (place_id, consumer_id, token_hash, status, currency, livemode, bill_cents,
                               tip_cents, bill_version, billed_at, pay_request_id, expires_at, origin)
  values (p_place_id, p_consumer_id, p_token_hash, 'billed', lower(p_currency), p_livemode, p_bill_cents,
          coalesce(p_cash_tip_cents, 0) + coalesce(p_card_tip_cents, 0), 1, p_now, p_request_id, v_expires, 'guest')
  returning * into v;

  -- The waiter's two-a-day outside limit does not count guest tabs (the
  -- daily cashback caps bound them): a large limit here.
  v_res := public.pay_tab_open_parts(v.id, p_consumer_id, 1,
    p_credit_cents, p_cash_bill_cents, p_cash_tip_cents, p_card_bill_cents, p_card_tip_cents,
    p_request_id, p_proof_token, p_outside_cashback_bps, 1000000, p_now,
    p_stripe_account_id, p_card_fee_cents, p_card_cashback_bps, p_card_proof_token, p_card_expires_at);
  if not coalesce((v_res ->> 'ok')::boolean, false) then
    raise exception 'guest_refused:%', v_res;
  end if;

  -- The Verify window is fixed: the tab and its cash row close together.
  update public.pay_tabs set expires_at = v_expires, updated_at = now() where id = v.id;
  update public.wallet_payments set expires_at = v_expires, updated_at = now()
   where tab_id = v.id and part = 'outside' and status in ('opening', 'open');

  select * into v from public.pay_tabs where id = v.id;
  return v_res || jsonb_build_object('tab_id', v.id, 'status', v.status, 'expires_at', v.expires_at, 'origin', 'guest');
end;
$function$;

comment on function public.pay_tab_guest_pay(uuid, uuid, text, boolean, text, integer, integer, integer, integer, integer, integer, uuid, text, integer, timestamptz, text, integer, integer, text, timestamptz, interval, integer) is
  'MESITA-3707, MESITA-3772: the guest''s tap. One guest tab per request id; one open (unsigned, paying or paid, in its window) guest payment per guest per money mode at any place, else too_many_open naming open_tab_id; any refusal raises guest_refused:<json> so nothing survives. Service role only.';

-- ── 6. Cancel or close: the guest ends their own guest tab ─────────────────
create or replace function public.pay_tab_change(p_tab_id uuid, p_consumer_id uuid, p_mode text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.pay_tabs;
begin
  select * into v from public.pay_tabs where id = p_tab_id;
  if not found or v.consumer_id is distinct from p_consumer_id then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  perform public.wallet_lock(p_consumer_id, v.place_id);
  select * into v from public.pay_tabs where id = p_tab_id for update;

  if v.origin = 'guest' then
    -- A guest tab is paid as the guest tapped it; it is never billed again.
    -- cancel: only while nothing moved. close (MESITA-3772): cancels when
    -- nothing moved, else ends it now as the cron would, with no cashback.
    if p_mode not in ('cancel', 'close') then
      return jsonb_build_object('ok', false, 'code', 'guest_tab');
    end if;
    if v.status = 'cancelled' then
      return jsonb_build_object('ok', true, 'outcome', 'cancelled', 'tab_id', v.id);
    end if;
    if v.verified_at is not null then
      return jsonb_build_object('ok', false, 'code', 'verified', 'verified_at', v.verified_at);
    end if;
    if v.status = 'expired' and p_mode = 'close' then
      return jsonb_build_object('ok', true, 'outcome', 'closed', 'tab_id', v.id);
    end if;
    if v.status not in ('paying', 'paid') then
      return jsonb_build_object('ok', false, 'code', v.status);
    end if;
    if exists (select 1 from public.wallet_payments where tab_id = v.id and part = 'card' and status in ('opening', 'open')) then
      return jsonb_build_object('ok', false, 'code', 'card_pending');
    end if;

    if not exists (select 1 from public.wallet_payments where tab_id = v.id and paid_at is not null) then
      if v.status <> 'paying' then
        return jsonb_build_object('ok', false, 'code', v.status);
      end if;
      update public.wallet_payments set status = 'expired', stripe_error = 'cancelled', updated_at = now()
       where tab_id = v.id and status in ('opening', 'open');
      update public.pay_tabs set status = 'cancelled', updated_at = now() where id = v.id;
      return jsonb_build_object('ok', true, 'outcome', 'cancelled', 'tab_id', v.id);
    end if;

    -- Money moved and nobody signed.
    if p_mode = 'cancel' then
      return jsonb_build_object('ok', false, 'code', 'paid_part');
    end if;
    if v.expires_at > now() then
      update public.pay_tabs set expires_at = now(), updated_at = now() where id = v.id;
    end if;
    perform public.pay_tab_guest_end(v.id, now());
    return jsonb_build_object('ok', true, 'outcome', 'closed', 'tab_id', v.id);
  end if;

  if p_mode = 'cancel' then
    if v.status in ('waiting_bill', 'billed') then
      update public.pay_tabs set status = 'cancelled', updated_at = now() where id = v.id;
      return jsonb_build_object('ok', true, 'outcome', 'cancelled', 'tab_id', v.id);
    end if;
    if v.status = 'cancelled' then
      return jsonb_build_object('ok', true, 'outcome', 'cancelled', 'tab_id', v.id);
    end if;
    return jsonb_build_object('ok', false, 'code', v.status);
  elsif p_mode = 'change' then
    if v.status <> 'paying' then
      return jsonb_build_object('ok', false, 'code', v.status);
    end if;
    if exists (select 1 from public.wallet_payments where tab_id = v.id and paid_at is not null) then
      return jsonb_build_object('ok', false, 'code', 'paid_part');
    end if;
    update public.wallet_payments set status = 'expired', stripe_error = 'cancelled', updated_at = now()
     where tab_id = v.id and status in ('opening', 'open');
    update public.pay_tabs
       set status = 'billed', pay_request_id = null, paying_at = null,
           credit_cents = 0, cash_bill_cents = 0, cash_tip_cents = 0, card_bill_cents = 0, card_tip_cents = 0,
           updated_at = now()
     where id = v.id;
    return jsonb_build_object('ok', true, 'outcome', 'billed', 'tab_id', v.id, 'bill_version', v.bill_version);
  elsif p_mode = 'close' then
    return jsonb_build_object('ok', false, 'code', 'not_guest');
  end if;
  raise exception 'pay_tab_change: mode must be cancel, change or close';
end;
$function$;

-- ── 7. The waiter's Verify: the signature turns cashback on ────────────────
create or replace function public.pay_tab_verify(
  p_tab_id uuid, p_place_id uuid, p_staff_key_hash text, p_received_cents integer default null,
  p_now timestamptz default now())
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
  v_cashback integer := 0;
  v_card_back integer := 0;
begin
  if p_staff_key_hash is null or p_staff_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'pay_tab_verify: a staff key hash is required';
  end if;
  select * into v from public.pay_tabs where id = p_tab_id;
  if not found or v.origin <> 'guest' then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.place_id is distinct from p_place_id then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);
  select * into v from public.pay_tabs where id = p_tab_id for update;

  if v.verified_at is not null then
    return jsonb_build_object('ok', true, 'outcome', 'already_verified', 'tab_id', v.id,
      'verified_at', v.verified_at, 'same_phone', v.verified_key_hash = p_staff_key_hash);
  end if;
  if v.status in ('cancelled', 'expired') then
    return jsonb_build_object('ok', false, 'code', v.status);
  end if;
  if v.expires_at <= p_now then
    return jsonb_build_object('ok', false, 'code', 'expired', 'expires_at', v.expires_at);
  end if;
  if exists (select 1 from public.wallet_payments where tab_id = v.id and part = 'card' and status in ('opening', 'open')) then
    return jsonb_build_object('ok', false, 'code', 'card_pending');
  end if;

  if v.status = 'paying' and v.cash_bill_cents + v.cash_tip_cents > 0 then
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
        return v_res;
      end if;
      v_cashback := coalesce((v_res ->> 'cashback_cents')::int, 0);
    end if;
    update public.pay_tabs
       set status = 'paid', paid_at = coalesce(paid_at, p_now), cash_received_cents = v_received, cash_tip_cents = v_tip,
           verified_at = p_now, verified_key_hash = p_staff_key_hash, updated_at = now()
     where id = v.id;
    -- MESITA-3772: the card parts already settled earn now.
    v_card_back := public.pay_tab_card_cashback(v.id, p_now);
    return jsonb_build_object('ok', true, 'outcome', 'verified', 'tab_id', v.id, 'verified_at', p_now,
      'cash_received_cents', v_received, 'cash_tip_cents', v_tip, 'cashback_cents', v_cashback + v_card_back,
      'card_cashback_cents', v_card_back);
  end if;

  if v.status = 'paid' then
    update public.pay_tabs set verified_at = p_now, verified_key_hash = p_staff_key_hash, updated_at = now()
     where id = v.id;
    v_card_back := public.pay_tab_card_cashback(v.id, p_now);
    return jsonb_build_object('ok', true, 'outcome', 'verified', 'tab_id', v.id, 'verified_at', p_now,
      'cashback_cents', v_card_back, 'card_cashback_cents', v_card_back);
  end if;
  return jsonb_build_object('ok', false, 'code', 'not_paid', 'status', v.status);
end;
$function$;

-- ── 8. The cron close, through the one copy of the logic ───────────────────
create or replace function public.pay_tabs_close_guest(p_now timestamptz default now(), p_limit integer default 200)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  v public.pay_tabs;
  v_n integer := 0;
begin
  for r in
    select id, consumer_id, place_id from public.pay_tabs
     where origin = 'guest' and status = 'paying' and expires_at <= p_now
     order by expires_at
     limit p_limit
  loop
    perform public.wallet_lock(r.consumer_id, r.place_id);
    select * into v from public.pay_tabs where id = r.id for update;
    continue when v.expires_at > p_now;
    if public.pay_tab_guest_end(v.id, p_now) then
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end;
$function$;

-- ── 9. Access: the service role only; the two helpers are internal ─────────
revoke all on function public.pay_tab_guest_end(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.pay_tab_card_cashback(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.wallet_settle_payment(uuid, text) from public, anon, authenticated;
revoke all on function public.pay_tab_guest_pay(uuid, uuid, text, boolean, text, integer, integer, integer, integer, integer, integer, uuid, text, integer, timestamptz, text, integer, integer, text, timestamptz, interval, integer) from public, anon, authenticated;
revoke all on function public.pay_tab_change(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.pay_tab_verify(uuid, uuid, text, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.pay_tabs_close_guest(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.wallet_settle_payment(uuid, text) to service_role;
grant execute on function public.pay_tab_guest_pay(uuid, uuid, text, boolean, text, integer, integer, integer, integer, integer, integer, uuid, text, integer, timestamptz, text, integer, integer, text, timestamptz, interval, integer) to service_role;
grant execute on function public.pay_tab_change(uuid, uuid, text) to service_role;
grant execute on function public.pay_tab_verify(uuid, uuid, text, integer, timestamptz) to service_role;
grant execute on function public.pay_tabs_close_guest(timestamptz, integer) to service_role;

-- ── 10. Post-flight ─────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'wallet_entries_cashback_once')
     or not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'pay_tabs_guest_open') then
    raise exception 'MESITA-3772 indexes missing after apply';
  end if;
end $$;
