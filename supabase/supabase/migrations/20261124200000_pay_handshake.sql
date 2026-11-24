-- MESITA-4889 — THE PAY HANDSHAKE (Pato, 2026-11-24: "a screen that waits for
-- both sides to confirm, not sequential order, but just both sides to coincide";
-- "it must work both discounts and cashbacks and everything").
--
--   Pay      the guest's tap   pay_bill_accept: holds the credits, freezes the rate
--   Receive  the waiter's tap  pay_bill_receive
--   Whichever comes second, on the same version, closes the bill, in one
--   transaction. Alone, neither does: a bill the credits cover whole waits for
--   the waiter too. Any new number clears the waiter's tap; took_cents keeps
--   what they said they took.
-- Lock order: guest, (guest, place), bill row, attempt.
-- Rollback: the definitions in 20261124170000, 20261124050000 and 20261122020000.

alter table public.pay_bills
  add column received_version integer,
  add column received_at timestamptz,
  add column received_key_hash text check (received_key_hash is null or received_key_hash ~ '^[0-9a-f]{64}$'),
  add column received_waiter_id uuid references public.place_waiters (id) on delete set null,
  add column took_cents integer check (took_cents is null or took_cents >= 0),
  add constraint pay_bills_received_whole check (
    (received_version is null) = (received_at is null) and (received_version is null) = (received_key_hash is null)
    and (received_version is null or received_version <= version));
comment on column public.pay_bills.received_version is
  'MESITA-4889: the version the waiter tapped Receive on before the guest paid. Null: not tapped, or the bill changed since.';
comment on column public.pay_bills.took_cents is
  'MESITA-4889: what the waiter said they took with that tap; kept when the bill changes or ends, so both screens can say it. Only their own undo clears it.';

-- The waiter's tap. The guest already paid: closes. Not yet: remembered.
create function public.pay_bill_receive(
  p_bill_id uuid, p_place_id uuid, p_version integer, p_key_hash text, p_waiter_id uuid,
  p_now timestamptz default now())
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
begin
  select * into b from public.pay_bills where id = p_bill_id;
  if not found then return jsonb_build_object('ok', false, 'code', 'gone'); end if;
  if b.place_id is distinct from p_place_id then return jsonb_build_object('ok', false, 'code', 'forbidden'); end if;
  perform public.pay_guest_lock(b.consumer_id);
  perform public.wallet_lock(b.consumer_id, b.place_id);
  select * into b from public.pay_bills where id = p_bill_id for update;

  if b.status = 'accepted' then
    select * into a from public.guest_pay_attempts where id = b.attempt_id for update;
    if a.status = 'closed' then return jsonb_build_object('ok', true, 'outcome', 'paid', 'tab_id', a.tab_id); end if;
    if b.version is distinct from p_version then
      return jsonb_build_object('ok', false, 'code', 'stale', 'version', b.version);
    end if;
    r := public.pay_guest_claim_confirm(a.id, b.place_id, p_key_hash, p_now);
    if (r->>'ok')::boolean is not true then return r; end if;
    r := public.pay_guest_close(a.id, p_now);
    if (r->>'ok')::boolean is not true then raise exception 'receive_close:%', r->>'code'; end if;
    return jsonb_build_object('ok', true, 'outcome', 'paid', 'tab_id', r->>'tab_id');
  end if;

  if b.status <> 'sent' then return jsonb_build_object('ok', false, 'code', b.status); end if;
  if b.expires_at <= p_now then return jsonb_build_object('ok', false, 'code', 'expired'); end if;
  if b.version is distinct from p_version then
    return jsonb_build_object('ok', false, 'code', 'stale', 'version', b.version);
  end if;
  if b.received_version is not distinct from b.version then
    return jsonb_build_object('ok', true, 'outcome', 'ready');
  end if;
  q := public.pay_bill_quote(b.consumer_id, b.place_id, b.currency, b.livemode, b.bill_cents, b.tip_cents, p_now);
  if q is distinct from b.quote then
    update public.pay_bills set quote = q, version = b.version + 1, updated_at = p_now,
           received_version = null, received_at = null, received_key_hash = null, received_waiter_id = null
     where id = b.id;
    return jsonb_build_object('ok', false, 'code', 'stale', 'version', b.version + 1);
  end if;
  update public.pay_bills
     set received_version = b.version, received_at = p_now, received_key_hash = p_key_hash,
         received_waiter_id = p_waiter_id, took_cents = (q->>'outside_cents')::integer, updated_at = p_now
   where id = b.id;
  return jsonb_build_object('ok', true, 'outcome', 'ready');
end;
$function$;

-- The waiter takes it back, until the guest pays.
create function public.pay_bill_unreceive(p_bill_id uuid, p_place_id uuid, p_now timestamptz default now())
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
  if b.status = 'accepted' then return jsonb_build_object('ok', false, 'code', 'accepted'); end if;
  update public.pay_bills set received_version = null, received_at = null, received_key_hash = null, received_waiter_id = null,
         took_cents = null, updated_at = p_now
   where id = b.id and (received_version is not null or took_cents is not null);
  return jsonb_build_object('ok', true, 'outcome', 'undone');
end;
$function$;

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
         received_version = null, received_at = null, received_key_hash = null, received_waiter_id = null,
         expires_at = p_now + make_interval(mins => greatest(least(coalesce(p_window_minutes, 15), 60), 5))
   where id = b.id returning * into b;
  return jsonb_build_object('ok', true, 'outcome', 'sent', 'version', b.version, 'expires_at', b.expires_at);
end;
$function$;

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
  v_ready boolean;
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
    update public.pay_bills set quote = q, version = b.version + 1, updated_at = p_now,
           received_version = null, received_at = null, received_key_hash = null, received_waiter_id = null
     where id = b.id;
    return jsonb_build_object('ok', false, 'code', 'quote_changed', 'version', b.version + 1);
  end if;

  -- The waiter's Receive on these same numbers (MESITA-4889), while their
  -- code still works here.
  v_ready := b.received_version is not distinct from b.version
    and (b.received_waiter_id is null or exists (
      select 1 from public.place_waiters w where w.id = b.received_waiter_id and w.removed_at is null));

  begin
    r := public.pay_guest_begin(
      b.consumer_id, b.place_id, b.currency, b.livemode, p_token_hash,
      b.bill_cents, (q->>'credit_cents')::integer, (q->>'outside_bill_cents')::integer, b.tip_cents,
      0, 0, b.id, null, 0, p_window_minutes, p_now);
    update public.guest_pay_attempts
       set cashback_line = q->>'line', cashback_bps = (q->>'cashback_bps')::integer
     where id = (r->>'attempt_id')::uuid
     returning * into a;
    if v_ready then
      -- Both sides coincide: paid, here and now.
      r := public.pay_guest_claim_confirm(a.id, b.place_id, b.received_key_hash, p_now);
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
        update public.pay_bills
           set version = b.version + 1, updated_at = p_now,
               quote = public.pay_bill_quote(b.consumer_id, b.place_id, b.currency, b.livemode, b.bill_cents, b.tip_cents, p_now),
               received_version = null, received_at = null, received_key_hash = null, received_waiter_id = null
         where id = b.id;
        return jsonb_build_object('ok', false, 'code', 'quote_changed', 'version', b.version + 1);
      end if;
      return v_why || jsonb_build_object('ok', false);
  end;

  update public.pay_bills set status = 'accepted', attempt_id = a.id, updated_at = p_now,
         received_version = null, received_at = null, received_key_hash = null, received_waiter_id = null
   where id = b.id;
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
         expires_at = p_now + interval '15 minutes', updated_at = p_now,
         received_version = null, received_at = null, received_key_hash = null, received_waiter_id = null
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
  update public.pay_bills set status = 'cancelled', updated_at = p_now,
         received_version = null, received_at = null, received_key_hash = null, received_waiter_id = null
   where id = b.id;
  return jsonb_build_object('ok', true, 'outcome', 'cancelled');
end;
$function$;

-- The owner's Received: a bill the credits cover whole waits for it too, and
-- it takes the wallet's lock first, as the close does.
create or replace function public.pay_guest_receive(
  p_attempt_id uuid, p_place_id uuid, p_amount_cents integer, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a public.guest_pay_attempts;
begin
  select * into a from public.guest_pay_attempts where id = p_attempt_id;
  if not found or a.tender not in ('cash', 'credits') then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if a.place_id is distinct from p_place_id then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if a.status = 'closed' then
    return jsonb_build_object('ok', true, 'outcome', 'already', 'tab_id', a.tab_id, 'status', 'paid');
  end if;
  if a.status = 'released' then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;
  if p_amount_cents is distinct from a.cash_cents then
    return jsonb_build_object('ok', false, 'code', 'amount_changed', 'cash_cents', a.cash_cents);
  end if;
  -- The close's own order: the wallet, then the attempt.
  perform public.wallet_lock(a.consumer_id, a.place_id);
  update public.guest_pay_attempts
     set charging_at = coalesce(charging_at, p_now)
   where id = a.id and status in ('due', 'opening') and held_at is not null and ending_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;
  return (select jsonb_set(r, '{outcome}', to_jsonb(case when r->>'outcome' = 'closed' then 'received' else r->>'outcome' end))
            from (select public.pay_guest_close(a.id, p_now) as r) x);
end;
$function$;

revoke all on function public.pay_bill_receive(uuid, uuid, integer, text, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.pay_bill_receive(uuid, uuid, integer, text, uuid, timestamptz) to service_role;
revoke all on function public.pay_bill_unreceive(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.pay_bill_unreceive(uuid, uuid, timestamptz) to service_role;
