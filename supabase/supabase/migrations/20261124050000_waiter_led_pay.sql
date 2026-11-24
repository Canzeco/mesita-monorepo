-- MESITA-4823 — WAITER-LED PAY (Pato, 2026-11-24: "NOW THE PAYFLOW IS
-- WAITER-LEAD, NOT GUEST-LEAD").
--
--   guest's one QR ─► waiter scans (open) ─► bill + tip (sent, v1, v2…)
--        sent ─► declined ─► sent again │ cancelled │ expired (15 min)
--        sent ─► accepted: the guest_pay_attempts row is the truth from here
--                 nothing owed outside → closed at once (paid)
--                 else live (credit held, 60 min) → Received → paid
--                                                 → cancel / expiry → released
--
-- pay_guest_codes  the guest's one rotating code (QR token + 6 digits), hashed
-- pay_bills        the waiter's proposal; moves no money
-- The quote (line, discount, credit, cashback) is one function. Accept freezes
-- the cashback on the attempt; the grant honours it.
-- Lock order everywhere: guest, (guest, place), bill row, attempt.

-- ── 1. What a bill will earn, frozen at Accept ──────────────────────────────
alter table public.guest_pay_attempts
  add column if not exists cashback_line text,
  add column if not exists cashback_bps integer check (cashback_bps is null or (cashback_bps >= 0 and cashback_bps <= 10000));
alter table public.pay_tabs
  add column if not exists cashback_line text,
  add column if not exists cashback_bps integer check (cashback_bps is null or (cashback_bps >= 0 and cashback_bps <= 10000));
comment on column public.pay_tabs.cashback_bps is
  'MESITA-4823: the cashback rate the guest accepted (0 = none). Null = a bill with no frozen rate: the grant works it out at the payment.';

-- ── 2. Tables ───────────────────────────────────────────────────────────────
create table public.pay_guest_codes (
  consumer_id uuid primary key references public.consumers (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  short_hash text not null unique check (short_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  prev_token_hash text unique check (prev_token_hash is null or prev_token_hash ~ '^[0-9a-f]{64}$'),
  prev_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.pay_guest_codes enable row level security;
revoke all on table public.pay_guest_codes from public, anon, authenticated;
grant all on table public.pay_guest_codes to service_role;
comment on table public.pay_guest_codes is
  'MESITA-4823: the guest''s one Mesita QR (and its 6 digits), hashed and rotating. It names no place and moves no money. EF-only.';

create table public.pay_bills (
  id uuid primary key default gen_random_uuid(),
  consumer_id uuid not null references public.consumers (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  livemode boolean not null,
  currency text not null check (currency ~ '^[a-z]{3}$'),
  status text not null default 'open'
    check (status in ('open', 'sent', 'accepted', 'declined', 'cancelled', 'expired')),
  version integer not null default 0 check (version >= 0),
  bill_cents integer check (bill_cents is null or (bill_cents > 0 and bill_cents <= 10000000)),
  tip_cents integer not null default 0 check (tip_cents >= 0 and tip_cents <= 10000000),
  quote jsonb,
  staff_key_hash text not null check (staff_key_hash ~ '^[0-9a-f]{64}$'),
  not_mine boolean not null default false,
  attempt_id uuid unique references public.guest_pay_attempts (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'accepted') = (attempt_id is not null)),
  check (status not in ('sent', 'accepted') or (bill_cents is not null and quote is not null))
);
create unique index pay_bills_one_sent on public.pay_bills (consumer_id, livemode) where status = 'sent';
create index pay_bills_consumer_idx on public.pay_bills (consumer_id, updated_at desc);
create index pay_bills_place_idx on public.pay_bills (place_id, created_at desc);
alter table public.pay_bills enable row level security;
revoke all on table public.pay_bills from public, anon, authenticated;
grant all on table public.pay_bills to service_role;
comment on table public.pay_bills is
  'MESITA-4823: the bill a waiter sends a guest (a proposal, no money). Once accepted, guest_pay_attempts (attempt_id) is the truth. EF-only.';

create or replace function public.pay_guest_lock(p_consumer_id uuid)
 returns void language sql set search_path to 'public'
as $function$ select pg_advisory_xact_lock(hashtextextended('pay-guest:' || p_consumer_id::text, 0)); $function$;

-- ── 3. The quote ────────────────────────────────────────────────────────────
create or replace function public.pay_bill_quote(
  p_consumer_id uuid, p_place_id uuid, p_currency text, p_livemode boolean,
  p_bill_cents integer, p_tip_cents integer, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_vip boolean := public.consumer_is_vip_for_money(p_consumer_id, p_livemode);
  v_mech text := public.place_visit_mechanism(p_place_id);
  v_line text;
  v_bps integer;
  r record;
  v_disc_bps integer := 0;
  v_disc integer := 0;
  v_due integer;
  v_credit integer;
  v_back_bps integer := 0;
begin
  if not exists (
    select 1 from public.pay_tabs o
     where o.consumer_id = p_consumer_id and o.place_id = p_place_id
       and o.livemode = p_livemode and o.status = 'paid') then
    v_line := case when v_vip then 'welcome_vip' else 'welcome' end;
  else
    v_line := case when v_vip then 'returning_vip' else 'returning' end;
  end if;
  select * into r from public.place_cashback_rates(p_place_id);
  v_bps := greatest(coalesce(case v_line when 'welcome' then r.welcome_bps
                                         when 'welcome_vip' then r.welcome_vip_bps
                                         when 'returning_vip' then r.returning_vip_bps
                                         else r.returning_bps end, 0), 0);
  if v_mech = 'discount' then
    v_disc_bps := v_bps;
    v_disc := (p_bill_cents::bigint * v_bps / 10000)::integer;
  elsif exists (select 1 from public.place_payment_settings s
                 where s.place_id = p_place_id and s.loyalty_cards) then
    v_back_bps := v_bps;
  end if;
  v_due := p_bill_cents - v_disc;
  select least(coalesce(b.spendable_cents, 0), v_due) into v_credit
    from public.wallet_balance(p_consumer_id, p_place_id, lower(p_currency), p_livemode, p_now) b;
  v_credit := greatest(coalesce(v_credit, 0), 0);
  return jsonb_build_object(
    'mechanism', v_mech, 'line', v_line,
    'discount_bps', v_disc_bps, 'discount_cents', v_disc,
    'credit_cents', v_credit, 'outside_bill_cents', v_due - v_credit,
    'tip_cents', p_tip_cents, 'outside_cents', v_due - v_credit + p_tip_cents,
    'cashback_bps', v_back_bps,
    'cashback_cents', ((v_due - v_credit)::bigint * v_back_bps / 10000)::integer);
end;
$function$;

-- ── 4. The guest's code ─────────────────────────────────────────────────────
create or replace function public.pay_guest_code_set(
  p_consumer_id uuid, p_token_hash text, p_short_hash text,
  p_ttl interval default interval '10 minutes', p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  perform public.pay_guest_lock(p_consumer_id);
  -- An expired code of someone else never blocks six digits.
  update public.pay_guest_codes
     set short_hash = md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text)
   where short_hash = p_short_hash and consumer_id <> p_consumer_id and expires_at <= p_now;
  begin
    insert into public.pay_guest_codes (consumer_id, token_hash, short_hash, expires_at, updated_at)
    values (p_consumer_id, p_token_hash, p_short_hash, p_now + p_ttl, p_now)
    on conflict (consumer_id) do update
      set prev_token_hash = case when pay_guest_codes.expires_at > p_now then pay_guest_codes.token_hash end,
          prev_until = case when pay_guest_codes.expires_at > p_now then p_now + interval '60 seconds' end,
          token_hash = excluded.token_hash, short_hash = excluded.short_hash,
          expires_at = excluded.expires_at, updated_at = p_now;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'collision');
  end;
  return jsonb_build_object('ok', true, 'expires_at', p_now + p_ttl);
end;
$function$;

-- ── 5. The waiter scans: a bill session ─────────────────────────────────────
-- p_code_hash is the QR token's hash or the six digits' hash. With
-- p_again_bill_id (no code) the waiter starts over for the guest of a bill
-- that ended in the last 3 hours at this place; the guest still accepts.
create or replace function public.pay_bill_open(
  p_code_hash text, p_again_bill_id uuid, p_place_id uuid, p_currency text, p_livemode boolean,
  p_key_hash text, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_consumer uuid;
  b public.pay_bills;
  a public.guest_pay_attempts;
begin
  if p_again_bill_id is not null then
    select * into b from public.pay_bills where id = p_again_bill_id and place_id = p_place_id and livemode = p_livemode;
    if not found or b.not_mine or b.created_at < p_now - interval '3 hours' then
      return jsonb_build_object('ok', false, 'code', 'code_gone');
    end if;
    if b.status = 'accepted' then
      select * into a from public.guest_pay_attempts where id = b.attempt_id;
      if a.status <> 'released' then
        return jsonb_build_object('ok', false, 'code', 'not_over');
      end if;
    end if;
    v_consumer := b.consumer_id;
  else
    select consumer_id into v_consumer from public.pay_guest_codes
     where (token_hash = p_code_hash and expires_at > p_now)
        or (short_hash = p_code_hash and expires_at > p_now)
        or (prev_token_hash = p_code_hash and prev_until > p_now);
    if v_consumer is null then
      return jsonb_build_object('ok', false, 'code', 'code_gone');
    end if;
  end if;

  perform public.pay_guest_lock(v_consumer);
  -- A rescan picks up this place's own session (and its typed bill).
  select * into b from public.pay_bills
   where consumer_id = v_consumer and place_id = p_place_id and livemode = p_livemode
     and status in ('open', 'sent', 'declined') and expires_at > p_now and not not_mine
   order by updated_at desc limit 1;
  if found then
    return jsonb_build_object('ok', true, 'outcome', 'reused', 'bill_id', b.id);
  end if;
  if (select count(*) from public.pay_bills where consumer_id = v_consumer and place_id = p_place_id
        and created_at > p_now - interval '1 hour') >= 10
     or (select count(*) from public.pay_bills where consumer_id = v_consumer
        and created_at > p_now - interval '1 hour') >= 20
     or (select count(*) from public.pay_bills where staff_key_hash = p_key_hash
        and created_at > p_now - interval '1 hour') >= 120 then
    return jsonb_build_object('ok', false, 'code', 'too_many');
  end if;
  insert into public.pay_bills (consumer_id, place_id, livemode, currency, staff_key_hash, expires_at, created_at, updated_at)
  values (v_consumer, p_place_id, p_livemode, lower(p_currency), p_key_hash, p_now + interval '15 minutes', p_now, p_now)
  returning * into b;
  return jsonb_build_object('ok', true, 'outcome', 'opened', 'bill_id', b.id);
end;
$function$;

-- ── 6. Send (and edit) ──────────────────────────────────────────────────────
create or replace function public.pay_bill_send(
  p_bill_id uuid, p_place_id uuid, p_version integer, p_bill_cents integer, p_tip_cents integer,
  p_key_hash text, p_window_minutes integer default 15, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  b public.pay_bills;
  q jsonb;
  v_other uuid;
begin
  select * into b from public.pay_bills where id = p_bill_id;
  if not found then return jsonb_build_object('ok', false, 'code', 'gone'); end if;
  if b.place_id is distinct from p_place_id then return jsonb_build_object('ok', false, 'code', 'forbidden'); end if;
  if coalesce(p_bill_cents, 0) <= 0 or p_bill_cents > 10000000 or coalesce(p_tip_cents, -1) < 0 or p_tip_cents > 10000000 then
    return jsonb_build_object('ok', false, 'code', 'amount_required');
  end if;
  perform public.pay_guest_lock(b.consumer_id);
  select * into b from public.pay_bills where id = p_bill_id for update;
  if b.status = 'accepted' then return jsonb_build_object('ok', false, 'code', 'accepted'); end if;
  if b.status = 'cancelled' or b.status = 'expired' or b.not_mine or b.expires_at <= p_now then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;
  if b.version is distinct from p_version then
    -- The same numbers again: the answer to a first tap that got lost.
    if b.version = p_version + 1 and b.status = 'sent' and b.bill_cents = p_bill_cents and b.tip_cents = p_tip_cents then
      return jsonb_build_object('ok', true, 'outcome', 'replayed', 'version', b.version);
    end if;
    return jsonb_build_object('ok', false, 'code', 'stale', 'version', b.version);
  end if;
  if b.version >= 20 then return jsonb_build_object('ok', false, 'code', 'too_many'); end if;

  update public.pay_bills set status = 'expired', updated_at = p_now
   where consumer_id = b.consumer_id and livemode = b.livemode and status = 'sent' and id <> b.id and expires_at <= p_now;
  select id into v_other from public.pay_bills
   where consumer_id = b.consumer_id and livemode = b.livemode and status = 'sent' and id <> b.id;
  if v_other is not null
     or exists (select 1 from public.guest_pay_attempts a
                 where a.consumer_id = b.consumer_id and a.livemode = b.livemode
                   and a.status in ('opening', 'due')
                   and (a.expires_at > p_now or a.charging_at is not null)) then
    return jsonb_build_object('ok', false, 'code', 'guest_busy');
  end if;

  q := public.pay_bill_quote(b.consumer_id, b.place_id, b.currency, b.livemode, p_bill_cents, p_tip_cents, p_now);
  update public.pay_bills
     set status = 'sent', version = b.version + 1, bill_cents = p_bill_cents, tip_cents = p_tip_cents,
         quote = q, staff_key_hash = p_key_hash, updated_at = p_now,
         expires_at = p_now + make_interval(mins => greatest(least(coalesce(p_window_minutes, 15), 60), 5))
   where id = b.id returning * into b;
  return jsonb_build_object('ok', true, 'outcome', 'sent', 'version', b.version, 'expires_at', b.expires_at);
end;
$function$;

-- ── 7. The guest answers ────────────────────────────────────────────────────
create or replace function public.pay_bill_accept(
  p_bill_id uuid, p_consumer_id uuid, p_version integer, p_token_hash text,
  p_window_minutes integer default 60, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  b public.pay_bills;
  a public.guest_pay_attempts;
  q jsonb;
  r jsonb;
  v_msg text;
  v_why jsonb;
begin
  select * into b from public.pay_bills where id = p_bill_id and consumer_id = p_consumer_id;
  if not found then return jsonb_build_object('ok', false, 'code', 'gone'); end if;
  perform public.pay_guest_lock(p_consumer_id);
  perform public.wallet_lock(p_consumer_id, b.place_id);
  select * into b from public.pay_bills where id = p_bill_id for update;

  if b.status = 'accepted' then
    select * into a from public.guest_pay_attempts where id = b.attempt_id;
    if a.status = 'released' then return jsonb_build_object('ok', false, 'code', 'already_final', 'end_reason', a.end_reason); end if;
    return jsonb_build_object('ok', true, 'outcome', 'replayed', 'attempt_id', a.id, 'status', a.status, 'tab_id', a.tab_id);
  end if;
  if b.status <> 'sent' then return jsonb_build_object('ok', false, 'code', b.status); end if;
  if b.expires_at <= p_now then
    update public.pay_bills set status = 'expired', updated_at = p_now where id = b.id;
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;
  if b.version is distinct from p_version then
    return jsonb_build_object('ok', false, 'code', 'quote_changed', 'version', b.version);
  end if;

  q := public.pay_bill_quote(b.consumer_id, b.place_id, b.currency, b.livemode, b.bill_cents, b.tip_cents, p_now);
  if q is distinct from b.quote then
    update public.pay_bills set quote = q, version = b.version + 1, updated_at = p_now where id = b.id;
    return jsonb_build_object('ok', false, 'code', 'quote_changed', 'version', b.version + 1);
  end if;

  begin
    r := public.pay_guest_begin(
      b.consumer_id, b.place_id, b.currency, b.livemode, p_token_hash,
      b.bill_cents, (q->>'credit_cents')::integer, (q->>'outside_bill_cents')::integer, b.tip_cents,
      0, 0, b.id, null, 0, p_window_minutes, p_now);
    update public.guest_pay_attempts
       set cashback_line = q->>'line', cashback_bps = (q->>'cashback_bps')::integer
     where id = (r->>'attempt_id')::uuid
     returning * into a;
    if a.tender = 'credits' then
      -- Nothing to collect: the waiter who sent the bill confirmed it.
      r := public.pay_guest_claim_confirm(a.id, b.place_id, b.staff_key_hash, p_now);
      if (r->>'ok')::boolean is not true then raise exception 'accept_claim:%', r->>'code'; end if;
      r := public.pay_guest_close(a.id, p_now);
      if (r->>'ok')::boolean is not true then raise exception 'accept_close:%', r->>'code'; end if;
    end if;
  exception
    when unique_violation then
      return jsonb_build_object('ok', false, 'code', 'too_many_open');
    when raise_exception then
      v_msg := sqlerrm;
      if v_msg not like 'guest_refused:%' then raise; end if;
      v_why := substr(v_msg, length('guest_refused:') + 1)::jsonb;
      if v_why->>'code' in ('insufficient', 'discount_changed', 'parts') then
        return jsonb_build_object('ok', false, 'code', 'quote_changed', 'version', b.version);
      end if;
      return v_why || jsonb_build_object('ok', false);
  end;

  update public.pay_bills set status = 'accepted', attempt_id = a.id, updated_at = p_now where id = b.id;
  select * into a from public.guest_pay_attempts where id = a.id;
  return jsonb_build_object('ok', true, 'outcome', 'accepted', 'attempt_id', a.id, 'status', a.status, 'tab_id', a.tab_id);
end;
$function$;

create or replace function public.pay_bill_decline(
  p_bill_id uuid, p_consumer_id uuid, p_version integer, p_not_mine boolean default false, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  b public.pay_bills;
begin
  perform public.pay_guest_lock(p_consumer_id);
  select * into b from public.pay_bills where id = p_bill_id and consumer_id = p_consumer_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'gone'); end if;
  if b.status in ('declined', 'cancelled', 'expired') and not p_not_mine then return jsonb_build_object('ok', true, 'outcome', 'already'); end if;
  if b.status = 'accepted' then return jsonb_build_object('ok', false, 'code', 'accepted'); end if;
  if b.status = 'sent' and b.version is distinct from p_version and not p_not_mine then
    return jsonb_build_object('ok', false, 'code', 'quote_changed', 'version', b.version);
  end if;
  update public.pay_bills
     set status = case when p_not_mine then 'cancelled' else 'declined' end, not_mine = p_not_mine,
         expires_at = p_now + interval '15 minutes', updated_at = p_now
   where id = b.id;
  -- Not my bill: the QR that phone scanned is dead.
  if p_not_mine then
    delete from public.pay_guest_codes where consumer_id = p_consumer_id;
    update public.pay_bills set status = 'cancelled', not_mine = true, updated_at = p_now
     where consumer_id = p_consumer_id and place_id = b.place_id and status in ('open', 'declined');
  end if;
  return jsonb_build_object('ok', true, 'outcome', 'declined');
end;
$function$;

-- The waiter's cancel before Accept; after it, pay_guest_claim_end.
create or replace function public.pay_bill_cancel(p_bill_id uuid, p_place_id uuid, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  b public.pay_bills;
begin
  select * into b from public.pay_bills where id = p_bill_id;
  if not found then return jsonb_build_object('ok', false, 'code', 'gone'); end if;
  if b.place_id is distinct from p_place_id then return jsonb_build_object('ok', false, 'code', 'forbidden'); end if;
  perform public.pay_guest_lock(b.consumer_id);
  select * into b from public.pay_bills where id = p_bill_id for update;
  if b.status = 'accepted' then return jsonb_build_object('ok', false, 'code', 'accepted', 'attempt_id', b.attempt_id); end if;
  if b.status in ('cancelled', 'expired') then return jsonb_build_object('ok', true, 'outcome', 'already'); end if;
  update public.pay_bills set status = 'cancelled', updated_at = p_now where id = b.id;
  return jsonb_build_object('ok', true, 'outcome', 'cancelled');
end;
$function$;

-- ── 8. The paid bill keeps the frozen rate, and the grant honours it ────────
create or replace function public.pay_guest_insert_closed(
  p_attempt public.guest_pay_attempts, p_now timestamptz)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_key constant text := 'cc873e0cc5c6d9a278d6804d17e2b06e46cd1e68701b86cbe7a87675f6121775';
begin
  insert into public.pay_tabs (
    place_id, consumer_id, token_hash, status, currency, livemode,
    bill_cents, tip_cents, bill_version, billed_at, pay_request_id,
    credit_cents, cash_bill_cents, cash_tip_cents, card_bill_cents, card_tip_cents,
    cash_received_cents, paying_at, paid_at, verified_at, verified_key_hash,
    expires_at, origin, visit_mechanism, discount_bps, discount_cents, cashback_line, cashback_bps)
  values (
    p_attempt.place_id, p_attempt.consumer_id, p_attempt.token_hash, 'paid',
    p_attempt.currency, p_attempt.livemode, p_attempt.bill_cents, p_attempt.tip_cents,
    1, p_now, p_attempt.request_id, p_attempt.credit_cents,
    case when p_attempt.tender = 'cash' then p_attempt.cash_cents - p_attempt.tip_cents else 0 end,
    case when p_attempt.tender = 'cash' then p_attempt.tip_cents else 0 end,
    case when p_attempt.tender = 'card' then p_attempt.card_cents - p_attempt.tip_cents else 0 end,
    case when p_attempt.tender = 'card' then p_attempt.tip_cents else 0 end,
    case when p_attempt.tender = 'cash' then p_attempt.cash_cents else null end,
    p_now, p_now, p_now, v_key, p_attempt.expires_at, 'guest',
    p_attempt.visit_mechanism, p_attempt.discount_bps, p_attempt.discount_cents,
    p_attempt.cashback_line, p_attempt.cashback_bps)
  returning id into v_id;
  if p_attempt.payment_id is not null then
    update public.wallet_payments set tab_id = v_id, updated_at = now() where id = p_attempt.payment_id;
  end if;
  update public.guest_pay_attempts
     set status = 'closed', tab_id = v_id
   where id = p_attempt.id;
  return v_id;
end;
$function$;

create or replace function public.pay_tab_grant_cashback(p_tab_id uuid, p_now timestamptz default now())
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  t public.pay_tabs;
  v_earn integer;
  v_line text;
  v_vip boolean;
  v_bps integer;
  r record;
  v_amount integer;
begin
  select * into t from public.pay_tabs where id = p_tab_id;
  if not found or t.status <> 'paid' or t.consumer_id is null then
    return 0;
  end if;
  -- MESITA-4770: the bill's own mechanism, never the place's current one.
  if t.visit_mechanism = 'discount' or t.discount_cents > 0 then
    return 0;
  end if;
  -- The part not paid with credit, never the tip.
  v_earn := coalesce(t.cash_bill_cents, 0) + coalesce(t.card_bill_cents, 0);
  if v_earn <= 0 then
    return 0;
  end if;
  -- New credit is born only where Loyalty Cards is On (the signed agreement);
  -- a rate the guest accepted was frozen with that answer in it (MESITA-4823).
  if t.cashback_bps is null and not exists (select 1 from public.place_payment_settings s
                  where s.place_id = t.place_id and s.loyalty_cards) then
    return 0;
  end if;

  perform public.wallet_lock(t.consumer_id, t.place_id);

  if exists (select 1 from public.wallet_entries e where e.tab_id = t.id and e.kind = 'cashback') then
    return 0;
  end if;

  -- Four lines (MESITA-4789): no earlier paid bill here → Welcome VIP for a
  -- VIP (the bill's own money mode), else Welcome Regular; otherwise
  -- Returning VIP or Returning Regular.
  v_vip := public.consumer_is_vip_for_money(t.consumer_id, t.livemode);
  if not exists (
    select 1 from public.pay_tabs o
     where o.consumer_id = t.consumer_id and o.place_id = t.place_id
       and o.livemode = t.livemode and o.status = 'paid' and o.id <> t.id
       and o.paid_at < coalesce(t.paid_at, p_now)) then
    v_line := case when v_vip then 'welcome_vip' else 'welcome' end;
  elsif v_vip then
    v_line := 'returning_vip';
  else
    v_line := 'returning';
  end if;

  if t.cashback_bps is not null then
    v_line := coalesce(t.cashback_line, v_line);
  end if;
  select * into r from public.place_cashback_rates(t.place_id);
  v_bps := case v_line when 'welcome' then r.welcome_bps
                       when 'welcome_vip' then r.welcome_vip_bps
                       when 'returning_vip' then r.returning_vip_bps
                       else r.returning_bps end;
  v_bps := coalesce(t.cashback_bps, v_bps);
  if v_bps <= 0 then
    return 0;
  end if;
  -- No ceiling (MESITA-4728): the rate on every peso paid by card or cash.
  v_amount := (v_earn::bigint * v_bps / 10000)::integer;
  if v_amount <= 0 then
    return 0;
  end if;

  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, tab_id, livemode, available_at, reason)
  values (t.consumer_id, t.place_id, 'cashback', v_amount, lower(t.currency), t.id, t.livemode,
          coalesce(t.paid_at, p_now) + interval '1 hour', v_line);
  return v_amount;
end;
$function$;

-- ── 9. Service role only ────────────────────────────────────────────────────
revoke all on function public.pay_guest_lock(uuid) from public, anon, authenticated;
grant execute on function public.pay_guest_lock(uuid) to service_role;
revoke all on function public.pay_bill_quote(uuid, uuid, text, boolean, integer, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.pay_bill_quote(uuid, uuid, text, boolean, integer, integer, timestamptz) to service_role;
revoke all on function public.pay_guest_code_set(uuid, text, text, interval, timestamptz) from public, anon, authenticated;
grant execute on function public.pay_guest_code_set(uuid, text, text, interval, timestamptz) to service_role;
revoke all on function public.pay_bill_open(text, uuid, uuid, text, boolean, text, timestamptz) from public, anon, authenticated;
grant execute on function public.pay_bill_open(text, uuid, uuid, text, boolean, text, timestamptz) to service_role;
revoke all on function public.pay_bill_send(uuid, uuid, integer, integer, integer, text, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.pay_bill_send(uuid, uuid, integer, integer, integer, text, integer, timestamptz) to service_role;
revoke all on function public.pay_bill_accept(uuid, uuid, integer, text, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.pay_bill_accept(uuid, uuid, integer, text, integer, timestamptz) to service_role;
revoke all on function public.pay_bill_decline(uuid, uuid, integer, boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.pay_bill_decline(uuid, uuid, integer, boolean, timestamptz) to service_role;
revoke all on function public.pay_bill_cancel(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.pay_bill_cancel(uuid, uuid, timestamptz) to service_role;
revoke all on function public.pay_guest_insert_closed(public.guest_pay_attempts, timestamptz) from public, anon, authenticated;
grant execute on function public.pay_guest_insert_closed(public.guest_pay_attempts, timestamptz) to service_role;
revoke all on function public.pay_tab_grant_cashback(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.pay_tab_grant_cashback(uuid, timestamptz) to service_role;
