-- MESITA-4871 — one 8-digit code per waiter (Pato, 2026-11-24: "you can create
-- different codes for different waiters in order to appropriately direct the
-- tip"). The code names its place and its waiter; a bill records who sent it
-- last, and the paid visit keeps that waiter and their name.
-- place_codes (one code per place) is read by nothing on the waiter's path now.
create table public.place_waiters (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 40),
  lookup_hash text unique check (lookup_hash is null or lookup_hash ~ '^[0-9a-f]{64}$'),
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check ((lookup_hash is null) = (removed_at is not null))
);
create unique index place_waiters_name on public.place_waiters (place_id, lower(name)) where removed_at is null;
alter table public.place_waiters enable row level security;
revoke all on table public.place_waiters from public, anon, authenticated;
grant all on table public.place_waiters to service_role;
comment on table public.place_waiters is
  'MESITA-4871: a place''s waiters. lookup_hash = keyed hash of the waiter''s 8-digit code, unique across places; null once removed. EF-only.';

alter table public.pay_bills add column waiter_id uuid references public.place_waiters (id) on delete set null;
alter table public.pay_tabs add column waiter_id uuid references public.place_waiters (id) on delete set null;
create index pay_tabs_waiter_idx on public.pay_tabs (waiter_id, paid_at desc) where waiter_id is not null;
comment on column public.pay_tabs.waiter_id is 'MESITA-4871: the waiter whose code sent the bill; the tip is theirs.';

create or replace function public.waiter_code_try(
  p_token_hash text, p_bill_id uuid, p_addr_hash text, p_lookup_hash text,
  p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  c_window constant interval := interval '10 minutes';
  c_guest_limit constant integer := 5;
  c_addr_limit constant integer := 30;
  v_consumer uuid;
  v_guest_key text;
  v_place uuid;
  v_waiter uuid;
  v_until timestamptz;
begin
  if p_token_hash is not null then
    select consumer_id into v_consumer from public.pay_guest_codes
     where (token_hash = p_token_hash and expires_at > p_now)
        or (prev_token_hash = p_token_hash and prev_until > p_now);
  else
    select consumer_id into v_consumer from public.pay_bills
     where id = p_bill_id and created_at > p_now - interval '3 hours';
  end if;
  if v_consumer is null then
    return jsonb_build_object('ok', false, 'code', 'code_gone');
  end if;
  v_guest_key := encode(sha256(convert_to('waiter-code-guest:' || v_consumer::text, 'UTF8')), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('waiter-code:' || v_guest_key, 0));
  perform pg_advisory_xact_lock(hashtextextended('waiter-code:' || p_addr_hash, 0));

  select max(u) into v_until from (
    (select tried_at + c_window as u from public.place_charge_tries
      where place_id is null and kind = 'guest' and addr_hash = v_guest_key and tried_at > p_now - c_window
      order by tried_at desc offset c_guest_limit - 1 limit 1)
    union all
    (select tried_at + c_window from public.place_charge_tries
      where place_id is null and kind = 'staff' and addr_hash = p_addr_hash and tried_at > p_now - c_window
      order by tried_at desc offset c_addr_limit - 1 limit 1)) locks;
  if v_until is not null then
    return jsonb_build_object('ok', false, 'code', 'locked',
      'retry_after_s', greatest(ceil(extract(epoch from v_until - p_now))::integer, 1));
  end if;

  select w.place_id, w.id into v_place, v_waiter from public.place_waiters w
    join public.places p on p.id = w.place_id and p.state = 'active'
   where w.lookup_hash = p_lookup_hash and w.removed_at is null;
  if v_place is null then
    insert into public.place_charge_tries (place_id, kind, addr_hash, tried_at)
    values (null, 'guest', v_guest_key, p_now), (null, 'staff', p_addr_hash, p_now);
    return jsonb_build_object('ok', false, 'code', 'staff_only');
  end if;
  return jsonb_build_object('ok', true, 'place_id', v_place, 'waiter_id', v_waiter);
end;
$function$;

drop function public.pay_bill_send(uuid, uuid, integer, integer, integer, text, integer, timestamptz);
create or replace function public.pay_bill_send(
  p_bill_id uuid, p_place_id uuid, p_version integer, p_bill_cents integer, p_tip_cents integer,
  p_key_hash text, p_window_minutes integer default 15, p_now timestamptz default now(),
  p_waiter_id uuid default null)
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
         quote = q, staff_key_hash = p_key_hash, waiter_id = p_waiter_id, updated_at = p_now,
         expires_at = p_now + make_interval(mins => greatest(least(coalesce(p_window_minutes, 15), 60), 5))
   where id = b.id returning * into b;
  return jsonb_build_object('ok', true, 'outcome', 'sent', 'version', b.version, 'expires_at', b.expires_at);
end;
$function$;

create or replace function public.pay_guest_insert_closed(
  p_attempt public.guest_pay_attempts, p_now timestamptz)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_waiter uuid;
  v_waiter_name text;
  v_key constant text := 'cc873e0cc5c6d9a278d6804d17e2b06e46cd1e68701b86cbe7a87675f6121775';
begin
  -- The waiter who sent the bill: its tip is theirs (MESITA-4871). A waiter-led
  -- attempt's request id is its bill.
  select w.id, w.name into v_waiter, v_waiter_name
    from public.pay_bills b join public.place_waiters w on w.id = b.waiter_id
   where b.id = p_attempt.request_id and b.consumer_id = p_attempt.consumer_id and b.place_id = p_attempt.place_id;
  insert into public.pay_tabs (
    place_id, consumer_id, token_hash, status, currency, livemode,
    bill_cents, tip_cents, bill_version, billed_at, pay_request_id,
    credit_cents, cash_bill_cents, cash_tip_cents, card_bill_cents, card_tip_cents,
    cash_received_cents, paying_at, paid_at, verified_at, verified_key_hash,
    expires_at, origin, visit_mechanism, discount_bps, discount_cents, cashback_line, cashback_bps, waiter_id, waiter_name)
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
    p_attempt.cashback_line, p_attempt.cashback_bps, v_waiter, v_waiter_name)
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

-- The waiters and their tips on paid visits. A removed waiter stays while a
-- tip of the last 7 days is theirs.
create function public.place_waiter_list(p_place_id uuid, p_livemode boolean, p_now timestamptz default now())
 returns table (id uuid, name text, removed boolean, tips_24h_cents bigint, bills_24h bigint, tips_7d_cents bigint, bills_7d bigint)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select w.id, w.name, w.removed_at is not null,
         coalesce(sum(t.tip_cents) filter (where t.paid_at > p_now - interval '24 hours'), 0)::bigint,
         count(t.id) filter (where t.paid_at > p_now - interval '24 hours'),
         coalesce(sum(t.tip_cents), 0)::bigint,
         count(t.id)
    from public.place_waiters w
    left join public.pay_tabs t
      on t.waiter_id = w.id and t.status = 'paid' and t.livemode = p_livemode and t.paid_at > p_now - interval '7 days'
   where w.place_id = p_place_id
   group by w.id
  having w.removed_at is null or count(t.id) > 0
   order by w.removed_at is not null, lower(w.name);
$function$;

revoke all on function public.waiter_code_try(text, uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.waiter_code_try(text, uuid, text, text, timestamptz) to service_role;
revoke all on function public.pay_bill_send(uuid, uuid, integer, integer, integer, text, integer, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.pay_bill_send(uuid, uuid, integer, integer, integer, text, integer, timestamptz, uuid) to service_role;
revoke all on function public.pay_guest_insert_closed(public.guest_pay_attempts, timestamptz) from public, anon, authenticated;
grant execute on function public.pay_guest_insert_closed(public.guest_pay_attempts, timestamptz) to service_role;
revoke all on function public.place_waiter_list(uuid, boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.place_waiter_list(uuid, boolean, timestamptz) to service_role;
