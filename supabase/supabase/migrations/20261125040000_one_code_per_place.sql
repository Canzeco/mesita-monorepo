-- MESITA-4904 — one 6-digit code per place (Pato, 2026-11-24: "just one 6-digits
-- code per place thats it"), and an optional name typed with it ("its just a
-- toggle"). place_waiters keeps one live code row a place, named Staff; a place
-- gets it with its owner. A typed name is the bill's, never proof of a person.
-- Payments still need their own switches.
-- Rollback: drop the index and the trigger; codes removed here stay removed.
update public.place_waiters w set removed_at = now(), lookup_hash = null, code = null, updated_at = now()
 where w.removed_at is null and not w.no_code
   and exists (select 1 from public.place_waiters o
                where o.place_id = w.place_id and o.removed_at is null and not o.no_code
                  and (o.created_at, o.id) < (w.created_at, w.id));
update public.place_waiters set name = 'Staff', updated_at = now() where removed_at is null and not no_code and name <> 'Staff';
create unique index place_waiters_one_code on public.place_waiters (place_id) where removed_at is null and not no_code;
alter table public.place_waiters add column name_required boolean not null default false;
comment on column public.place_waiters.name_required is 'MESITA-4904: the waiter types their name before the code.';
alter table public.pay_bills add column waiter_name text
  check (waiter_name is null or char_length(waiter_name) between 1 and 40);
comment on column public.pay_bills.waiter_name is 'MESITA-4904: the name typed with the code by who sent the bill last; null when none was asked.';

drop function public.pay_bill_send(uuid, uuid, integer, integer, integer, text, integer, timestamptz, uuid);
create function public.pay_bill_send(
  p_bill_id uuid, p_place_id uuid, p_version integer, p_bill_cents integer, p_tip_cents integer,
  p_key_hash text, p_window_minutes integer default 15, p_now timestamptz default now(),
  p_waiter_id uuid default null, p_waiter_name text default null)
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
         quote = q, staff_key_hash = p_key_hash, waiter_id = p_waiter_id, waiter_name = p_waiter_name, updated_at = p_now,
         received_version = null, received_at = null, received_key_hash = null, received_waiter_id = null,
         expires_at = p_now + make_interval(mins => greatest(least(coalesce(p_window_minutes, 15), 60), 5))
   where id = b.id returning * into b;
  return jsonb_build_object('ok', true, 'outcome', 'sent', 'version', b.version, 'expires_at', b.expires_at);
end;
$function$;
revoke all on function public.pay_bill_send(uuid, uuid, integer, integer, integer, text, integer, timestamptz, uuid, text) from public, anon, authenticated;
grant execute on function public.pay_bill_send(uuid, uuid, integer, integer, integer, text, integer, timestamptz, uuid, text) to service_role;

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
  -- The name typed with the code, when the place asks for one (MESITA-4904). A waiter-led
  -- attempt's request id is its bill.
  select w.id, b.waiter_name into v_waiter, v_waiter_name
    from public.pay_bills b join public.place_waiters w on w.id = b.waiter_id and not w.no_code
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

-- Whether the place of this live QR, or of this bill, asks for a name.
create function public.waiter_name_required(p_token_hash text, p_bill_id uuid, p_now timestamptz default now())
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1 from public.place_waiters w
     where w.name_required and not w.no_code and w.removed_at is null
       and w.place_id = case when p_token_hash is not null
         then (select c.place_id from public.pay_guest_codes c
                where (c.token_hash = p_token_hash and c.expires_at > p_now)
                   or (c.prev_token_hash = p_token_hash and c.prev_until > p_now))
         else (select b.place_id from public.pay_bills b where b.id = p_bill_id and b.created_at > p_now - interval '3 hours') end);
$function$;
revoke all on function public.waiter_name_required(text, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.waiter_name_required(text, uuid, timestamptz) to service_role;

create function public.place_staff_code_start(p_place_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  perform pg_advisory_xact_lock(hashtextextended('staff-code:' || p_place_id::text, 0));
  if exists (select 1 from public.place_waiters where place_id = p_place_id and not no_code and removed_at is null) then return; end if;
  insert into public.place_waiters (place_id, name, code, lookup_hash)
  values (p_place_id, 'Staff',
    lpad((('x' || substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 7))::bit(28)::integer % 1000000)::text, 6, '0'),
    encode(extensions.gen_random_bytes(32), 'hex'));
end;
$function$;
revoke all on function public.place_staff_code_start(uuid) from public, anon, authenticated;
grant execute on function public.place_staff_code_start(uuid) to service_role;

create function public.place_owner_staff_code()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.role = 'owner' and new.revoked_at is null then
    perform public.place_staff_code_start(new.place_id);
  end if;
  return new;
end;
$function$;
revoke all on function public.place_owner_staff_code() from public, anon, authenticated;
create trigger place_owner_staff_code after insert or update of role, revoked_at on public.place_managers
  for each row execute function public.place_owner_staff_code();

select public.place_staff_code_start(place_id)
  from (select distinct place_id from public.place_managers where role = 'owner' and revoked_at is null) o;
