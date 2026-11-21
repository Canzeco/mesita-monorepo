-- MESITA-4502 — a new guest pay does not save a ticket until it is closed.
--
-- Card and wallet: the attempt holds the credit and the PaymentIntent. The
-- pay_tabs row is inserted when that PaymentIntent has succeeded. Dismiss
-- releases the attempt and writes no ticket.
-- Cash: the attempt is the amount on the Payments list. The ticket is
-- inserted when a signed-in business user marks it Received. Expiry
-- releases the credit and writes no ticket.
-- Credits-only, tip zero: the closed ticket is the insert.
-- A tab already waiting for Sign is untouched.

alter table public.consumers
  add column if not exists pay_method text
    check (pay_method is null or pay_method in ('card', 'apple_pay', 'google_pay'));

comment on column public.consumers.pay_method is
  'MESITA-4502: the one saved way to pay a bill. card, apple_pay, or google_pay. Null means the saved card when one exists. Cash is not stored here.';

create table public.guest_pay_attempts (
  id uuid primary key default gen_random_uuid(),
  consumer_id uuid not null references public.consumers (id),
  place_id uuid not null references public.places (id),
  request_id uuid not null,
  bill_cents integer not null check (bill_cents > 0 and bill_cents <= 10000000),
  tip_cents integer not null default 0 check (tip_cents >= 0 and tip_cents <= 10000000),
  credit_cents integer not null default 0 check (credit_cents >= 0),
  cash_cents integer not null default 0 check (cash_cents >= 0),
  card_cents integer not null default 0 check (card_cents >= 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  livemode boolean not null,
  tender text not null check (tender in ('credits', 'card', 'cash')),
  status text not null check (status in ('opening', 'due', 'closed', 'released')),
  payment_id uuid references public.wallet_payments (id),
  tab_id uuid references public.pay_tabs (id),
  guest_label text not null,
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (consumer_id, request_id)
);

create unique index guest_pay_attempts_one_open
  on public.guest_pay_attempts (consumer_id, livemode)
  where status in ('opening', 'due');

create index guest_pay_attempts_due_idx
  on public.guest_pay_attempts (place_id, created_at)
  where status = 'due';

alter table public.guest_pay_attempts enable row level security;
revoke all on table public.guest_pay_attempts from public, anon, authenticated;
grant all on table public.guest_pay_attempts to service_role;

comment on table public.guest_pay_attempts is
  'MESITA-4502: a new guest pay before it is a ticket. opening is a card or wallet still in flight. due is cash to hand over. closed points at the pay_tabs receipt. released wrote nothing. EF-only.';

-- The close key is sha256("mesita-guest-closed"). It is not a staff device.
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
    expires_at, origin)
  values (
    p_attempt.place_id, p_attempt.consumer_id, p_attempt.token_hash, 'paid',
    p_attempt.currency, p_attempt.livemode, p_attempt.bill_cents, p_attempt.tip_cents,
    1, p_now, p_attempt.request_id, p_attempt.credit_cents,
    case when p_attempt.tender = 'cash' then p_attempt.cash_cents - p_attempt.tip_cents else 0 end,
    case when p_attempt.tender = 'cash' then p_attempt.tip_cents else 0 end,
    case when p_attempt.tender = 'card' then p_attempt.card_cents - p_attempt.tip_cents else 0 end,
    case when p_attempt.tender = 'card' then p_attempt.tip_cents else 0 end,
    case when p_attempt.tender = 'cash' then p_attempt.cash_cents else null end,
    p_now, p_now, p_now, v_key, p_attempt.expires_at, 'guest')
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

create or replace function public.pay_guest_begin(
  p_consumer_id uuid, p_place_id uuid, p_currency text, p_livemode boolean, p_token_hash text,
  p_bill_cents integer, p_credit_cents integer, p_cash_bill_cents integer, p_cash_tip_cents integer,
  p_card_bill_cents integer, p_card_tip_cents integer, p_request_id uuid,
  p_stripe_account_id text, p_card_fee_cents integer, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a public.guest_pay_attempts;
  v_open record;
  v_spendable integer;
  v_pay uuid;
  v_tab uuid;
  v_label text;
  v_tender text;
  v_expires timestamptz := p_now + interval '1 hour';
  v_cur text := lower(p_currency);
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'guest_refused:%', jsonb_build_object('code', 'bad_request');
  end if;
  if coalesce(p_bill_cents, 0) <= 0
     or coalesce(p_credit_cents, -1) < 0 or coalesce(p_cash_bill_cents, -1) < 0
     or coalesce(p_cash_tip_cents, -1) < 0 or coalesce(p_card_bill_cents, -1) < 0
     or coalesce(p_card_tip_cents, -1) < 0 then
    raise exception 'guest_refused:%', jsonb_build_object('code', 'amount_required');
  end if;
  if p_credit_cents + p_cash_bill_cents + p_card_bill_cents <> p_bill_cents
     or p_credit_cents > p_bill_cents
     or (p_cash_tip_cents > 0 and p_card_tip_cents > 0)
     or (p_cash_bill_cents + p_cash_tip_cents > 0 and p_card_bill_cents + p_card_tip_cents > 0) then
    raise exception 'guest_refused:%', jsonb_build_object('code', 'parts');
  end if;
  if p_credit_cents > p_bill_cents then
    raise exception 'guest_refused:%', jsonb_build_object('code', 'tip_by_credit');
  end if;

  perform public.wallet_lock(p_consumer_id, p_place_id);

  select * into a from public.guest_pay_attempts
   where consumer_id = p_consumer_id and request_id = p_request_id;
  if found then
    return jsonb_build_object(
      'ok', true, 'outcome', 'replayed', 'attempt_id', a.id, 'tab_id', a.tab_id,
      'status', a.status, 'payment_id', a.payment_id, 'card_payment_id', a.payment_id,
      'expires_at', a.expires_at, 'cash_cents', a.cash_cents, 'guest_label', a.guest_label);
  end if;

  select id, place_id into v_open from public.pay_tabs
   where consumer_id = p_consumer_id and livemode = p_livemode and origin = 'guest'
     and verified_at is null and status in ('paying', 'paid') and expires_at > p_now
   limit 1;
  if found then
    raise exception 'guest_refused:%', jsonb_build_object(
      'code', 'too_many_open', 'open_tab_id', v_open.id, 'open_place_id', v_open.place_id);
  end if;
  select id, place_id into v_open from public.guest_pay_attempts
   where consumer_id = p_consumer_id and livemode = p_livemode and status in ('opening', 'due')
   limit 1;
  if found then
    raise exception 'guest_refused:%', jsonb_build_object(
      'code', 'too_many_open', 'open_attempt_id', v_open.id, 'open_place_id', v_open.place_id);
  end if;

  select b.spendable_cents into v_spendable
    from public.wallet_balance(p_consumer_id, p_place_id, v_cur, p_livemode) b;
  if p_credit_cents > coalesce(v_spendable, 0) then
    raise exception 'guest_refused:%', jsonb_build_object(
      'code', 'insufficient', 'spendable_cents', coalesce(v_spendable, 0));
  end if;

  select coalesce(nullif(trim(first_name), ''), 'Guest') into v_label
    from public.consumers where id = p_consumer_id;
  v_label := coalesce(left(v_label, 40), 'Guest');

  if p_card_bill_cents + p_card_tip_cents > 0 then
    v_tender := 'card';
  elsif p_cash_bill_cents + p_cash_tip_cents > 0 then
    v_tender := 'cash';
  else
    v_tender := 'credits';
  end if;

  if v_tender = 'card' then
    if p_stripe_account_id is null then
      raise exception 'guest_refused:%', jsonb_build_object('code', 'card_unavailable');
    end if;
    insert into public.wallet_payments (
      consumer_id, place_id, amount_cents, credit_cents, card_cents, outside_cents, tip_cents,
      currency, status, stripe_account_id, application_fee_cents, request_id, livemode, expires_at, part)
    values (
      p_consumer_id, p_place_id, p_credit_cents + p_card_bill_cents, p_credit_cents, p_card_bill_cents, 0,
      p_card_tip_cents, v_cur, 'opening', p_stripe_account_id, greatest(coalesce(p_card_fee_cents, 0), 0),
      md5(p_request_id::text || ':card')::uuid, p_livemode, v_expires, 'card')
    returning id into v_pay;
  elsif v_tender = 'cash' and p_credit_cents + p_cash_bill_cents > 0 then
    insert into public.wallet_payments (
      consumer_id, place_id, amount_cents, credit_cents, card_cents, outside_cents, tip_cents,
      currency, status, request_id, livemode, expires_at, part)
    values (
      p_consumer_id, p_place_id, p_credit_cents + p_cash_bill_cents, p_credit_cents, 0, p_cash_bill_cents,
      p_cash_tip_cents, v_cur, 'open', p_request_id, p_livemode, v_expires, 'outside')
    returning id into v_pay;
  elsif v_tender = 'credits' then
    insert into public.wallet_payments (
      consumer_id, place_id, amount_cents, credit_cents, card_cents, outside_cents, tip_cents,
      currency, status, request_id, livemode, expires_at, part, paid_at)
    values (
      p_consumer_id, p_place_id, p_credit_cents, p_credit_cents, 0, 0, 0,
      v_cur, 'paid', p_request_id, p_livemode, v_expires, 'credit', p_now)
    returning id into v_pay;
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
    values (p_consumer_id, p_place_id, 'spend', -p_credit_cents, v_cur, v_pay, p_livemode, p_now);
  end if;

  insert into public.guest_pay_attempts (
    consumer_id, place_id, request_id, bill_cents, tip_cents, credit_cents, cash_cents, card_cents,
    currency, livemode, tender, status, payment_id, guest_label, token_hash, expires_at)
  values (
    p_consumer_id, p_place_id, p_request_id, p_bill_cents,
    case when v_tender = 'card' then p_card_tip_cents when v_tender = 'cash' then p_cash_tip_cents else 0 end,
    p_credit_cents,
    case when v_tender = 'cash' then p_cash_bill_cents + p_cash_tip_cents else 0 end,
    case when v_tender = 'card' then p_card_bill_cents + p_card_tip_cents else 0 end,
    v_cur, p_livemode, v_tender,
    case when v_tender = 'credits' then 'closed' when v_tender = 'cash' then 'due' else 'opening' end,
    v_pay, v_label, p_token_hash, v_expires)
  returning * into a;

  if v_tender = 'credits' then
    v_tab := public.pay_guest_insert_closed(a, p_now);
    return jsonb_build_object(
      'ok', true, 'outcome', 'opened', 'attempt_id', a.id, 'tab_id', v_tab,
      'status', 'paid', 'payment_id', v_pay, 'expires_at', v_expires, 'guest_label', v_label);
  end if;

  return jsonb_build_object(
    'ok', true, 'outcome', 'opened', 'attempt_id', a.id, 'tab_id', null,
    'status', a.status, 'payment_id', v_pay, 'card_payment_id', case when v_tender = 'card' then v_pay end,
    'expires_at', v_expires, 'cash_cents', a.cash_cents, 'guest_label', v_label);
end;
$function$;

create or replace function public.pay_guest_close(p_attempt_id uuid, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a public.guest_pay_attempts;
  w public.wallet_payments;
  v_tab uuid;
begin
  select * into a from public.guest_pay_attempts where id = p_attempt_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if a.status = 'closed' then
    return jsonb_build_object('ok', true, 'outcome', 'already', 'attempt_id', a.id, 'tab_id', a.tab_id, 'status', 'paid');
  end if;
  if a.status <> 'opening' or a.tender <> 'card' or a.payment_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_open');
  end if;
  select * into w from public.wallet_payments where id = a.payment_id;
  if w.paid_at is null then
    return jsonb_build_object('ok', false, 'code', 'card_pending');
  end if;
  v_tab := public.pay_guest_insert_closed(a, p_now);
  return jsonb_build_object('ok', true, 'outcome', 'closed', 'attempt_id', a.id, 'tab_id', v_tab, 'status', 'paid');
end;
$function$;

create or replace function public.pay_guest_release(p_consumer_id uuid, p_request_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a public.guest_pay_attempts;
begin
  select * into a from public.guest_pay_attempts
   where consumer_id = p_consumer_id and request_id = p_request_id;
  if not found then
    return jsonb_build_object('ok', true, 'outcome', 'none');
  end if;
  perform public.wallet_lock(a.consumer_id, a.place_id);
  select * into a from public.guest_pay_attempts where id = a.id for update;
  if a.status = 'closed' then
    return jsonb_build_object('ok', true, 'outcome', 'closed', 'tab_id', a.tab_id);
  end if;
  if a.status = 'released' then
    return jsonb_build_object('ok', true, 'outcome', 'released');
  end if;
  if a.payment_id is not null then
    update public.wallet_payments
       set status = 'failed', updated_at = now()
     where id = a.payment_id and paid_at is null and status in ('opening', 'open');
  end if;
  update public.guest_pay_attempts set status = 'released' where id = a.id and status in ('opening', 'due');
  return jsonb_build_object('ok', true, 'outcome', 'released', 'attempt_id', a.id);
end;
$function$;

create or replace function public.pay_guest_receive(
  p_attempt_id uuid, p_place_id uuid, p_amount_cents integer, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a public.guest_pay_attempts;
  w public.wallet_payments;
  v_tab uuid;
begin
  select * into a from public.guest_pay_attempts where id = p_attempt_id;
  if not found or a.tender <> 'cash' then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if a.place_id is distinct from p_place_id then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  perform public.wallet_lock(a.consumer_id, a.place_id);
  select * into a from public.guest_pay_attempts where id = p_attempt_id for update;
  if a.status = 'closed' then
    return jsonb_build_object('ok', true, 'outcome', 'already', 'tab_id', a.tab_id, 'status', 'paid');
  end if;
  if a.status = 'released' or a.expires_at <= p_now then
    if a.status = 'due' then
      update public.wallet_payments
         set status = 'expired', updated_at = now()
       where id = a.payment_id and paid_at is null and status in ('opening', 'open');
      update public.guest_pay_attempts set status = 'released' where id = a.id;
    end if;
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;
  if a.status <> 'due' then
    return jsonb_build_object('ok', false, 'code', 'not_due');
  end if;
  if p_amount_cents is distinct from a.cash_cents then
    return jsonb_build_object('ok', false, 'code', 'amount_changed', 'cash_cents', a.cash_cents);
  end if;
  if a.payment_id is not null then
    select * into w from public.wallet_payments where id = a.payment_id for update;
    if w.paid_at is null and w.status in ('opening', 'open') and w.credit_cents > 0 then
      update public.wallet_payments set status = 'paid', paid_at = p_now, updated_at = now() where id = w.id;
      insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
      values (w.consumer_id, w.place_id, 'spend', -w.credit_cents, w.currency, w.id, w.livemode, p_now);
    elsif w.paid_at is null and w.status in ('opening', 'open') then
      update public.wallet_payments set status = 'paid', paid_at = p_now, updated_at = now() where id = w.id;
    elsif w.status in ('failed', 'expired') then
      return jsonb_build_object('ok', false, 'code', 'released');
    end if;
  end if;
  v_tab := public.pay_guest_insert_closed(a, p_now);
  return jsonb_build_object('ok', true, 'outcome', 'received', 'tab_id', v_tab, 'status', 'paid');
end;
$function$;

create or replace function public.consumer_set_pay_method(p_consumer_id uuid, p_method text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if p_method is null or p_method not in ('card', 'apple_pay', 'google_pay') then
    return jsonb_build_object('ok', false, 'code', 'bad_method');
  end if;
  update public.consumers set pay_method = p_method where id = p_consumer_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  return jsonb_build_object('ok', true, 'pay_method', p_method);
end;
$function$;

revoke all on function public.pay_guest_insert_closed(public.guest_pay_attempts, timestamptz) from public, anon, authenticated;
revoke all on function public.pay_guest_begin(uuid, uuid, text, boolean, text, integer, integer, integer, integer, integer, integer, uuid, text, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.pay_guest_close(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.pay_guest_release(uuid, uuid) from public, anon, authenticated;
revoke all on function public.pay_guest_receive(uuid, uuid, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.consumer_set_pay_method(uuid, text) from public, anon, authenticated;
grant execute on function public.pay_guest_insert_closed(public.guest_pay_attempts, timestamptz) to service_role;
grant execute on function public.pay_guest_begin(uuid, uuid, text, boolean, text, integer, integer, integer, integer, integer, integer, uuid, text, integer, timestamptz) to service_role;
grant execute on function public.pay_guest_close(uuid, timestamptz) to service_role;
grant execute on function public.pay_guest_release(uuid, uuid) to service_role;
grant execute on function public.pay_guest_receive(uuid, uuid, integer, timestamptz) to service_role;
grant execute on function public.consumer_set_pay_method(uuid, text) to service_role;
