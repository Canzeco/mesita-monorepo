-- MESITA-3168 — Premier Refill purchase (item 2; Pato, 2026-11-03, /autoplan
-- gate `rec`): any signed-in guest buys a 30-day Refill pack for a place,
-- no owner check, and the guest's recurring Premier Subscription retires
-- (the Business app keeps the Subscription).
--
--   premier_refill_purchases   one Stripe Checkout per pack bought
--   premier_refill_check       the read both EFs ask before selling a pack
--   premier_refill_settle      a paid Checkout → its days, exactly once
--
-- A purchase: open (Checkout in flight) → expired (nothing charged) | paid →
-- granted (the days run) | refunded (refused at settle, refunded in TEST) |
-- refund_needed (refused in live, or the refund failed: Pato refunds in
-- Stripe). The days go through premier_add_days, source 'purchase',
-- request_id 'purchase:<id>', so a settle run twice adds them once. No
-- webhook: consumer-web-get-premier-refill settles on Checkout's return and
-- supabase-cron-sync-premier sweeps the rest.

-- ── Purchases ────────────────────────────────────────────────────────────
create table public.premier_refill_purchases (
  id uuid primary key default gen_random_uuid(),
  consumer_id uuid references public.consumers (id) on delete set null,
  place_id uuid not null references public.places (id) on delete restrict,
  tier smallint not null check (tier between 1 and 2),
  days integer not null check (days between 1 and 366),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'usd' check (currency = 'usd'),
  status text not null default 'open'
    check (status in ('open', 'expired', 'paid', 'granted', 'refunded', 'refund_needed')),
  livemode boolean not null default false,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  -- Why premier_add_days refused the days at settle (paid_higher, cap_reached…).
  refusal_code text,
  -- When the bought tier's days end, as of the grant.
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  check ((status in ('open', 'expired')) = (paid_at is null)),
  check (status <> 'granted' or ends_at is not null),
  check (status not in ('refunded', 'refund_needed') or refusal_code is not null)
);

create index premier_refill_purchases_sweep_idx on public.premier_refill_purchases (status, created_at);
create index premier_refill_purchases_owner_idx on public.premier_refill_purchases (consumer_id, place_id, created_at desc);

alter table public.premier_refill_purchases enable row level security;
revoke all on table public.premier_refill_purchases from public, anon, authenticated;
grant all on table public.premier_refill_purchases to service_role;

comment on table public.premier_refill_purchases is
  'MESITA-3168 Premier Refill: one Stripe Checkout per Refill pack a guest buys for a place (no owner check). open → expired | paid → granted | refunded | refund_needed. Days are written by premier_refill_settle through premier_add_days (source purchase, request_id purchase:<id>). Mesita collects. EF-only.';
comment on column public.premier_refill_purchases.status is
  'MESITA-3168: open = Checkout in flight; expired = nothing charged; paid = charged, days not written yet (or refused, refund pending); granted = days running; refunded = refused at settle and refunded (TEST); refund_needed = refused in live or the refund failed: refund in the Stripe dashboard.';

-- ── The check before a sale ──────────────────────────────────────────────
-- The same refusals premier_add_days would answer now (except replay), plus
-- what the guest is shown before paying: the place's level and name, and
-- until when the pack's tier would run (5X packs queue after the 5X days
-- already queued; 2X packs after every queued day). `already` = the place
-- runs at or above the tier now. Returns { result: "ok" | "refused", code?,
-- level, name, already, until }.
create or replace function public.premier_refill_check(p_place_id uuid, p_tier smallint, p_days integer)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_state public.place_state;
  v_level smallint;
  v_name text;
  v_paid smallint;
  v_queued interval;
  v_tail timestamptz;
  v_code text;
begin
  if p_tier is null or p_tier not between 1 and 2 then
    return jsonb_build_object('result', 'refused', 'code', 'tier_invalid');
  end if;
  if p_days is null or p_days not between 1 and 366 then
    return jsonb_build_object('result', 'refused', 'code', 'days_invalid');
  end if;

  select p.state, p.boost_tier, pp.name into v_state, v_level, v_name
    from public.places p
    left join public.place_profiles pp on pp.id = p.id
   where p.id = p_place_id;
  if not found then
    return jsonb_build_object('result', 'refused', 'code', 'not_found');
  end if;

  select greatest(
           coalesce((select max(tier) from public.place_premier_periods
                      where place_id = p_place_id and status in ('paid', 'charging') and ends_at > now()), 0),
           coalesce((select max(public.premier_tier_rank(tier)) from public.place_backings
                      where place_id = p_place_id and status = 'ready'), 0))
    into v_paid;

  select coalesce(sum(ends_at - greatest(starts_at, now())), interval '0'),
         max(ends_at) filter (where tier >= p_tier)
    into v_queued, v_tail
    from public.place_manual_premier
   where place_id = p_place_id and ends_at > now() and ends_at > starts_at;

  v_code := case
    when v_state = 'archived' then 'archived'
    when v_state = 'paused' then 'unlisted'
    when v_paid > p_tier then 'paid_higher'
    when v_queued + make_interval(days => p_days) > interval '366 days' then 'cap_reached'
  end;

  return jsonb_build_object(
    'result', case when v_code is null then 'ok' else 'refused' end,
    'level', coalesce(v_level, 0),
    'name', v_name,
    'already', coalesce(v_level, 0) >= p_tier,
    'until', greatest(coalesce(v_tail, now()), now()) + make_interval(days => p_days))
    || case when v_code is null then '{}'::jsonb else jsonb_build_object('code', v_code) end;
end;
$function$;

-- ── Settling a paid Checkout ─────────────────────────────────────────────
-- The EF has seen Stripe say paid for this purchase's own session. Under the
-- purchase's row lock: open → paid, then the days through premier_add_days.
-- ok → granted. refused → stays paid with refusal_code, and the EF refunds
-- (refunded) or hands it to Pato (refund_needed). A purchase already past
-- paid answers its status and changes nothing; a paid one with a refusal
-- answers refused again (the refund is what is left to do), never a second
-- try at the days. Returns { outcome: "granted" | "refused" | <status>,
-- replayed, code?, ends_at? }.
create or replace function public.premier_refill_settle(p_purchase_id uuid, p_payment_intent text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.premier_refill_purchases;
  r jsonb;
  v_end timestamptz;
begin
  select * into v from public.premier_refill_purchases where id = p_purchase_id for update;
  if not found then
    raise exception 'premier_refill_settle: no purchase %', p_purchase_id using errcode = 'P0002';
  end if;

  if v.status in ('granted', 'refunded', 'refund_needed', 'expired') then
    return jsonb_build_object('outcome', v.status, 'replayed', true, 'ends_at', v.ends_at, 'code', v.refusal_code);
  end if;
  if v.status = 'paid' and v.refusal_code is not null then
    return jsonb_build_object('outcome', 'refused', 'replayed', true, 'code', v.refusal_code);
  end if;

  if v.status = 'open' then
    update public.premier_refill_purchases
       set status = 'paid', paid_at = now(), updated_at = now(),
           stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id)
     where id = v.id and status = 'open';
  end if;

  r := public.premier_add_days(v.place_id, v.tier, v.days, 'purchase',
                               coalesce(v.consumer_id::text, 'guest'), 'purchase:' || v.id::text);

  if r ->> 'result' = 'ok' then
    v_end := (r ->> case when v.tier = 2 then 'ends_at_5x' else 'ends_at_2x' end)::timestamptz;
    update public.premier_refill_purchases
       set status = 'granted', ends_at = coalesce(v_end, now()), updated_at = now()
     where id = v.id and status = 'paid';
    return jsonb_build_object('outcome', 'granted', 'replayed', coalesce((r ->> 'replayed')::boolean, false),
                              'ends_at', coalesce(v_end, now()));
  end if;

  update public.premier_refill_purchases
     set refusal_code = coalesce(r ->> 'code', 'refused'), updated_at = now()
   where id = v.id and status = 'paid';
  return jsonb_build_object('outcome', 'refused', 'replayed', false, 'code', coalesce(r ->> 'code', 'refused'));
end;
$function$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.premier_refill_check(uuid, smallint, integer)',
    'public.premier_refill_settle(uuid, text)'
  ] loop
    execute format('revoke all on function %s from public', f);
    execute format('revoke execute on function %s from anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end
$$;

-- ── The guest Subscription retires ──────────────────────────────────────
-- A pledge a guest started (its payer is not a live owner or editor of the
-- place) ends `stopped`: no renewal, and a paid period already running runs
-- out. A charge in flight on one ends now (TEST only; no guest pledge was
-- live on 2026-11-01). Their saved cards stay on the TEST Stripe customer,
-- never charged again. The Business app's Subscription is unchanged.
with guest as (
  select b.id
    from public.place_backings b
   where b.status in ('open', 'ready')
     and not exists (
       select 1 from public.place_managers m
        where m.place_id = b.place_id and m.consumer_id = b.consumer_id
          and m.revoked_at is null and m.expires_at > now())
)
update public.place_premier_periods pp
   set status = 'ended', ends_at = greatest(pp.starts_at, least(pp.ends_at, now())), updated_at = now()
  from guest
 where pp.backing_id = guest.id and pp.status = 'charging';

update public.place_backings b
   set status = 'ended', ended_reason = 'stopped', ended_at = now(), checkout_kind = null, updated_at = now()
 where b.status in ('open', 'ready')
   and not exists (
     select 1 from public.place_managers m
      where m.place_id = b.place_id and m.consumer_id = b.consumer_id
        and m.revoked_at is null and m.expires_at > now());
