-- MESITA-3776 — The guest types the ticket number; a ticket that already has
-- a payment asks first.
--
-- 1. pay_ticket_norm(text): the form two tickets are compared in. Uppercase;
--    spaces, dashes and slashes removed; leading zeros dropped at the start
--    of every run of digits, keeping one "0" for an all-zero run
--    ("A-0123" = "a123" = "A123"; "000" = "0"; "0012" = "12").
-- 2. pay_tab_guest_pay gains p_ticket and p_repeat_ok (both defaulted). The
--    old signature is dropped first, so PostgREST sees one function. On top
--    of MESITA-3772's body, unchanged otherwise:
--    - a retry of a request that already made its tab returns that tab first;
--    - the ticket is trimmed ('' = none) and, when given, must be 1 to 16
--      letters, digits, spaces, dashes or slashes, else ticket_invalid;
--    - before anything is held, charged or written: another GUEST tab at the
--      same place and money mode with the same normalised ticket, paying or
--      paid, (paid or its window still open), created within 12 hours of
--      p_now. The guest's own → ticket_paid_by_you with paid_tab_id (never
--      overridable); another guest's and not p_repeat_ok → ticket_paid (no
--      time, no amount). Waiter-billed tabs are never compared.
--    - the trimmed ticket is stored on the new tab as typed.
--    Every refusal raises guest_refused:<json>, so the whole call rolls back
--    and "Yes, my share" resends the SAME request id.
--
-- No index: one place's guest tabs over 12 hours is small at pilot volume.
-- Two diners paying one ticket at the same instant may both pass (shares
-- are allowed).

-- ── 1. The comparison form ──────────────────────────────────────────────────
create or replace function public.pay_ticket_norm(p text)
 returns text
 language sql
 immutable
 strict
 parallel safe
 set search_path to ''
as $function$
  select pg_catalog.regexp_replace(
           pg_catalog.upper(pg_catalog.regexp_replace(p, '[ /-]', '', 'g')),
           '(^|[^0-9])0+([0-9])', '\1\2', 'g')
$function$;

comment on function public.pay_ticket_norm(text) is
  'MESITA-3776: a ticket number''s comparison form: uppercase, no spaces, dashes or slashes, no leading zeros in a run of digits (one "0" kept for an all-zero run). "A-0123" = "a123".';

-- ── 2. The guest's tap, with the ticket ─────────────────────────────────────
drop function if exists public.pay_tab_guest_pay(uuid, uuid, text, boolean, text, integer, integer, integer, integer, integer, integer, uuid, text, integer, timestamptz, text, integer, integer, text, timestamptz, interval, integer);

create function public.pay_tab_guest_pay(
  p_consumer_id uuid, p_place_id uuid, p_currency text, p_livemode boolean, p_token_hash text,
  p_bill_cents integer,
  p_credit_cents integer, p_cash_bill_cents integer, p_cash_tip_cents integer,
  p_card_bill_cents integer, p_card_tip_cents integer,
  p_request_id uuid, p_proof_token text, p_outside_cashback_bps integer,
  p_now timestamptz default now(),
  p_stripe_account_id text default null, p_card_fee_cents integer default 0,
  p_card_cashback_bps integer default 0, p_card_proof_token text default null,
  p_card_expires_at timestamptz default null,
  p_window interval default interval '3 hours', p_max_open integer default 3,
  p_ticket text default null, p_repeat_ok boolean default false)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.pay_tabs;
  o public.pay_tabs;
  d public.pay_tabs;
  v_res jsonb;
  v_expires timestamptz := p_now + p_window;
  v_card uuid;
  v_ticket text := nullif(btrim(p_ticket), '');
begin
  if p_consumer_id is null or p_place_id is null or p_token_hash is null or p_request_id is null then
    raise exception 'pay_tab_guest_pay: consumer, place, token and request_id are required';
  end if;
  if p_bill_cents is null or p_bill_cents <= 0 or p_bill_cents > 10000000 then
    raise exception 'guest_refused:%', jsonb_build_object('code', 'amount_required');
  end if;
  perform public.wallet_lock(p_consumer_id, p_place_id);
  -- MESITA-3772: the one-open rule spans places, so two taps at two places
  -- serialize on the guest too (only this function takes this lock).
  perform pg_advisory_xact_lock(hashtextextended('pay_tab_guest_open:' || p_consumer_id::text, 0));

  -- The same tap again (a lost answer): its tab, with this call's QR. It
  -- keeps the ticket it was made with and never warns about it.
  select * into v from public.pay_tabs
   where consumer_id = p_consumer_id and place_id = p_place_id and pay_request_id = p_request_id and origin = 'guest'
   for update;
  if found then
    if v.verified_at is null and v.status in ('paying', 'paid') and v.expires_at > p_now then
      update public.pay_tabs set token_hash = p_token_hash, updated_at = now() where id = v.id;
    end if;
    select id into v_card from public.wallet_payments where tab_id = v.id and part = 'card'
     order by created_at desc limit 1;
    return jsonb_build_object('ok', true, 'outcome', 'replayed', 'tab_id', v.id, 'status', v.status,
      'card_payment_id', v_card, 'expires_at', v.expires_at);
  end if;

  -- MESITA-3776: the ticket as typed, 1 to 16 letters, digits, spaces,
  -- dashes or slashes.
  if v_ticket is not null and v_ticket !~ '^[A-Za-z0-9 /-]{1,16}$' then
    raise exception 'guest_refused:%', jsonb_build_object('code', 'ticket_invalid');
  end if;

  -- MESITA-3776: a ticket that already has a payment here. The guest's own
  -- first (never overridable), then another guest's (a share, when the
  -- guest says so). Waiter-billed tabs keep free text and are not compared.
  if v_ticket is not null then
    select * into d from public.pay_tabs
     where place_id = p_place_id and livemode = p_livemode and origin = 'guest'
       and ticket is not null
       and public.pay_ticket_norm(ticket) = public.pay_ticket_norm(v_ticket)
       and status in ('paying', 'paid')
       and (status = 'paid' or expires_at > p_now)
       and created_at > p_now - interval '12 hours'
     order by (consumer_id = p_consumer_id) desc, created_at desc
     limit 1;
    if found then
      if d.consumer_id = p_consumer_id then
        raise exception 'guest_refused:%', jsonb_build_object('code', 'ticket_paid_by_you', 'paid_tab_id', d.id);
      elsif not coalesce(p_repeat_ok, false) then
        raise exception 'guest_refused:%', jsonb_build_object('code', 'ticket_paid');
      end if;
    end if;
  end if;

  -- One open guest payment per guest per money mode, at any place. The
  -- rule is one; p_max_open is kept for old callers and ignored.
  select * into o from public.pay_tabs
   where consumer_id = p_consumer_id and livemode = p_livemode
     and origin = 'guest' and verified_at is null
     and status in ('paying', 'paid') and expires_at > p_now
   order by created_at desc
   limit 1;
  if found then
    raise exception 'guest_refused:%', jsonb_build_object('code', 'too_many_open', 'max_open', 1,
      'open_tab_id', o.id, 'open_place_id', o.place_id);
  end if;

  -- The guest's own waiter tab still waiting for a bill here is stale now.
  update public.pay_tabs set status = 'cancelled', updated_at = now()
   where consumer_id = p_consumer_id and place_id = p_place_id and livemode = p_livemode
     and origin = 'waiter' and status = 'waiting_bill' and parent_tab_id is null;

  insert into public.pay_tabs (place_id, consumer_id, token_hash, status, currency, livemode, bill_cents,
                               tip_cents, bill_version, billed_at, pay_request_id, expires_at, origin, ticket)
  values (p_place_id, p_consumer_id, p_token_hash, 'billed', lower(p_currency), p_livemode, p_bill_cents,
          coalesce(p_cash_tip_cents, 0) + coalesce(p_card_tip_cents, 0), 1, p_now, p_request_id, v_expires, 'guest',
          v_ticket)
  returning * into v;

  -- The waiter's two-a-day outside limit does not count guest tabs (the
  -- daily cashback caps bound them): a large limit here.
  v_res := public.pay_tab_open_parts(v.id, p_consumer_id, 1,
    p_credit_cents, p_cash_bill_cents, p_cash_tip_cents, p_card_bill_cents, p_card_tip_cents,
    p_request_id, p_proof_token, p_outside_cashback_bps, 1000000, p_now,
    p_stripe_account_id, p_card_fee_cents, p_card_cashback_bps, p_card_proof_token, p_card_expires_at);
  if not coalesce((v_res ->> 'ok')::boolean, false) then
    raise exception 'guest_refused:%', v_res;
  end if;

  -- The Verify window is fixed: the tab and its cash row close together.
  update public.pay_tabs set expires_at = v_expires, updated_at = now() where id = v.id;
  update public.wallet_payments set expires_at = v_expires, updated_at = now()
   where tab_id = v.id and part = 'outside' and status in ('opening', 'open');

  select * into v from public.pay_tabs where id = v.id;
  return v_res || jsonb_build_object('tab_id', v.id, 'status', v.status, 'expires_at', v.expires_at, 'origin', 'guest');
end;
$function$;

comment on function public.pay_tab_guest_pay(uuid, uuid, text, boolean, text, integer, integer, integer, integer, integer, integer, uuid, text, integer, timestamptz, text, integer, integer, text, timestamptz, interval, integer, text, boolean) is
  'MESITA-3707, MESITA-3772, MESITA-3776: the guest''s tap. One guest tab per request id (a retry returns it first, ticket unchanged); the ticket is stored trimmed as typed (1-16 letters, digits, spaces, dashes, slashes, else ticket_invalid); another guest tab here with the same pay_ticket_norm ticket, paying or paid (paid or window open), within 12 hours of p_now → ticket_paid_by_you + paid_tab_id when it is the guest''s own, else ticket_paid unless p_repeat_ok; one open (unsigned, paying or paid, in its window) guest payment per guest per money mode at any place, else too_many_open naming open_tab_id; any refusal raises guest_refused:<json> so nothing survives. Service role only.';

-- ── 3. Access: the service role only ────────────────────────────────────────
revoke all on function public.pay_ticket_norm(text) from public, anon, authenticated;
grant execute on function public.pay_ticket_norm(text) to service_role;
revoke all on function public.pay_tab_guest_pay(uuid, uuid, text, boolean, text, integer, integer, integer, integer, integer, integer, uuid, text, integer, timestamptz, text, integer, integer, text, timestamptz, interval, integer, text, boolean) from public, anon, authenticated;
grant execute on function public.pay_tab_guest_pay(uuid, uuid, text, boolean, text, integer, integer, integer, integer, integer, integer, uuid, text, integer, timestamptz, text, integer, integer, text, timestamptz, interval, integer, text, boolean) to service_role;

-- ── 4. Post-flight ──────────────────────────────────────────────────────────
do $$
begin
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'pay_tab_guest_pay') <> 1 then
    raise exception 'MESITA-3776: pay_tab_guest_pay must have exactly one overload';
  end if;
  if public.pay_ticket_norm('A-0123') <> 'A123' or public.pay_ticket_norm('a123') <> 'A123'
     or public.pay_ticket_norm('000') <> '0' or public.pay_ticket_norm('0012') <> '12' then
    raise exception 'MESITA-3776: pay_ticket_norm is wrong';
  end if;
end $$;
