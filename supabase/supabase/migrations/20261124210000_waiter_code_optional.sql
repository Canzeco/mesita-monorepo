-- MESITA-4890 — bills without a waiter code, at Discount places only (Pato,
-- 2026-11-24: "enable the mode of no password, only for discounts, if you want
-- to activate cashbacks, then you do need a code").
--
-- The mode is one place_waiters row, no_code: it has a key nobody can type, so
-- the waiter's calls, tokens and refusals stay one path. The place comes from the
-- page the guest opened their QR on (pay_guest_codes.place_id). Cashback ends it.
-- Rollback: delete the no_code rows and drop the trigger.
alter table public.place_waiters add column no_code boolean not null default false;
create unique index place_waiters_one_no_code on public.place_waiters (place_id) where no_code and removed_at is null;
comment on column public.place_waiters.no_code is
  'MESITA-4890: the place''s bills need no waiter code (Discount only). Not a person: never listed, never named on a visit.';
alter table public.pay_guest_codes add column place_id uuid references public.places (id) on delete set null;
comment on column public.pay_guest_codes.place_id is
  'MESITA-4890: the place whose page the guest opened this QR on. Read only to send a bill without a code.';

-- Cashback makes credit out of a bill: it needs a code again, at once.
create function public.place_cashback_needs_code()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.visit_mechanism <> 'discount' then
    update public.place_waiters set removed_at = now(), lookup_hash = null, code = null, updated_at = now()
     where place_id = new.place_id and no_code and removed_at is null;
  end if;
  return new;
end;
$function$;
create trigger place_cashback_needs_code after insert or update of visit_mechanism on public.place_cashback_settings
  for each row execute function public.place_cashback_needs_code();
revoke all on function public.place_cashback_needs_code() from public, anon, authenticated;

drop function public.pay_guest_code_set(uuid, text, text, interval, timestamptz);
create function public.pay_guest_code_set(
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
        token_hash = excluded.token_hash, place_id = excluded.place_id,
        expires_at = excluded.expires_at, updated_at = p_now;
  return jsonb_build_object('ok', true, 'expires_at', p_now + p_ttl);
end;
$function$;
revoke all on function public.pay_guest_code_set(uuid, text, text, interval, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.pay_guest_code_set(uuid, text, text, interval, timestamptz, uuid) to service_role;

-- Who sends this QR's bill without a code: the mode's row, or null (a code is
-- needed). A bill already open answers for its own place.
create function public.waiter_no_code(p_token_hash text, p_bill_id uuid, p_now timestamptz default now())
 returns uuid
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select w.id from public.place_waiters w
   where w.no_code and w.removed_at is null
     and w.place_id = case when p_token_hash is not null
       then (select c.place_id from public.pay_guest_codes c
              where (c.token_hash = p_token_hash and c.expires_at > p_now)
                 or (c.prev_token_hash = p_token_hash and c.prev_until > p_now))
       else (select b.place_id from public.pay_bills b where b.id = p_bill_id and b.created_at > p_now - interval '3 hours') end
     and public.place_visit_mechanism(w.place_id) = 'discount';
$function$;
revoke all on function public.waiter_no_code(text, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.waiter_no_code(text, uuid, timestamptz) to service_role;

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
revoke all on function public.pay_guest_insert_closed(public.guest_pay_attempts, timestamptz) from public, anon, authenticated;
grant execute on function public.pay_guest_insert_closed(public.guest_pay_attempts, timestamptz) to service_role;

create or replace function public.place_waiter_list(p_place_id uuid, p_livemode boolean, p_now timestamptz default now())
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
   where w.place_id = p_place_id and not w.no_code
   group by w.id
  having w.removed_at is null or count(t.id) > 0
   order by w.removed_at is not null, lower(w.name);
$function$;
revoke all on function public.place_waiter_list(uuid, boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.place_waiter_list(uuid, boolean, timestamptz) to service_role;
