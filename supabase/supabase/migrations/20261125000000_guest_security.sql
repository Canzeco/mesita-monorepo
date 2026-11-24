-- MESITA-4899 — Admin › Security (Pato, 2026-11-24: "if same restaurant gets 5
-- times a ticket terminated due to failed codes (15 failed inputs) then suspend
-- the consumer account that generated that qr").
--   guest_ticket_closures  every ticket three wrong codes ended
--   guest_suspensions      the guests suspended for five at one restaurant in 30
--                          days, until Mesita reinstates them (the count starts over)
-- The guest's doors (_shared/request.ts) refuse a suspended one.
create table public.guest_ticket_closures (
  id uuid primary key default gen_random_uuid(),
  consumer_id uuid not null references public.consumers (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index guest_ticket_closures_guest on public.guest_ticket_closures (consumer_id, place_id, created_at desc);
create index guest_ticket_closures_at on public.guest_ticket_closures (created_at desc);
alter table public.guest_ticket_closures enable row level security;
revoke all on table public.guest_ticket_closures from public, anon, authenticated;
grant all on table public.guest_ticket_closures to service_role;
comment on table public.guest_ticket_closures is 'MESITA-4899: a ticket ended by three wrong waiter codes, whose QR and where. EF-only.';

create table public.guest_suspensions (
  id uuid primary key default gen_random_uuid(),
  consumer_id uuid not null references public.consumers (id) on delete cascade,
  place_id uuid references public.places (id) on delete set null,
  closures integer not null check (closures > 0),
  suspended_at timestamptz not null default now(),
  reinstated_at timestamptz,
  reinstated_by uuid
);
create unique index guest_suspensions_active on public.guest_suspensions (consumer_id) where reinstated_at is null;
create index guest_suspensions_at on public.guest_suspensions (suspended_at desc);
alter table public.guest_suspensions enable row level security;
revoke all on table public.guest_suspensions from public, anon, authenticated;
grant all on table public.guest_suspensions to service_role;
comment on table public.guest_suspensions is 'MESITA-4899: a suspended guest account, and when Mesita reinstated it. EF-only.';

create function public.guest_ticket_closed(p_consumer_id uuid, p_place_id uuid, p_now timestamptz default now())
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  c_limit constant integer := 5;
  v_count integer;
begin
  insert into public.guest_ticket_closures (consumer_id, place_id, created_at) values (p_consumer_id, p_place_id, p_now);
  select count(*) into v_count from public.guest_ticket_closures
   where consumer_id = p_consumer_id and place_id = p_place_id and created_at > p_now - interval '30 days'
     and created_at > coalesce((select max(reinstated_at) from public.guest_suspensions where consumer_id = p_consumer_id), '-infinity');
  if v_count < c_limit then return false; end if;
  insert into public.guest_suspensions (consumer_id, place_id, closures, suspended_at)
  values (p_consumer_id, p_place_id, v_count, p_now)
  on conflict (consumer_id) where reinstated_at is null do nothing;
  return true;
end;
$function$;
revoke all on function public.guest_ticket_closed(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.guest_ticket_closed(uuid, uuid, timestamptz) to service_role;

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
      perform public.guest_ticket_closed(v_consumer, v_at, p_now);
      return jsonb_build_object('ok', false, 'code', 'ticket_closed');
    end if;
    return jsonb_build_object('ok', false, 'code', 'staff_only', 'left', c_ticket_limit - v_wrong);
  end if;
  update public.pay_guest_codes set wrong_codes = 0 where p_token_hash is not null and consumer_id = v_consumer and wrong_codes > 0;
  update public.pay_bills set wrong_codes = 0 where id = p_bill_id and wrong_codes > 0;
  return jsonb_build_object('ok', true, 'place_id', v_place, 'waiter_id', v_waiter);
end;
$function$;
