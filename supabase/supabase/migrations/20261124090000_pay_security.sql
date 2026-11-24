-- MESITA-4833 — the pay-flow audit's security findings (Pato, 2026-11-24:
-- "Yes, fix 5-7").
--   5  300 new bills an hour per place (the old limit counted a key that is
--      new on every code entry)
--   6  the guest's six digits are gone: a bill opens by the QR alone
--   7  a waiter code is tried only with a guest's live QR (or a bill), and
--      wrong ones count per guest and per address, under a lock

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
        or (prev_token_hash = p_code_hash and prev_until > p_now);
    if v_consumer is null then
      return jsonb_build_object('ok', false, 'code', 'code_gone');
    end if;
  end if;

  perform public.pay_guest_lock(v_consumer);
  -- The waiter lost the page of a bill the guest accepted: the rescan is that
  -- bill, still waiting for Received (MESITA-4831).
  select pb.* into b from public.pay_bills pb
    join public.guest_pay_attempts ga on ga.id = pb.attempt_id
   where pb.consumer_id = v_consumer and pb.place_id = p_place_id and pb.livemode = p_livemode
     and pb.status = 'accepted' and ga.status in ('opening', 'due')
     and (ga.expires_at > p_now or ga.charging_at is not null)
   order by pb.updated_at desc limit 1;
  if found then
    return jsonb_build_object('ok', true, 'outcome', 'accepted', 'bill_id', b.id);
  end if;
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
     or (select count(*) from public.pay_bills where place_id = p_place_id
        and created_at > p_now - interval '1 hour') >= 300 then
    return jsonb_build_object('ok', false, 'code', 'too_many');
  end if;
  insert into public.pay_bills (consumer_id, place_id, livemode, currency, staff_key_hash, expires_at, created_at, updated_at)
  values (v_consumer, p_place_id, p_livemode, lower(p_currency), p_key_hash, p_now + interval '15 minutes', p_now, p_now)
  returning * into b;
  return jsonb_build_object('ok', true, 'outcome', 'opened', 'bill_id', b.id);
end;
$function$;

-- p_short_hash is ignored: a function not redeployed yet still names it.
create or replace function public.pay_guest_code_set(
  p_consumer_id uuid, p_token_hash text, p_short_hash text default null,
  p_ttl interval default interval '10 minutes', p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  perform public.pay_guest_lock(p_consumer_id);
  insert into public.pay_guest_codes (consumer_id, token_hash, expires_at, updated_at)
  values (p_consumer_id, p_token_hash, p_now + p_ttl, p_now)
  on conflict (consumer_id) do update
    set prev_token_hash = case when pay_guest_codes.expires_at > p_now then pay_guest_codes.token_hash end,
        prev_until = case when pay_guest_codes.expires_at > p_now then p_now + interval '5 minutes' end,
        token_hash = excluded.token_hash,
        expires_at = excluded.expires_at, updated_at = p_now;
  return jsonb_build_object('ok', true, 'expires_at', p_now + p_ttl);
end;
$function$;

alter table public.pay_guest_codes drop column if exists short_hash;
comment on table public.pay_guest_codes is
  'MESITA-4823: the guest''s one Mesita QR, hashed and rotating. It names no place and moves no money. EF-only.';

-- The waiter's code, one try. p_token_hash is the guest's QR, or p_bill_id a
-- bill on this phone's screen.
-- Every try of one guest, and of one address, waits its turn: the count is
-- exact however many arrive at once.
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

  select c.place_id into v_place from public.place_codes c
    join public.places p on p.id = c.place_id and p.state = 'active'
   where c.lookup_hash = p_lookup_hash;
  if v_place is null then
    insert into public.place_charge_tries (place_id, kind, addr_hash, tried_at)
    values (null, 'guest', v_guest_key, p_now), (null, 'staff', p_addr_hash, p_now);
    return jsonb_build_object('ok', false, 'code', 'staff_only');
  end if;
  return jsonb_build_object('ok', true, 'place_id', v_place);
end;
$function$;

revoke all on function public.pay_bill_open(text, uuid, uuid, text, boolean, text, timestamptz) from public, anon, authenticated;
grant execute on function public.pay_bill_open(text, uuid, uuid, text, boolean, text, timestamptz) to service_role;
revoke all on function public.pay_guest_code_set(uuid, text, text, interval, timestamptz) from public, anon, authenticated;
grant execute on function public.pay_guest_code_set(uuid, text, text, interval, timestamptz) to service_role;
revoke all on function public.waiter_code_try(text, uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.waiter_code_try(text, uuid, text, text, timestamptz) to service_role;
