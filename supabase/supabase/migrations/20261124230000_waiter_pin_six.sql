-- MESITA-4898 — a waiter's code is six digits (Pato, 2026-11-24: "make the pin 6
-- digits long"; four for an hour, MESITA-4897), and the third wrong one ends the
-- ticket ("if the code fails 3 times, actually terminate the ticket"). Every
-- waiter gets a new code here.
alter table public.place_waiters drop constraint place_waiters_code_pin;
update public.place_waiters set code = null where code is not null;
do $$
declare
  w record;
  v text;
begin
  for w in select id, place_id from public.place_waiters where removed_at is null and not no_code order by created_at loop
    loop
      v := lpad((('x' || substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 7))::bit(28)::integer % 1000000)::text, 6, '0');
      exit when not exists (select 1 from public.place_waiters o where o.place_id = w.place_id and o.code = v);
    end loop;
    update public.place_waiters
       set code = v, lookup_hash = encode(extensions.gen_random_bytes(32), 'hex'), updated_at = now() where id = w.id;
  end loop;
end $$;
alter table public.place_waiters
  add constraint place_waiters_code_pin check (code is null or (code ~ '^[0-9]{6}$' and removed_at is null));
comment on column public.place_waiters.code is 'MESITA-4898: the 6-digit code, unique in its place; what the waiter types.';

alter table public.pay_guest_codes
  add column wrong_codes integer not null default 0,
  add column closed_at timestamptz;
alter table public.pay_bills add column wrong_codes integer not null default 0;
comment on column public.pay_guest_codes.closed_at is
  'MESITA-4898: three wrong waiter codes ended this QR; the guest''s screen says so. A new QR clears it.';

create or replace function public.waiter_code_try(
  p_token_hash text, p_bill_id uuid, p_addr_hash text, p_code text,
  p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  c_window constant interval := interval '10 minutes';
  c_guest_limit constant integer := 15;
  c_addr_limit constant integer := 30;
  c_day constant interval := interval '24 hours';
  c_guest_day constant integer := 15;
  c_addr_day constant integer := 100;
  v_consumer uuid;
  v_guest_key text;
  v_at uuid;
  v_place uuid;
  v_waiter uuid;
  v_until timestamptz;
  c_ticket_limit constant integer := 3;
  v_wrong integer;
begin
  if p_token_hash is not null then
    select consumer_id, place_id into v_consumer, v_at from public.pay_guest_codes
     where (token_hash = p_token_hash and expires_at > p_now)
        or (prev_token_hash = p_token_hash and prev_until > p_now);
  else
    select consumer_id, place_id into v_consumer, v_at from public.pay_bills
     where id = p_bill_id and created_at > p_now - interval '3 hours';
  end if;
  if v_consumer is null then
    return jsonb_build_object('ok', false, 'code', 'code_gone');
  end if;
  -- A PIN is its place's own: the place is the QR's (or the bill's).
  if v_at is null then
    return jsonb_build_object('ok', false, 'code', 'place_needed');
  end if;
  v_guest_key := encode(sha256(convert_to('waiter-code-guest:' || v_consumer::text, 'UTF8')), 'hex');
  -- The guest's lock first, as every bill call: a close here never meets a Pay.
  perform public.pay_guest_lock(v_consumer);
  perform pg_advisory_xact_lock(hashtextextended('waiter-code:' || v_guest_key, 0));
  perform pg_advisory_xact_lock(hashtextextended('waiter-code:' || p_addr_hash, 0));

  select max(u) into v_until from (
    (select tried_at + c_window as u from public.place_charge_tries
      where place_id is null and kind = 'guest' and addr_hash = v_guest_key and tried_at > p_now - c_window
      order by tried_at desc offset c_guest_limit - 1 limit 1)
    union all
    (select tried_at + c_window from public.place_charge_tries
      where place_id is null and kind = 'staff' and addr_hash = p_addr_hash and tried_at > p_now - c_window
      order by tried_at desc offset c_addr_limit - 1 limit 1)
    union all
    (select tried_at + c_day from public.place_charge_tries
      where place_id is null and kind = 'guest' and addr_hash = v_guest_key and tried_at > p_now - c_day
      order by tried_at desc offset c_guest_day - 1 limit 1)
    union all
    (select tried_at + c_day from public.place_charge_tries
      where place_id is null and kind = 'staff' and addr_hash = p_addr_hash and tried_at > p_now - c_day
      order by tried_at desc offset c_addr_day - 1 limit 1)) locks;
  if v_until is not null then
    return jsonb_build_object('ok', false, 'code', 'locked',
      'retry_after_s', greatest(ceil(extract(epoch from v_until - p_now))::integer, 1));
  end if;

  select w.place_id, w.id into v_place, v_waiter from public.place_waiters w
    join public.places p on p.id = w.place_id and p.state = 'active'
   where w.place_id = v_at and w.code = p_code and w.removed_at is null and not w.no_code;
  if v_place is null then
    insert into public.place_charge_tries (place_id, kind, addr_hash, tried_at)
    values (null, 'guest', v_guest_key, p_now), (null, 'staff', p_addr_hash, p_now);
    -- The third wrong one ends the ticket (MESITA-4898): the QR, or a bill the
    -- guest has not accepted.
    if p_token_hash is not null then
      update public.pay_guest_codes set wrong_codes = wrong_codes + 1
       where consumer_id = v_consumer returning wrong_codes into v_wrong;
      if v_wrong >= c_ticket_limit then
        update public.pay_guest_codes
           set closed_at = p_now, expires_at = p_now, prev_token_hash = null, prev_until = null,
               draft_bill_cents = null, draft_tip_cents = null, draft_step = null, draft_at = null
         where consumer_id = v_consumer;
      end if;
    else
      update public.pay_bills set wrong_codes = wrong_codes + 1 where id = p_bill_id returning wrong_codes into v_wrong;
      if v_wrong >= c_ticket_limit then
        update public.pay_bills
           set status = 'cancelled', updated_at = p_now,
               received_version = null, received_at = null, received_key_hash = null, received_waiter_id = null
         where id = p_bill_id and status in ('open', 'sent', 'declined');
        if not found then
          return jsonb_build_object('ok', false, 'code', 'staff_only', 'left', 0);
        end if;
      end if;
    end if;
    if v_wrong >= c_ticket_limit then
      return jsonb_build_object('ok', false, 'code', 'ticket_closed');
    end if;
    return jsonb_build_object('ok', false, 'code', 'staff_only', 'left', c_ticket_limit - v_wrong);
  end if;
  update public.pay_guest_codes set wrong_codes = 0 where p_token_hash is not null and consumer_id = v_consumer and wrong_codes > 0;
  update public.pay_bills set wrong_codes = 0 where id = p_bill_id and wrong_codes > 0;
  return jsonb_build_object('ok', true, 'place_id', v_place, 'waiter_id', v_waiter);
end;
$function$;

create or replace function public.pay_guest_code_set(
  p_consumer_id uuid, p_token_hash text, p_short_hash text default null,
  p_ttl interval default interval '10 minutes', p_now timestamptz default now(), p_place_id uuid default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  perform public.pay_guest_lock(p_consumer_id);
  insert into public.pay_guest_codes (consumer_id, token_hash, expires_at, updated_at, place_id)
  values (p_consumer_id, p_token_hash, p_now + p_ttl, p_now, (select id from public.places where id = p_place_id))
  on conflict (consumer_id) do update
    set prev_token_hash = case when pay_guest_codes.expires_at > p_now then pay_guest_codes.token_hash end,
        prev_until = case when pay_guest_codes.expires_at > p_now then p_now + interval '5 minutes' end,
        token_hash = excluded.token_hash,
        place_id = coalesce(excluded.place_id, case when pay_guest_codes.expires_at > p_now then pay_guest_codes.place_id end),
        -- A new QR is a new ticket only once the old one ended.
        wrong_codes = case when pay_guest_codes.expires_at > p_now then pay_guest_codes.wrong_codes else 0 end, closed_at = null,
        expires_at = excluded.expires_at, updated_at = p_now;
  return jsonb_build_object('ok', true, 'expires_at', p_now + p_ttl);
end;
$function$;
