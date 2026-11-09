-- MESITA-3567 — Pay at the table T1a (MESITA-3559): the tab.
--
-- The guest opens a tab at a place and shows its QR; the waiter scans it,
-- types the bill and a tip suggestion; the guest chooses how to pay the bill
-- (credits first, the rest in cash) and the tip (cash; never credits); the
-- waiter types the cash received. Card parts arrive with T2 (MESITA-3563,
-- held until the PaymentMethod clone is proven): the columns are here, the
-- functions refuse a card part (card_unavailable).
--
--   pay_tabs                       one table's bill at one place (EF-only)
--   wallet_payments.tab_id, .part  the tab a payment row pays, and which part
--                                  ('credit' | 'outside' | 'card')
--   pay_tab_open(...)              opens (or reuses) the guest's tab here
--   pay_tab_bill(...)              the waiter's bill, compare-and-set on
--                                  bill_version, until the guest pays
--   pay_tab_open_parts(...)        the guest's split, one transaction under
--                                  the pair lock: billed → paying; credit =
--                                  whole bill and no cash tip → a paid credit
--                                  row; otherwise one outside row holding the
--                                  credit (spent only when the waiter
--                                  confirms); the daily outside limit counted
--                                  under the lock
--   pay_tab_cash(...)              the waiter's Received: covers the cash
--                                  bill part or answers short; a short tip
--                                  comes off the cash tip
--   pay_tab_change(...)            the guest changes how to pay (paying →
--                                  billed, the open outside row cancelled,
--                                  the credit hold released) or cancels the
--                                  tab before paying
--
-- Additive: one new table, two nullable columns, five new functions. The old
-- EFs never read these.

-- ── 1. The tab ──────────────────────────────────────────────────────────────
create table public.pay_tabs (
  id                  uuid primary key default gen_random_uuid(),
  place_id            uuid not null references public.places(id) on delete restrict,
  consumer_id         uuid references public.consumers(id) on delete set null,
  token_hash          text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  status              text not null default 'waiting_bill'
                        check (status in ('waiting_bill', 'billed', 'paying', 'paid', 'expired', 'cancelled')),
  currency            text not null check (currency ~ '^[a-z]{3}$'),
  livemode            boolean not null default false,
  bill_cents          integer check (bill_cents is null or (bill_cents > 0 and bill_cents <= 10000000)),
  tip_cents           integer not null default 0 check (tip_cents >= 0 and tip_cents <= 10000000),
  ticket              text check (ticket is null or char_length(ticket) <= 64),
  bill_version        integer not null default 0 check (bill_version >= 0),
  waiter_name         text check (waiter_name is null or char_length(waiter_name) <= 40),
  staff_key_hash      text check (staff_key_hash is null or staff_key_hash ~ '^[0-9a-f]{64}$'),
  billed_at           timestamptz,
  pay_request_id      uuid,
  credit_cents        integer not null default 0 check (credit_cents >= 0),
  cash_bill_cents     integer not null default 0 check (cash_bill_cents >= 0),
  cash_tip_cents      integer not null default 0 check (cash_tip_cents >= 0),
  card_bill_cents     integer not null default 0 check (card_bill_cents >= 0),
  card_tip_cents      integer not null default 0 check (card_tip_cents >= 0),
  cash_received_cents integer check (cash_received_cents is null or cash_received_cents >= 0),
  paying_at           timestamptz,
  paid_at             timestamptz,
  expires_at          timestamptz not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint pay_tabs_billed_chk check (status in ('waiting_bill', 'expired', 'cancelled') or bill_cents is not null),
  constraint pay_tabs_paid_chk check ((status = 'paid') = (paid_at is not null))
);

-- One open tab per guest per place (per universe).
create unique index pay_tabs_one_open on public.pay_tabs (consumer_id, place_id, livemode)
  where status in ('waiting_bill', 'billed', 'paying');
create index pay_tabs_place_idx on public.pay_tabs (place_id, created_at desc);

alter table public.pay_tabs enable row level security;
revoke all on table public.pay_tabs from public, anon, authenticated;
grant all on table public.pay_tabs to service_role;

comment on table public.pay_tabs is
  'MESITA-3567: Pay at the table. One table''s bill at one place: the guest''s QR (token_hash), the waiter''s bill and tip suggestion, the guest''s split, settled by wallet_payments rows that carry tab_id. EF-only.';

alter table public.wallet_payments
  add column tab_id uuid references public.pay_tabs(id) on delete restrict,
  add column part text check (part is null or part in ('credit', 'outside', 'card'));
create index wallet_payments_tab_idx on public.wallet_payments (tab_id) where tab_id is not null;

comment on column public.wallet_payments.tab_id is 'MESITA-3567: the pay_tabs row this payment pays, or null.';
comment on column public.wallet_payments.part is 'MESITA-3567: which part of the tab: credit (the whole bill in credits), outside (cash, holding any credit), card.';

-- ── 2. Open (or reuse) ──────────────────────────────────────────────────────
-- Under the pair lock: stale open tabs of this guest here expire; an open
-- one is reused (still waiting for the bill → its token rotates to the new
-- hash, so only the newest QR works); else a new tab opens.
create or replace function public.pay_tab_open(
  p_consumer_id uuid, p_place_id uuid, p_token_hash text, p_currency text, p_livemode boolean,
  p_ttl interval default interval '30 minutes', p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.pay_tabs;
begin
  if p_consumer_id is null or p_place_id is null or p_token_hash is null then
    raise exception 'pay_tab_open: consumer, place and token are required';
  end if;
  perform public.wallet_lock(p_consumer_id, p_place_id);

  -- A stale tab whose bill was paid (credits) and only a cash tip went
  -- unconfirmed reads paid; any other stale tab expires. A row still in
  -- flight keeps its tab open.
  update public.pay_tabs t
     set status = case when exists (select 1 from public.wallet_payments w where w.tab_id = t.id and w.paid_at is not null)
                       then 'paid' else 'expired' end,
         paid_at = case when exists (select 1 from public.wallet_payments w where w.tab_id = t.id and w.paid_at is not null)
                        then p_now end,
         updated_at = now()
   where t.consumer_id = p_consumer_id and t.place_id = p_place_id and t.livemode = p_livemode
     and t.status in ('waiting_bill', 'billed', 'paying') and t.expires_at <= p_now
     and not exists (select 1 from public.wallet_payments w
                      where w.tab_id = t.id and w.status in ('opening', 'open')
                        and (w.expires_at is null or w.expires_at > p_now));

  select * into v from public.pay_tabs
   where consumer_id = p_consumer_id and place_id = p_place_id and livemode = p_livemode
     and status in ('waiting_bill', 'billed', 'paying')
   for update;
  if found then
    if v.status = 'waiting_bill' then
      update public.pay_tabs set token_hash = p_token_hash, expires_at = p_now + p_ttl, updated_at = now()
       where id = v.id;
      return jsonb_build_object('ok', true, 'outcome', 'reused', 'tab_id', v.id, 'status', v.status,
        'token_rotated', true, 'expires_at', p_now + p_ttl);
    end if;
    return jsonb_build_object('ok', true, 'outcome', 'reused', 'tab_id', v.id, 'status', v.status,
      'token_rotated', false, 'expires_at', v.expires_at);
  end if;

  insert into public.pay_tabs (place_id, consumer_id, token_hash, currency, livemode, expires_at)
  values (p_place_id, p_consumer_id, p_token_hash, lower(p_currency), p_livemode, p_now + p_ttl)
  returning * into v;
  return jsonb_build_object('ok', true, 'outcome', 'opened', 'tab_id', v.id, 'status', v.status,
    'token_rotated', true, 'expires_at', v.expires_at);
end;
$function$;

-- ── 3. The waiter's bill ────────────────────────────────────────────────────
-- p_staff_key_hash: the waiter device's key. p_rekey = true when the EF
-- checked the place code just now (the key replaces any older one); false →
-- the key must match the tab's. bill_version is a compare-and-set: the
-- waiter's screen sends the version it read.
create or replace function public.pay_tab_bill(
  p_token_hash text, p_staff_key_hash text, p_rekey boolean, p_bill_version integer,
  p_bill_cents integer, p_tip_cents integer, p_ticket text, p_waiter_name text,
  p_ttl interval default interval '30 minutes', p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.pay_tabs;
begin
  if p_bill_cents is null or p_bill_cents <= 0 or p_bill_cents > 10000000
     or p_tip_cents is null or p_tip_cents < 0 or p_tip_cents > 10000000 then
    return jsonb_build_object('ok', false, 'code', 'amount_required');
  end if;
  select * into v from public.pay_tabs where token_hash = p_token_hash for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.status in ('waiting_bill', 'billed') and v.expires_at <= p_now then
    update public.pay_tabs set status = 'expired', updated_at = now() where id = v.id;
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;
  if v.status in ('expired', 'cancelled') then
    return jsonb_build_object('ok', false, 'code', v.status);
  end if;
  if v.status in ('paying', 'paid') then
    return jsonb_build_object('ok', false, 'code', 'paying', 'status', v.status);
  end if;
  if not p_rekey and (v.staff_key_hash is null or p_staff_key_hash is null or v.staff_key_hash <> p_staff_key_hash) then
    return jsonb_build_object('ok', false, 'code', 'staff_key');
  end if;
  if p_bill_version is distinct from v.bill_version then
    return jsonb_build_object('ok', false, 'code', 'stale', 'bill_version', v.bill_version);
  end if;

  update public.pay_tabs
     set status = 'billed', bill_cents = p_bill_cents, tip_cents = p_tip_cents,
         ticket = nullif(btrim(p_ticket), ''), waiter_name = nullif(btrim(p_waiter_name), ''),
         staff_key_hash = case when p_rekey then p_staff_key_hash else staff_key_hash end,
         bill_version = v.bill_version + 1, billed_at = p_now,
         expires_at = greatest(v.expires_at, p_now + p_ttl), updated_at = now()
   where id = v.id;
  return jsonb_build_object('ok', true, 'outcome', 'billed', 'tab_id', v.id, 'bill_version', v.bill_version + 1,
    'bill_cents', p_bill_cents, 'tip_cents', p_tip_cents);
end;
$function$;

-- ── 4. The guest's split ────────────────────────────────────────────────────
-- Parts: bill = credit + cash_bill + card_bill; tip = cash_tip + card_tip
-- (the guest's tip; the waiter's is a suggestion). Credits never pay a tip.
-- Card parts wait for T2 (card_unavailable). One request id per tap: a
-- replay answers the tab as it stands.
create or replace function public.pay_tab_open_parts(
  p_tab_id uuid, p_consumer_id uuid, p_bill_version integer,
  p_credit_cents integer, p_cash_bill_cents integer, p_cash_tip_cents integer,
  p_card_bill_cents integer, p_card_tip_cents integer,
  p_request_id uuid, p_proof_token text, p_outside_cashback_bps integer, p_max_outside_per_day integer,
  p_now timestamptz default now())
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
  v_status text;
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
    return jsonb_build_object('ok', true, 'outcome', 'replayed', 'tab_id', v.id, 'status', v.status);
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
  if p_card_bill_cents > 0 or p_card_tip_cents > 0 then
    return jsonb_build_object('ok', false, 'code', 'card_unavailable');
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
    v_res := public.wallet_open_outside(p_consumer_id, v.place_id, p_credit_cents, p_cash_bill_cents, p_cash_tip_cents,
      v.currency, v.livemode, p_request_id, p_proof_token, v.ticket, p_outside_cashback_bps, v_expires);
    if not coalesce((v_res ->> 'ok')::boolean, false) or v_res ->> 'outcome' <> 'opened' then
      return coalesce(v_res, '{}'::jsonb) || jsonb_build_object('ok', false);
    end if;
    v_pay := (v_res ->> 'payment_id')::uuid;
    update public.wallet_payments set tab_id = v.id, part = 'outside', charge_amount_cents = v.bill_cents
     where id = v_pay;
    v_status := 'paying';
  else
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
         card_bill_cents = 0, card_tip_cents = 0,
         expires_at = greatest(v.expires_at, v_expires), updated_at = now()
   where id = v.id;
  return jsonb_build_object('ok', true, 'outcome', 'opened', 'tab_id', v.id, 'status', v_status, 'payment_id', v_pay,
    'credit_cents', p_credit_cents, 'cash_bill_cents', p_cash_bill_cents, 'cash_tip_cents', p_cash_tip_cents);
end;
$function$;

-- ── 5. The waiter's Received ────────────────────────────────────────────────
-- p_received_cents null = exactly what the guest owes in cash. Less than the
-- cash bill part writes nothing and answers short with what is missing; a
-- shortfall within the tip comes off the tip.
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

-- ── 6. Change how to pay, or cancel ─────────────────────────────────────────
-- 'change': paying with nothing paid yet → the open outside row is cancelled
-- (expired + 'cancelled', its credit hold released) and the tab is billed
-- again. 'cancel': waiting_bill or billed → cancelled.
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
  end if;
  raise exception 'pay_tab_change: mode must be cancel or change';
end;
$function$;

-- ── 7. Access: the service role only ────────────────────────────────────────
revoke all on function public.pay_tab_open(uuid, uuid, text, text, boolean, interval, timestamptz) from public, anon, authenticated;
revoke all on function public.pay_tab_bill(text, text, boolean, integer, integer, integer, text, text, interval, timestamptz) from public, anon, authenticated;
revoke all on function public.pay_tab_open_parts(uuid, uuid, integer, integer, integer, integer, integer, integer, uuid, text, integer, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.pay_tab_cash(text, text, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.pay_tab_change(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.pay_tab_open(uuid, uuid, text, text, boolean, interval, timestamptz) to service_role;
grant execute on function public.pay_tab_bill(text, text, boolean, integer, integer, integer, text, text, interval, timestamptz) to service_role;
grant execute on function public.pay_tab_open_parts(uuid, uuid, integer, integer, integer, integer, integer, integer, uuid, text, integer, integer, timestamptz) to service_role;
grant execute on function public.pay_tab_cash(text, text, integer, timestamptz) to service_role;
grant execute on function public.pay_tab_change(uuid, uuid, text) to service_role;
