-- MESITA-3707 — Guest pays, waiter verifies (backend).
--
-- The guest pays alone: picks the place, types the amount and the tip,
-- chooses credit, card or cash, taps Pay. Every payment ends the same way:
-- the waiter scans the guest's QR and taps Verify. For cash, Verify confirms
-- the cash changed hands (the 2% cashback is written then); for card and
-- credit it proves the screen is live and from Mesita.
--
-- A guest payment is a pay_tabs row with origin = 'guest', born billed with
-- the bill the guest typed and moved to paying in the same transaction by
-- the existing pay_tab_open_parts (same gates: credits never pay the tip, a
-- card tip alone is refused, the parts sum to the bill). Nothing waits on the
-- waiter; a guest tab lives at most three hours (the Verify window).
--
--   pay_tabs.origin, verified_at, verified_key_hash
--   pay_tab_guest_pay(...)        the guest's tap (raises on any refusal, so
--                                 no tab survives a refused tap)
--   pay_tab_guest_remint(...)     a new QR for the guest's own guest tab
--   pay_tab_verify(...)           the waiter's Verify
--   pay_tabs_close_guest(...)     the settle cron closes guest tabs past
--                                 their window
--   pay_tab_open, pay_tab_change, pay_tabs_follow_parts,
--   wallet_confirm_outside        taught about guest tabs
--
-- Additive: three columns (origin defaults to 'waiter'), indexes, four new
-- functions, four redefinitions. Waiter tabs behave exactly as before.

-- ── 1. The columns ──────────────────────────────────────────────────────────
alter table public.pay_tabs
  add column origin text not null default 'waiter' check (origin in ('waiter', 'guest')),
  add column verified_at timestamptz,
  add column verified_key_hash text check (verified_key_hash is null or verified_key_hash ~ '^[0-9a-f]{64}$'),
  add constraint pay_tabs_verified_chk check (verified_at is null or (origin = 'guest' and verified_key_hash is not null));

comment on column public.pay_tabs.origin is
  'MESITA-3707: waiter = the waiter billed the guest''s QR (Pay at the table); guest = the guest typed the bill and paid alone, and the waiter verifies.';
comment on column public.pay_tabs.verified_at is
  'MESITA-3707: when a staff phone signed in by the Staff QR verified this guest tab (cash collected, or the paid screen checked).';
comment on column public.pay_tabs.verified_key_hash is
  'MESITA-3707: the hash of the verifying staff token''s device id (jti); two phones are two hashes.';

-- One open tab per guest per place applies to the waiter's tabs only: a
-- guest may hold several guest tabs at one place (a second round, a top-up).
drop index public.pay_tabs_one_open;
create unique index pay_tabs_one_open on public.pay_tabs (consumer_id, place_id, livemode)
  where status in ('waiting_bill', 'billed', 'paying') and parent_tab_id is null and origin = 'waiter';

-- One guest tab per tap: a double tap with the same request id is one tab.
create unique index pay_tabs_guest_request on public.pay_tabs (consumer_id, place_id, pay_request_id)
  where origin = 'guest';

-- The cron's close step reads guest tabs still paying, by their window.
create index pay_tabs_guest_close on public.pay_tabs (expires_at)
  where origin = 'guest' and status = 'paying';

-- ── 2. The waiter's open never touches a guest tab ─────────────────────────
create or replace function public.pay_tab_open(
  p_consumer_id uuid, p_place_id uuid, p_token_hash text, p_currency text, p_livemode boolean,
  p_ttl interval default interval '30 minutes', p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.pay_tabs;
begin
  if p_consumer_id is null or p_place_id is null or p_token_hash is null then
    raise exception 'pay_tab_open: consumer, place and token are required';
  end if;
  perform public.wallet_lock(p_consumer_id, p_place_id);

  -- A stale tab whose bill was paid (credits) and only a cash tip went
  -- unconfirmed reads paid; any other stale tab expires. A row still in
  -- flight keeps its tab open. A split table is left to its shares. Guest
  -- tabs are the cron's (pay_tabs_close_guest).
  update public.pay_tabs t
     set status = case when exists (select 1 from public.wallet_payments w where w.tab_id = t.id and w.paid_at is not null)
                       then 'paid' else 'expired' end,
         paid_at = case when exists (select 1 from public.wallet_payments w where w.tab_id = t.id and w.paid_at is not null)
                        then p_now end,
         updated_at = now()
   where t.consumer_id = p_consumer_id and t.place_id = p_place_id and t.livemode = p_livemode
     and t.status in ('waiting_bill', 'billed', 'paying') and t.expires_at <= p_now
     and t.split_at is null and t.origin = 'waiter'
     and not exists (select 1 from public.wallet_payments w
                      where w.tab_id = t.id and w.status in ('opening', 'open')
                        and (w.expires_at is null or w.expires_at > p_now));
  -- A stale split table with no share still in flight expires (its paid
  -- shares stay paid; the rest is paid to the waiter directly).
  update public.pay_tabs t
     set status = 'expired', updated_at = now()
   where t.consumer_id = p_consumer_id and t.place_id = p_place_id and t.livemode = p_livemode
     and t.status = 'billed' and t.split_at is not null and t.expires_at <= p_now and t.origin = 'waiter'
     and not exists (select 1 from public.pay_tabs s where s.parent_tab_id = t.id and s.status = 'paying');

  select * into v from public.pay_tabs
   where consumer_id = p_consumer_id and place_id = p_place_id and livemode = p_livemode
     and status in ('waiting_bill', 'billed', 'paying') and parent_tab_id is null and origin = 'waiter'
   for update;
  if found then
    if v.status = 'waiting_bill' then
      update public.pay_tabs set token_hash = p_token_hash, expires_at = p_now + p_ttl, updated_at = now()
       where id = v.id;
      return jsonb_build_object('ok', true, 'outcome', 'reused', 'tab_id', v.id, 'status', v.status,
        'token_rotated', true, 'expires_at', p_now + p_ttl);
    end if;
    return jsonb_build_object('ok', true, 'outcome', 'reused', 'tab_id', v.id, 'status', v.status,
      'token_rotated', false, 'expires_at', v.expires_at);
  end if;

  insert into public.pay_tabs (place_id, consumer_id, token_hash, currency, livemode, expires_at)
  values (p_place_id, p_consumer_id, p_token_hash, lower(p_currency), p_livemode, p_now + p_ttl)
  returning * into v;
  return jsonb_build_object('ok', true, 'outcome', 'opened', 'tab_id', v.id, 'status', v.status,
    'token_rotated', true, 'expires_at', v.expires_at);
end;
$function$;

-- ── 3. Cancel: a guest tab is cancelled whole, or not at all ───────────────
create or replace function public.pay_tab_change(p_tab_id uuid, p_consumer_id uuid, p_mode text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.pay_tabs;
begin
  select * into v from public.pay_tabs where id = p_tab_id;
  if not found or v.consumer_id is distinct from p_consumer_id then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  perform public.wallet_lock(p_consumer_id, v.place_id);
  select * into v from public.pay_tabs where id = p_tab_id for update;

  if v.origin = 'guest' then
    -- A guest tab is paid as the guest tapped it; it is never billed again.
    -- Cancel while nothing moved: no paid part, no Verify, no card in flight.
    if p_mode <> 'cancel' then
      return jsonb_build_object('ok', false, 'code', 'guest_tab');
    end if;
    if v.status = 'cancelled' then
      return jsonb_build_object('ok', true, 'outcome', 'cancelled', 'tab_id', v.id);
    end if;
    if v.verified_at is not null then
      return jsonb_build_object('ok', false, 'code', 'verified', 'verified_at', v.verified_at);
    end if;
    if v.status <> 'paying' then
      return jsonb_build_object('ok', false, 'code', v.status);
    end if;
    if exists (select 1 from public.wallet_payments where tab_id = v.id and paid_at is not null) then
      return jsonb_build_object('ok', false, 'code', 'paid_part');
    end if;
    if exists (select 1 from public.wallet_payments where tab_id = v.id and part = 'card' and status in ('opening', 'open')) then
      return jsonb_build_object('ok', false, 'code', 'card_pending');
    end if;
    update public.wallet_payments set status = 'expired', stripe_error = 'cancelled', updated_at = now()
     where tab_id = v.id and status in ('opening', 'open');
    update public.pay_tabs set status = 'cancelled', updated_at = now() where id = v.id;
    return jsonb_build_object('ok', true, 'outcome', 'cancelled', 'tab_id', v.id);
  end if;

  if p_mode = 'cancel' then
    if v.status in ('waiting_bill', 'billed') then
      update public.pay_tabs set status = 'cancelled', updated_at = now() where id = v.id;
      return jsonb_build_object('ok', true, 'outcome', 'cancelled', 'tab_id', v.id);
    end if;
    if v.status = 'cancelled' then
      return jsonb_build_object('ok', true, 'outcome', 'cancelled', 'tab_id', v.id);
    end if;
    return jsonb_build_object('ok', false, 'code', v.status);
  elsif p_mode = 'change' then
    if v.status <> 'paying' then
      return jsonb_build_object('ok', false, 'code', v.status);
    end if;
    if exists (select 1 from public.wallet_payments where tab_id = v.id and paid_at is not null) then
      return jsonb_build_object('ok', false, 'code', 'paid_part');
    end if;
    update public.wallet_payments set status = 'expired', stripe_error = 'cancelled', updated_at = now()
     where tab_id = v.id and status in ('opening', 'open');
    update public.pay_tabs
       set status = 'billed', pay_request_id = null, paying_at = null,
           credit_cents = 0, cash_bill_cents = 0, cash_tip_cents = 0, card_bill_cents = 0, card_tip_cents = 0,
           updated_at = now()
     where id = v.id;
    return jsonb_build_object('ok', true, 'outcome', 'billed', 'tab_id', v.id, 'bill_version', v.bill_version);
  end if;
  raise exception 'pay_tab_change: mode must be cancel or change';
end;
$function$;

-- ── 4. The tab follows its parts; a guest tab whose card fails is cancelled ─
create or replace function public.pay_tabs_follow_parts()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_origin text;
begin
  if new.tab_id is null then
    return null;
  end if;
  if old.paid_at is null and new.paid_at is not null then
    -- The last part in flight went through: the tab is paid, unless cash is
    -- still owed (the waiter's Received or Verify pays it then).
    update public.pay_tabs t
       set status = 'paid', paid_at = new.paid_at, updated_at = now()
     where t.id = new.tab_id and t.status = 'paying'
       and not exists (select 1 from public.wallet_payments w
                        where w.tab_id = t.id and w.status in ('opening', 'open'))
       and (t.cash_bill_cents + t.cash_tip_cents = 0 or t.cash_received_cents is not null);
  elsif new.part = 'card' and old.status in ('opening', 'open') and new.status in ('failed', 'expired') then
    if not exists (select 1 from public.wallet_payments w where w.tab_id = new.tab_id and w.paid_at is not null) then
      select origin into v_origin from public.pay_tabs where id = new.tab_id;
      -- Every other open part of the tab goes (its credit hold released).
      update public.wallet_payments
         set status = 'expired', stripe_error = coalesce(stripe_error, 'card_failed'), updated_at = now()
       where tab_id = new.tab_id and id <> new.id and status in ('opening', 'open');
      if v_origin = 'guest' then
        -- A guest tab is never billed again: it is cancelled, and the guest
        -- pays again from the form (the app keeps the amounts).
        update public.pay_tabs set status = 'cancelled', updated_at = now()
         where id = new.tab_id and status = 'paying';
      else
        -- The waiter's tab is billed again so the guest can choose again.
        update public.pay_tabs
           set status = 'billed', pay_request_id = null, paying_at = null,
               credit_cents = 0, cash_bill_cents = 0, cash_tip_cents = 0, card_bill_cents = 0, card_tip_cents = 0,
               updated_at = now()
         where id = new.tab_id and status = 'paying';
      end if;
    end if;
  end if;
  return null;
end;
$function$;

revoke all on function public.pay_tabs_follow_parts() from public, anon, authenticated;

-- ── 5. Cash cashback: a guest's own daily cap on top of the place's ────────
create or replace function public.wallet_confirm_outside(p_payment_id uuid, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_payments;
  v_cashback integer;
  v_today integer;
  v_mine integer;
  c_ceiling constant integer := 50000;
  -- MESITA-3707: a guest tab's cash earns at most $100MX of cashback per
  -- guest per place per day, so one guest cannot take the place's whole day.
  c_guest_cap constant integer := 10000;
begin
  select * into v from public.wallet_payments where id = p_payment_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.outside_cents = 0 then
    return jsonb_build_object('ok', false, 'code', 'not_outside');
  end if;
  if v.paid_at is not null then
    return jsonb_build_object('ok', true, 'outcome', 'already_paid', 'payment_id', v.id, 'status', v.status,
      'credit_cents', v.credit_cents, 'outside_cents', v.outside_cents, 'tip_cents', v.tip_cents,
      'cashback_cents', v.cashback_cents, 'currency', v.currency, 'paid_at', v.paid_at, 'proof_token', v.proof_token);
  end if;
  if v.status not in ('opening', 'open') then
    if v.status = 'expired' and v.stripe_error = 'cancelled' then
      return jsonb_build_object('ok', false, 'code', 'closed', 'bill_cents', coalesce(v.charge_amount_cents, v.amount_cents));
    end if;
    return jsonb_build_object('ok', false, 'code', 'expired', 'bill_cents', coalesce(v.charge_amount_cents, v.amount_cents));
  end if;
  if v.expires_at is not null and v.expires_at <= p_now then
    update public.wallet_payments set status = 'expired', updated_at = now() where id = v.id;
    return jsonb_build_object('ok', false, 'code', 'expired', 'bill_cents', coalesce(v.charge_amount_cents, v.amount_cents));
  end if;

  perform public.wallet_lock(v.consumer_id, v.place_id);
  v_cashback := (v.outside_cents * v.outside_cashback_bps) / 10000;
  if v_cashback > 0 then
    select coalesce(sum(cashback_cents), 0) into v_today from public.wallet_payments
     where place_id = v.place_id and livemode = v.livemode and outside_cents > 0
       and paid_at is not null and paid_at > p_now - interval '1 day';
    v_cashback := least(v_cashback, greatest(c_ceiling - v_today, 0));
  end if;
  if v_cashback > 0 and v.tab_id is not null
     and exists (select 1 from public.pay_tabs t where t.id = v.tab_id and t.origin = 'guest') then
    select coalesce(sum(cashback_cents), 0) into v_mine from public.wallet_payments
     where consumer_id = v.consumer_id and place_id = v.place_id and livemode = v.livemode and outside_cents > 0
       and paid_at is not null and paid_at > p_now - interval '1 day';
    v_cashback := least(v_cashback, greatest(c_guest_cap - v_mine, 0));
  end if;

  update public.wallet_payments
     set status = 'paid', paid_at = p_now, confirmed_by = 'waiter', cashback_cents = v_cashback, updated_at = now()
   where id = v.id;

  if v.credit_cents > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'spend', -v.credit_cents, v.currency, v.id, v.livemode, p_now);
  end if;
  if v_cashback > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'cashback', v_cashback, v.currency, v.id, v.livemode, p_now + interval '1 hour');
  end if;

  return jsonb_build_object('ok', true, 'outcome', 'paid', 'payment_id', v.id, 'status', 'paid',
    'credit_cents', v.credit_cents, 'outside_cents', v.outside_cents, 'tip_cents', v.tip_cents,
    'cashback_cents', v_cashback, 'currency', v.currency, 'paid_at', p_now, 'proof_token', v.proof_token);
end;
$function$;

-- ── 6. The guest's tap ──────────────────────────────────────────────────────
-- Under the pair lock: a replayed request answers its tab (with the new QR);
-- more than three guest tabs still paying here is refused; the guest's own
-- stale waiter tab still waiting for a bill is cancelled; the guest tab is
-- inserted billed with the typed bill and paid through pay_tab_open_parts.
-- ANY refusal raises 'guest_refused:<json>' so the whole call rolls back and
-- no tab or row survives (the EF reads the json).
create or replace function public.pay_tab_guest_pay(
  p_consumer_id uuid, p_place_id uuid, p_currency text, p_livemode boolean, p_token_hash text,
  p_bill_cents integer,
  p_credit_cents integer, p_cash_bill_cents integer, p_cash_tip_cents integer,
  p_card_bill_cents integer, p_card_tip_cents integer,
  p_request_id uuid, p_proof_token text, p_outside_cashback_bps integer,
  p_now timestamptz default now(),
  p_stripe_account_id text default null, p_card_fee_cents integer default 0,
  p_card_cashback_bps integer default 0, p_card_proof_token text default null,
  p_card_expires_at timestamptz default null,
  p_window interval default interval '3 hours', p_max_open integer default 3)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.pay_tabs;
  v_res jsonb;
  v_open integer;
  v_expires timestamptz := p_now + p_window;
  v_card uuid;
begin
  if p_consumer_id is null or p_place_id is null or p_token_hash is null or p_request_id is null then
    raise exception 'pay_tab_guest_pay: consumer, place, token and request_id are required';
  end if;
  if p_bill_cents is null or p_bill_cents <= 0 or p_bill_cents > 10000000 then
    raise exception 'guest_refused:%', jsonb_build_object('code', 'amount_required');
  end if;
  perform public.wallet_lock(p_consumer_id, p_place_id);

  -- The same tap again (a lost answer): its tab, with this call's QR.
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

  select count(*) into v_open from public.pay_tabs
   where consumer_id = p_consumer_id and place_id = p_place_id and livemode = p_livemode
     and origin = 'guest' and status = 'paying' and expires_at > p_now;
  if v_open >= p_max_open then
    raise exception 'guest_refused:%', jsonb_build_object('code', 'too_many_open', 'max_open', p_max_open);
  end if;

  -- The guest's own waiter tab still waiting for a bill here is stale now.
  update public.pay_tabs set status = 'cancelled', updated_at = now()
   where consumer_id = p_consumer_id and place_id = p_place_id and livemode = p_livemode
     and origin = 'waiter' and status = 'waiting_bill' and parent_tab_id is null;

  insert into public.pay_tabs (place_id, consumer_id, token_hash, status, currency, livemode, bill_cents,
                               tip_cents, bill_version, billed_at, pay_request_id, expires_at, origin)
  values (p_place_id, p_consumer_id, p_token_hash, 'billed', lower(p_currency), p_livemode, p_bill_cents,
          coalesce(p_cash_tip_cents, 0) + coalesce(p_card_tip_cents, 0), 1, p_now, p_request_id, v_expires, 'guest')
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

comment on function public.pay_tab_guest_pay(uuid, uuid, text, boolean, text, integer, integer, integer, integer, integer, integer, uuid, text, integer, timestamptz, text, integer, integer, text, timestamptz, interval, integer) is
  'MESITA-3707: the guest''s tap. One guest tab per request id; at most three paying here; any refusal raises guest_refused:<json> so nothing survives. Service role only.';

-- ── 7. A new QR for the guest's own guest tab ──────────────────────────────
create or replace function public.pay_tab_guest_remint(
  p_tab_id uuid, p_consumer_id uuid, p_token_hash text, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.pay_tabs;
begin
  select * into v from public.pay_tabs where id = p_tab_id;
  if not found or v.consumer_id is distinct from p_consumer_id or v.origin <> 'guest' then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);
  select * into v from public.pay_tabs where id = p_tab_id for update;
  if v.verified_at is not null then
    return jsonb_build_object('ok', false, 'code', 'verified');
  end if;
  if v.status not in ('paying', 'paid') or v.expires_at <= p_now then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;
  update public.pay_tabs set token_hash = p_token_hash, updated_at = now() where id = v.id;
  return jsonb_build_object('ok', true, 'outcome', 'reminted', 'tab_id', v.id);
end;
$function$;

-- ── 8. The waiter's Verify ──────────────────────────────────────────────────
-- p_place_id is the place of the checked staff token (the EF checks it was
-- minted by the Staff QR); p_staff_key_hash the hash of its device id.
-- Under the pair lock and the tab's row lock: a second Verify moves no money;
-- a card still going through waits; cash is confirmed with the waiter's
-- shortfall rules (pay_tab_cash's) and the 2% cashback written; a tab paid
-- in the app is only stamped.
create or replace function public.pay_tab_verify(
  p_tab_id uuid, p_place_id uuid, p_staff_key_hash text, p_received_cents integer default null,
  p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.pay_tabs;
  w public.wallet_payments;
  v_received integer;
  v_tip integer;
  v_res jsonb;
  v_cashback integer := 0;
begin
  if p_staff_key_hash is null or p_staff_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'pay_tab_verify: a staff key hash is required';
  end if;
  select * into v from public.pay_tabs where id = p_tab_id;
  if not found or v.origin <> 'guest' then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.place_id is distinct from p_place_id then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);
  select * into v from public.pay_tabs where id = p_tab_id for update;

  if v.verified_at is not null then
    return jsonb_build_object('ok', true, 'outcome', 'already_verified', 'tab_id', v.id,
      'verified_at', v.verified_at, 'same_phone', v.verified_key_hash = p_staff_key_hash);
  end if;
  if v.status in ('cancelled', 'expired') then
    return jsonb_build_object('ok', false, 'code', v.status);
  end if;
  if v.expires_at <= p_now then
    return jsonb_build_object('ok', false, 'code', 'expired', 'expires_at', v.expires_at);
  end if;
  if exists (select 1 from public.wallet_payments where tab_id = v.id and part = 'card' and status in ('opening', 'open')) then
    return jsonb_build_object('ok', false, 'code', 'card_pending');
  end if;

  if v.status = 'paying' and v.cash_bill_cents + v.cash_tip_cents > 0 then
    v_received := coalesce(p_received_cents, v.cash_bill_cents + v.cash_tip_cents);
    if v_received < 0 or v_received > 10000000 then
      return jsonb_build_object('ok', false, 'code', 'amount_required');
    end if;
    if v_received < v.cash_bill_cents then
      return jsonb_build_object('ok', false, 'code', 'short', 'missing_cents', v.cash_bill_cents - v_received,
        'cash_bill_cents', v.cash_bill_cents);
    end if;
    v_tip := least(v.cash_tip_cents, v_received - v.cash_bill_cents);
    if v.cash_bill_cents > 0 then
      select * into w from public.wallet_payments
       where tab_id = v.id and part = 'outside' and status in ('opening', 'open', 'paid')
       order by created_at desc limit 1
       for update;
      if not found then
        return jsonb_build_object('ok', false, 'code', 'expired');
      end if;
      if w.paid_at is null then
        update public.wallet_payments set tip_cents = v_tip, updated_at = now() where id = w.id;
      end if;
      v_res := public.wallet_confirm_outside(w.id, p_now);
      if not coalesce((v_res ->> 'ok')::boolean, false) then
        return v_res;
      end if;
      v_cashback := coalesce((v_res ->> 'cashback_cents')::int, 0);
    end if;
    update public.pay_tabs
       set status = 'paid', paid_at = coalesce(paid_at, p_now), cash_received_cents = v_received, cash_tip_cents = v_tip,
           verified_at = p_now, verified_key_hash = p_staff_key_hash, updated_at = now()
     where id = v.id;
    return jsonb_build_object('ok', true, 'outcome', 'verified', 'tab_id', v.id, 'verified_at', p_now,
      'cash_received_cents', v_received, 'cash_tip_cents', v_tip, 'cashback_cents', v_cashback);
  end if;

  if v.status = 'paid' then
    update public.pay_tabs set verified_at = p_now, verified_key_hash = p_staff_key_hash, updated_at = now()
     where id = v.id;
    return jsonb_build_object('ok', true, 'outcome', 'verified', 'tab_id', v.id, 'verified_at', p_now,
      'cashback_cents', 0);
  end if;
  return jsonb_build_object('ok', false, 'code', 'not_paid', 'status', v.status);
end;
$function$;

-- ── 9. The cron closes guest tabs past their window ────────────────────────
-- A card still in flight is left to the card rule (released only when Stripe
-- answers canceled; a success settles and the trigger pays the tab). A cash
-- row nobody verified expires with no cashback; the credit the guest
-- declared with it is spent anyway (the guest chose it, the place served).
-- The tab reads paid when any part was paid, else expired. Answers how many
-- tabs it closed.
create or replace function public.pay_tabs_close_guest(p_now timestamptz default now(), p_limit integer default 200)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  v public.pay_tabs;
  w public.wallet_payments;
  v_res jsonb;
  v_pay uuid;
  v_n integer := 0;
begin
  for r in
    select id, consumer_id, place_id from public.pay_tabs
     where origin = 'guest' and status = 'paying' and expires_at <= p_now
     order by expires_at
     limit p_limit
  loop
    perform public.wallet_lock(r.consumer_id, r.place_id);
    select * into v from public.pay_tabs where id = r.id for update;
    continue when v.status <> 'paying' or v.verified_at is not null or v.expires_at > p_now;
    continue when exists (select 1 from public.wallet_payments
                           where tab_id = v.id and part = 'card' and status in ('opening', 'open'));

    select * into w from public.wallet_payments
     where tab_id = v.id and part = 'outside' and paid_at is null
     order by created_at desc limit 1
     for update;
    if found then
      if w.status in ('opening', 'open') then
        update public.wallet_payments set status = 'expired', stripe_error = coalesce(stripe_error, 'not_verified'), updated_at = now()
         where id = w.id;
      end if;
      -- Never for a cash row the guest cancelled.
      if w.credit_cents > 0 and coalesce(w.stripe_error, '') <> 'cancelled' then
        v_res := public.wallet_pay_credit(v.consumer_id, v.place_id, w.credit_cents, v.currency, v.livemode,
          md5(v.id::text || ':close')::uuid, null, v.ticket);
        if coalesce((v_res ->> 'ok')::boolean, false) then
          v_pay := (v_res ->> 'payment_id')::uuid;
          update public.wallet_payments set tab_id = v.id, part = 'credit', charge_amount_cents = v.bill_cents
           where id = v_pay and tab_id is null;
        end if;
      end if;
    end if;

    update public.pay_tabs t
       set status = case when exists (select 1 from public.wallet_payments p where p.tab_id = t.id and p.paid_at is not null)
                         then 'paid' else 'expired' end,
           paid_at = case when exists (select 1 from public.wallet_payments p where p.tab_id = t.id and p.paid_at is not null)
                          then coalesce(t.paid_at, p_now) end,
           updated_at = now()
     where t.id = v.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$function$;

-- ── 10. Access: the service role only ───────────────────────────────────────
revoke all on function public.pay_tab_open(uuid, uuid, text, text, boolean, interval, timestamptz) from public, anon, authenticated;
revoke all on function public.pay_tab_change(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.wallet_confirm_outside(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.pay_tab_guest_pay(uuid, uuid, text, boolean, text, integer, integer, integer, integer, integer, integer, uuid, text, integer, timestamptz, text, integer, integer, text, timestamptz, interval, integer) from public, anon, authenticated;
revoke all on function public.pay_tab_guest_remint(uuid, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.pay_tab_verify(uuid, uuid, text, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.pay_tabs_close_guest(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.pay_tab_open(uuid, uuid, text, text, boolean, interval, timestamptz) to service_role;
grant execute on function public.pay_tab_change(uuid, uuid, text) to service_role;
grant execute on function public.wallet_confirm_outside(uuid, timestamptz) to service_role;
grant execute on function public.pay_tab_guest_pay(uuid, uuid, text, boolean, text, integer, integer, integer, integer, integer, integer, uuid, text, integer, timestamptz, text, integer, integer, text, timestamptz, interval, integer) to service_role;
grant execute on function public.pay_tab_guest_remint(uuid, uuid, text, timestamptz) to service_role;
grant execute on function public.pay_tab_verify(uuid, uuid, text, integer, timestamptz) to service_role;
grant execute on function public.pay_tabs_close_guest(timestamptz, integer) to service_role;

-- ── 11. Post-flight ─────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'pay_tabs' and column_name = 'origin') then
    raise exception 'MESITA-3707 columns missing after apply';
  end if;
end $$;
