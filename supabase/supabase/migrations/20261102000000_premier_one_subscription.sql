-- MESITA-3092 — Premier (b): one Paid subscription per place (Pato,
-- 2026-10-29: "solo una suscripción activa"; "si no pasa la tarjeta,
-- inmediatamente cancelarle la suscripción"). Additive half; the cut-over
-- (one-ready index, `failed` retired) is 20261102000100.
--
--   - A pledge becomes the place's one `ready` subscription only through
--     premier_make_payer, under the place lock.
--   - A declined renewal ends its pledge (`declined`); a declined first
--     purchase ends it (`checkout_failed`); a payer's own declined upgrade
--     gives the cut period its end back and keeps the pledge.
--   - Manual Premier at or above the paid level pauses the paid period: its
--     end moves out by the covered time (premier_cover_paid).
--   - A pledge covered by Manual for longer than one interval with nothing
--     paid ends (`covered`), so no saved card is charged by surprise.
--
-- 0 pledges and 0 periods live on 2026-11-01 (Stripe TEST).

-- ── Pledge columns ───────────────────────────────────────────────────────
alter table public.place_backings
  add column ended_reason text
    check (ended_reason in ('declined', 'stopped', 'stopped_by_place', 'taken_over', 'left', 'checkout_failed', 'lost', 'covered')),
  add column checkout_kind text
    check (checkout_kind in ('buy', 'change', 'resume', 'update_card')),
  add column notice_dismissed_at timestamptz;

comment on column public.place_backings.ended_reason is
  'MESITA-3092: why an ended pledge ended. declined = its renewal was declined; stopped = the payer stopped renewing; stopped_by_place = a verified manager stopped it; taken_over = another pledge became the place''s subscription; left = account deletion or admin removal; checkout_failed = its first charge was declined; lost = another Checkout won the place first; covered = Manual Premier covered it longer than one interval.';
comment on column public.place_backings.checkout_kind is
  'MESITA-3092: the Checkout in flight on this pledge (buy, change, resume, update_card); null once it is settled. The cron confirms only pledges with one.';
comment on column public.place_backings.notice_dismissed_at is
  'MESITA-3092: when the guest dismissed this ended pledge''s notice on the Premier tab.';

-- ── Pause under Manual Premier ───────────────────────────────────────────
alter table public.place_premier_periods
  add column remaining_at_cover_sec integer check (remaining_at_cover_sec >= 0),
  add column covered_until timestamptz;

comment on column public.place_premier_periods.remaining_at_cover_sec is
  'MESITA-3092: paid seconds left when Manual Premier at or above this period''s level began covering it. The paid end moves to covered_until + this.';
comment on column public.place_premier_periods.covered_until is
  'MESITA-3092: when the Manual cover of this period ends (or ended early).';

-- Manual Premier at or above the running paid period's level pauses it: the
-- paid seconds left when the cover began run after the cover ends. Every
-- Manual write (insert, extension, early end) recomputes it; an early end
-- keeps the days already moved (a gift, never taken back).
create or replace function public.premier_cover_paid(p_place_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_p public.place_premier_periods;
  v_cover_end timestamptz;
  v_left integer;
begin
  select * into v_p
    from public.place_premier_periods
   where place_id = p_place_id and status = 'paid'
     and starts_at <= now() and ends_at > now()
   order by starts_at desc
   limit 1
   for update;
  if v_p.id is null then
    return;
  end if;

  select max(ends_at) into v_cover_end
    from public.place_manual_premier
   where place_id = p_place_id and tier >= v_p.tier
     and starts_at <= now() and ends_at > now();

  if v_cover_end is null then
    -- The cover ended early: it stopped now.
    if v_p.covered_until is not null and v_p.covered_until > now() then
      update public.place_premier_periods
         set covered_until = now(), updated_at = now()
       where id = v_p.id;
    end if;
    return;
  end if;

  if v_p.remaining_at_cover_sec is null then
    v_left := greatest(0, ceil(extract(epoch from v_p.ends_at - now())))::integer;
  elsif v_p.covered_until <= now() then
    -- A new cover after an earlier one: what was left then, minus the time
    -- paid since it ended.
    v_left := greatest(0, v_p.remaining_at_cover_sec - ceil(extract(epoch from now() - v_p.covered_until)))::integer;
  else
    v_left := v_p.remaining_at_cover_sec;
  end if;

  update public.place_premier_periods
     set remaining_at_cover_sec = v_left,
         covered_until = v_cover_end,
         ends_at = greatest(ends_at, v_cover_end + make_interval(secs => v_left)),
         updated_at = now()
   where id = v_p.id;
end;
$function$;

create or replace function public.place_manual_premier_recompute()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  perform public.premier_cover_paid(coalesce(new.place_id, old.place_id));
  perform public.recompute_place_boost(coalesce(new.place_id, old.place_id));
  return null;
end;
$function$;

-- ── The one path to `ready` ──────────────────────────────────────────────
-- Under the place lock: refused while another pledge's charge is in flight;
-- every other ready pledge of the place ends (`taken_over`) and their saved
-- cards come back for the caller to detach; this pledge becomes the place's
-- subscription with its saved card.
create or replace function public.premier_make_payer(p_backing_id uuid, p_payment_method text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.place_backings;
  v_detach text[];
begin
  select * into v from public.place_backings where id = p_backing_id;
  if v.id is null then
    return jsonb_build_object('result', 'missing');
  end if;

  perform pg_advisory_xact_lock(hashtext(v.place_id::text));
  select * into v from public.place_backings where id = p_backing_id for update;
  if v.status = 'ended' then
    return jsonb_build_object('result', 'ended');
  end if;

  if exists (select 1 from public.place_premier_periods
              where place_id = v.place_id and status = 'charging'
                and backing_id is distinct from p_backing_id) then
    return jsonb_build_object('result', 'charging');
  end if;

  with gone as (
    update public.place_backings
       set status = 'ended', ended_reason = 'taken_over', ended_at = now(),
           checkout_kind = null, updated_at = now()
     where place_id = v.place_id and status = 'ready' and id <> p_backing_id
    returning stripe_payment_method_id
  )
  select coalesce(array_agg(stripe_payment_method_id) filter (where stripe_payment_method_id is not null), '{}')
    into v_detach
    from gone;

  update public.place_backings
     set status = 'ready',
         stripe_payment_method_id = coalesce(p_payment_method, stripe_payment_method_id),
         queued_at = case when status = 'ready' then queued_at else now() end,
         updated_at = now()
   where id = p_backing_id;

  return jsonb_build_object('result', 'ready', 'detach', to_jsonb(v_detach));
end;
$function$;

-- ── Claim: a stranger's Checkout never overtakes the place's subscription ──
create or replace function public.premier_claim(
  p_backing_id uuid,
  p_quoted_period_id uuid,
  p_tier text,
  p_interval text,
  p_price_cents integer,
  p_credit_cents integer,
  p_extra_days integer,
  p_charged_cents integer,
  p_payment_intent_id text,
  p_checkout_session_id text,
  p_status text,
  p_livemode boolean
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_place uuid;
  v_running public.place_premier_periods;
  v_existing uuid;
  v_id uuid;
begin
  if p_status not in ('charging', 'paid') then
    raise exception 'premier_claim: status must be charging or paid';
  end if;

  select place_id into v_place from public.place_backings where id = p_backing_id;
  if v_place is null then
    return jsonb_build_object('result', 'missing');
  end if;

  perform pg_advisory_xact_lock(hashtext(v_place::text));

  select id into v_existing
    from public.place_premier_periods
   where (p_payment_intent_id is not null and stripe_payment_intent_id = p_payment_intent_id)
      or (p_checkout_session_id is not null and stripe_checkout_session_id = p_checkout_session_id)
   limit 1;
  if v_existing is not null then
    return jsonb_build_object('result', 'settled', 'period_id', v_existing);
  end if;

  if public.premier_tier_rank(p_tier) <= public.premier_manual_tier(v_place) then
    return jsonb_build_object('result', 'stale', 'reason', 'covered');
  end if;

  if exists (select 1 from public.place_premier_periods
              where place_id = v_place and status = 'charging') then
    return jsonb_build_object('result', 'stale', 'reason', 'charging');
  end if;

  -- One subscription per place: another pledge already holds it.
  if exists (select 1 from public.place_backings
              where place_id = v_place and status = 'ready' and id <> p_backing_id) then
    return jsonb_build_object('result', 'stale', 'reason', 'taken');
  end if;

  select * into v_running
    from public.place_premier_periods
   where place_id = v_place and status = 'paid'
     and starts_at <= now() and ends_at > now()
   order by starts_at desc
   limit 1
   for update;

  if (p_quoted_period_id is null and v_running.id is not null)
     or (p_quoted_period_id is not null and v_running.id is distinct from p_quoted_period_id)
     or (v_running.id is not null and public.premier_tier_rank(p_tier) <= v_running.tier) then
    return jsonb_build_object('result', 'stale', 'reason', 'quote');
  end if;

  if v_running.id is not null then
    update public.place_premier_periods
       set status = 'replaced', cut_from = ends_at, ends_at = now(), updated_at = now()
     where id = v_running.id;
  end if;

  insert into public.place_premier_periods (
    place_id, backing_id, tier, billing_interval, starts_at, ends_at,
    price_cents, credit_cents, extra_days, charged_cents,
    stripe_payment_intent_id, stripe_checkout_session_id, status, livemode
  ) values (
    v_place, p_backing_id, public.premier_tier_rank(p_tier), p_interval, now(),
    public.premier_interval_end(now(), p_interval, p_extra_days),
    p_price_cents, p_credit_cents, p_extra_days, p_charged_cents,
    p_payment_intent_id, p_checkout_session_id, p_status, coalesce(p_livemode, false)
  ) returning id into v_id;

  return jsonb_build_object('result', 'started', 'period_id', v_id);
end;
$function$;

-- ── Renewal: the place's one subscription; a long cover ends it ──────────
create or replace function public.premier_begin_renewal(p_place_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_charging public.place_premier_periods;
  v_pledge public.place_backings;
  v_last timestamptz;
  v_start timestamptz;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_place_id::text));

  select * into v_charging
    from public.place_premier_periods
   where place_id = p_place_id and status = 'charging'
   order by created_at
   limit 1;
  if v_charging.id is not null then
    return jsonb_build_object('action', 'resolve', 'period_id', v_charging.id);
  end if;

  if exists (select 1 from public.place_premier_periods
              where place_id = p_place_id and status = 'paid' and ends_at > now()) then
    return jsonb_build_object('action', 'none');
  end if;

  select * into v_pledge
    from public.place_backings
   where place_id = p_place_id and status = 'ready' and stripe_payment_method_id is not null
   order by queued_at asc
   limit 1;
  if v_pledge.id is null then
    return jsonb_build_object('action', 'none');
  end if;

  select max(ends_at) into v_last
    from public.place_premier_periods
   where place_id = p_place_id and status in ('paid', 'ended');

  if public.premier_tier_rank(v_pledge.tier) <= public.premier_manual_tier(p_place_id) then
    -- Covered for longer than one interval since anything was paid (or since
    -- the pledge stood): it ends, so a dormant card is never charged later.
    if greatest(coalesce(v_last, v_pledge.queued_at), v_pledge.queued_at)
       + case v_pledge.billing_interval when 'year' then interval '1 year' else interval '1 month' end < now() then
      update public.place_backings
         set status = 'ended', ended_reason = 'covered', ended_at = now(),
             checkout_kind = null, updated_at = now()
       where id = v_pledge.id;
      return jsonb_build_object('action', 'none', 'reason', 'dormant',
                                'backing_id', v_pledge.id,
                                'payment_method', v_pledge.stripe_payment_method_id);
    end if;
    return jsonb_build_object('action', 'none', 'reason', 'covered');
  end if;

  v_start := case when v_last is not null and v_last > now() - interval '1 hour' then v_last else now() end;

  insert into public.place_premier_periods (
    place_id, backing_id, tier, billing_interval, starts_at, ends_at,
    price_cents, charged_cents, status
  ) values (
    p_place_id, v_pledge.id, public.premier_tier_rank(v_pledge.tier), v_pledge.billing_interval,
    v_start, public.premier_interval_end(v_start, v_pledge.billing_interval, 0),
    v_pledge.amount_cents, v_pledge.amount_cents, 'charging'
  ) returning id into v_id;

  return jsonb_build_object('action', 'charge', 'period_id', v_id, 'backing_id', v_pledge.id);
end;
$function$;

-- ── Settle: a declined renewal ends the subscription ─────────────────────
-- paid → paid. declined → zero length, and a period an upgrade cut short
-- gets its end back. Then the pledge: a first purchase (still `open`) ends
-- `checkout_failed`; a renewal (a ready pledge's charge with no Checkout)
-- ends `declined`; a payer's own Checkout upgrade keeps the pledge ready.
-- Any future off-session upgrade must carry a marker telling it apart from
-- a renewal, or a declined upgrade here ends the subscription. Idempotent:
-- a row no longer charging is left as it is. Returns the ended pledge's card
-- for the caller to detach.
drop function if exists public.premier_settle(uuid, text, text);
create function public.premier_settle(
  p_period_id uuid,
  p_outcome text,
  p_payment_intent_id text
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_row public.place_premier_periods;
  v_pledge public.place_backings;
  v_reason text;
begin
  if p_outcome not in ('paid', 'declined') then
    raise exception 'premier_settle: outcome must be paid or declined';
  end if;

  select * into v_row from public.place_premier_periods where id = p_period_id;
  if v_row.id is null then
    return jsonb_build_object('status', 'missing');
  end if;

  perform pg_advisory_xact_lock(hashtext(v_row.place_id::text));
  select * into v_row from public.place_premier_periods where id = p_period_id for update;
  if v_row.status <> 'charging' then
    return jsonb_build_object('status', v_row.status);
  end if;

  if p_outcome = 'paid' then
    update public.place_premier_periods
       set status = 'paid',
           stripe_payment_intent_id = coalesce(p_payment_intent_id, stripe_payment_intent_id),
           updated_at = now()
     where id = p_period_id;
    return jsonb_build_object('status', 'paid');
  end if;

  update public.place_premier_periods
     set status = 'declined', ends_at = starts_at,
         stripe_payment_intent_id = coalesce(p_payment_intent_id, stripe_payment_intent_id),
         updated_at = now()
   where id = p_period_id;

  update public.place_premier_periods
     set status = 'paid', ends_at = cut_from, cut_from = null, updated_at = now()
   where place_id = v_row.place_id and status = 'replaced'
     and ends_at = v_row.starts_at and cut_from > now();

  if v_row.backing_id is not null then
    select * into v_pledge from public.place_backings where id = v_row.backing_id for update;
    if v_pledge.status = 'open' then
      v_reason := 'checkout_failed';
    elsif v_pledge.status = 'ready' and v_row.stripe_checkout_session_id is null then
      v_reason := 'declined';
    end if;
    if v_reason is not null then
      update public.place_backings
         set status = 'ended', ended_reason = v_reason, ended_at = now(), checkout_kind = null,
             pending_tier = null, pending_interval = null, pending_amount_cents = null,
             quoted_period_id = null, quoted_credit_cents = 0, updated_at = now()
       where id = v_pledge.id;
    end if;
  end if;

  return jsonb_build_object(
    'status', 'declined',
    'ended_reason', v_reason,
    'payment_method', case when v_reason is not null then v_pledge.stripe_payment_method_id end
  );
end;
$function$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.premier_cover_paid(uuid)',
    'public.place_manual_premier_recompute()',
    'public.premier_make_payer(uuid, text)',
    'public.premier_claim(uuid, uuid, text, text, integer, integer, integer, integer, text, text, text, boolean)',
    'public.premier_begin_renewal(uuid)',
    'public.premier_settle(uuid, text, text)'
  ] loop
    execute format('revoke all on function %s from public', f);
    execute format('revoke execute on function %s from anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end
$$;
