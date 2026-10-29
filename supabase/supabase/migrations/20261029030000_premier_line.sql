-- MESITA-2995 — Premier's line (Pato, 2026-10-28). Many guests may pledge
-- for one place, but only ONE pledge pays per period: the payer. The rest
-- are backups, charged nothing until a renewal reaches them because every
-- card above them failed. Upgrading mid-period takes the unused part of the
-- running period off the new price (the credit belongs to the place).
--
-- Replaces the sum model (MESITA-1998/2789: every backer its own Stripe
-- subscription, tiers summed). 0 paid backings on 2026-10-28, Stripe TEST.
--
--   place_backings         one pledge per guest per place (the line)
--   place_premier_periods  one row per paid stretch of a place's Premier
--   places.boost_tier      the tier of the period covering now
--
-- Mesita runs the periods: saved cards (Checkout payment + setup_future_usage,
-- or setup) and one-off off-session charges. No subscriptions, no webhook
-- (the EF name is the ACL), so supabase-cron-sync-boosts polls every 5 min.
-- Every period write is an RPC below that takes the place's advisory lock;
-- the exclusion constraint is the backstop against overlapping periods.

create extension if not exists btree_gist with schema extensions;

-- ── One Stripe customer per guest ────────────────────────────────────────
-- Its own table, not a consumers column: consumers' Stripe customer id is a
-- retired column (dropped-column-refs.test.ts) and consumers has one write
-- door; Premier's customer is Premier's.
create table public.premier_customers (
  consumer_id uuid not null references public.consumers (id) on delete cascade,
  -- A test-mode customer does not exist in live mode: one row per mode.
  livemode boolean not null default false,
  stripe_customer text not null unique,
  created_at timestamptz not null default now(),
  primary key (consumer_id, livemode)
);

alter table public.premier_customers enable row level security;
revoke all on table public.premier_customers from public, anon, authenticated;
grant all on table public.premier_customers to service_role;

comment on table public.premier_customers is
  'MESITA-2995 Premier: the guest''s Stripe customer (saved cards for pledges), one per guest. EF-only.';

-- ── Pledges ──────────────────────────────────────────────────────────────
-- The 3 rows here are unpaid TEST-mode subscription Checkouts; none can be
-- confirmed under the new model. decision: they are dropped, not expired by
-- API (no key outside the EF environment); Stripe lapses each within 24 h of
-- its creation and TEST mode charges no real card.
delete from public.place_backings;

drop trigger if exists place_backings_recompute on public.place_backings;
drop function if exists public.place_backings_recompute();
drop index if exists public.place_backings_due_idx;

alter table public.place_backings
  drop column if exists stripe_subscription_id,
  drop column if exists current_period_end,
  drop column if exists cancel_at_period_end,
  drop column if exists stripe_customer_id,
  drop column if exists show_name,
  add column queued_at timestamptz not null default now(),
  add column stripe_payment_method_id text,
  add column pending_tier text check (pending_tier in ('boost_2x', 'boost_5x', 'boost_10x')),
  add column pending_interval text check (pending_interval in ('month', 'year')),
  add column pending_amount_cents integer check (pending_amount_cents > 0),
  add column quoted_period_id uuid,
  add column quoted_credit_cents integer not null default 0 check (quoted_credit_cents >= 0),
  add column ended_at timestamptz;

alter table public.place_backings drop constraint if exists place_backings_status_check;
alter table public.place_backings
  add constraint place_backings_status_check check (status in ('open', 'ready', 'failed', 'ended'));

create unique index place_backings_one_live
  on public.place_backings (place_id, consumer_id)
  where status in ('open', 'ready', 'failed') and consumer_id is not null;
create index place_backings_line_idx on public.place_backings (place_id, status);

comment on table public.place_backings is
  'MESITA-2995 Premier pledges: one row per guest per place (the line). open = Checkout not finished; ready = card saved, in line; failed = its last charge was declined; ended = left. Only the current period''s payer is charged; the rest are backups ordered by tier desc, queued_at asc. EF-only (RLS, no policies; client privileges revoked).';
comment on column public.place_backings.queued_at is
  'MESITA-2995: place in line among equal tiers; reset whenever the pledge returns to ready.';
comment on column public.place_backings.pending_tier is
  'MESITA-2995: an upgrade waiting on its Checkout; moves into tier on confirm.';

-- ── Periods ──────────────────────────────────────────────────────────────
create table public.place_premier_periods (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  -- Null for a grant (an operator's period, nothing paid).
  backing_id uuid references public.place_backings (id) on delete set null,
  granted_by text,
  tier smallint not null check (tier between 1 and 3),
  billing_interval text not null check (billing_interval in ('month', 'year')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- When an upgrade cut this period short: the end it had before, so a
  -- capture that then fails can give it back.
  cut_from timestamptz,
  price_cents integer not null default 0 check (price_cents >= 0),
  credit_cents integer not null default 0 check (credit_cents >= 0),
  extra_days integer not null default 0 check (extra_days >= 0),
  charged_cents integer not null default 0 check (charged_cents >= 0),
  stripe_payment_intent_id text unique,
  stripe_checkout_session_id text unique,
  status text not null check (status in ('charging', 'paid', 'declined', 'replaced', 'ended')),
  livemode boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at >= starts_at),
  constraint place_premier_periods_no_overlap
    exclude using gist (place_id with =, tstzrange(starts_at, ends_at) with &&)
    where (status in ('charging', 'paid'))
);

create index place_premier_periods_place_idx on public.place_premier_periods (place_id);
create index place_premier_periods_due_idx on public.place_premier_periods (status, ends_at);

alter table public.place_premier_periods enable row level security;
revoke all on table public.place_premier_periods from public, anon, authenticated;
grant all on table public.place_premier_periods to service_role;

comment on table public.place_premier_periods is
  'MESITA-2995 Premier periods: one row per paid stretch of a place. charging = a PaymentIntent whose outcome is not known yet; paid; declined (zero length); replaced (cut short by an upgrade); ended (a grant ended early). backing_id null = an operator grant. Written only by the premier_* RPCs. EF-only.';

-- ── The tier a place holds ───────────────────────────────────────────────
-- A paid period covering now, or a charge still in flight for up to an hour
-- (a renewal starts at the old end, so the tier never blinks while Stripe
-- answers).
create or replace function public.recompute_place_boost(p_place_id uuid)
 returns smallint
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_tier smallint;
begin
  select p.tier into v_tier
    from public.place_premier_periods p
   where p.place_id = p_place_id
     and ((p.status = 'paid' and p.starts_at <= now() and p.ends_at > now())
       or (p.status = 'charging' and p.starts_at <= now() and p.starts_at > now() - interval '1 hour'))
   order by p.starts_at desc
   limit 1;

  v_tier := coalesce(v_tier, 0);

  update public.places
     set boost_tier = v_tier
   where id = p_place_id
     and boost_tier is distinct from v_tier;

  return v_tier;
end;
$function$;

create or replace function public.place_premier_periods_recompute()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  perform public.recompute_place_boost(coalesce(new.place_id, old.place_id));
  return null;
end;
$function$;

create trigger place_premier_periods_recompute
  after insert or update or delete on public.place_premier_periods
  for each row execute function public.place_premier_periods_recompute();

-- Time passes without a row write: every 5 minutes, recompute every place
-- that holds a tier or whose period started in the last 70 minutes.
create or replace function public.recompute_due_place_boosts()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  n integer := 0;
begin
  for r in
    select id as place_id from public.places where boost_tier > 0
    union
    select place_id from public.place_premier_periods
     where status in ('paid', 'charging') and starts_at > now() - interval '70 minutes'
  loop
    perform public.recompute_place_boost(r.place_id);
    n := n + 1;
  end loop;
  return n;
end;
$function$;

-- ── Period writes: one writer per place ──────────────────────────────────
create or replace function public.premier_tier_rank(p_tier text)
 returns smallint
 language sql
 immutable
as $function$
  select case p_tier when 'boost_2x' then 1 when 'boost_5x' then 2 when 'boost_10x' then 3 end::smallint;
$function$;

create or replace function public.premier_interval_end(p_start timestamptz, p_interval text, p_extra_days integer)
 returns timestamptz
 language sql
 immutable
as $function$
  select p_start
       + case p_interval when 'year' then interval '1 year' else interval '1 month' end
       + make_interval(days => greatest(coalesce(p_extra_days, 0), 0));
$function$;

-- A pays-now pledge confirmed (Checkout came back). Under the lock: already
-- settled → 'settled'; the quote no longer holds → 'stale' (the caller
-- releases the hold); else the running period is cut at now (its old end
-- kept in cut_from) and the new one starts now.
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

  if exists (select 1 from public.place_premier_periods
              where place_id = v_place and status = 'charging') then
    return jsonb_build_object('result', 'stale', 'reason', 'charging');
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

-- The next renewal of a place: under the lock, nothing while a period covers
-- now or a charge is in flight (that one is returned to resolve). Else the
-- top ready pledge with a saved card gets a charging row starting at the old
-- end (when it ended within the hour) or now.
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
   order by public.premier_tier_rank(tier) desc, queued_at asc
   limit 1;
  if v_pledge.id is null then
    return jsonb_build_object('action', 'none');
  end if;

  select max(ends_at) into v_last
    from public.place_premier_periods
   where place_id = p_place_id and status in ('paid', 'ended');
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

-- A charge's outcome. paid → paid. declined → zero length, the pledge
-- failed, and a period an upgrade cut short gets its end back. Idempotent:
-- a row no longer charging is left as it is.
create or replace function public.premier_settle(
  p_period_id uuid,
  p_outcome text,
  p_payment_intent_id text
)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_row public.place_premier_periods;
begin
  if p_outcome not in ('paid', 'declined') then
    raise exception 'premier_settle: outcome must be paid or declined';
  end if;

  select * into v_row from public.place_premier_periods where id = p_period_id;
  if v_row.id is null then
    return 'missing';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_row.place_id::text));
  select * into v_row from public.place_premier_periods where id = p_period_id for update;
  if v_row.status <> 'charging' then
    return v_row.status;
  end if;

  if p_outcome = 'paid' then
    update public.place_premier_periods
       set status = 'paid',
           stripe_payment_intent_id = coalesce(p_payment_intent_id, stripe_payment_intent_id),
           updated_at = now()
     where id = p_period_id;
    return 'paid';
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
    update public.place_backings
       set status = 'failed', updated_at = now()
     where id = v_row.backing_id and status = 'ready';
  end if;

  return 'declined';
end;
$function$;

-- Operator grant: a paid period with no payer. Refused while a period
-- covers now.
create or replace function public.premier_grant(
  p_place_id uuid,
  p_tier smallint,
  p_months integer,
  p_by text
)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  if p_tier not between 1 and 3 or p_months not between 1 and 12 then
    raise exception 'premier_grant: tier 1..3 and months 1..12';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_place_id::text));
  if exists (select 1 from public.place_premier_periods
              where place_id = p_place_id and status in ('paid', 'charging') and ends_at > now()) then
    raise exception 'premier_grant: a period is running' using errcode = 'P0001';
  end if;
  insert into public.place_premier_periods (
    place_id, tier, billing_interval, starts_at, ends_at, granted_by, status
  ) values (
    p_place_id, p_tier, 'month', now(), now() + make_interval(months => p_months), p_by, 'paid'
  ) returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.premier_end_grant(p_place_id uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_place_id::text));
  update public.place_premier_periods
     set status = 'ended', ends_at = now(), updated_at = now()
   where id = (select id from public.place_premier_periods
                where place_id = p_place_id and status = 'paid' and backing_id is null
                  and starts_at <= now() and ends_at > now()
                order by starts_at desc limit 1)
  returning id into v_id;
  if v_id is null then
    raise exception 'premier_end_grant: no running grant' using errcode = 'P0001';
  end if;
  return v_id;
end;
$function$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.recompute_place_boost(uuid)',
    'public.place_premier_periods_recompute()',
    'public.recompute_due_place_boosts()',
    'public.premier_claim(uuid, uuid, text, text, integer, integer, integer, integer, text, text, text, boolean)',
    'public.premier_begin_renewal(uuid)',
    'public.premier_settle(uuid, text, text)',
    'public.premier_grant(uuid, smallint, integer, text)',
    'public.premier_end_grant(uuid)'
  ] loop
    execute format('revoke all on function %s from public', f);
    execute format('revoke execute on function %s from anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end
$$;

comment on column public.places.boost_tier is
  'MESITA-2995 Premier: 0 none, 1 2X, 2 5X, 3 10X — the tier of the paid period covering now (place_premier_periods), or of a charge in flight for up to an hour. Written only by the period trigger and recompute_due_place_boosts. Paid, never verified.';

-- ── Crons: every 5 minutes ───────────────────────────────────────────────
-- Kill switches: select cron.unschedule('sync-boosts');
--                select cron.unschedule('recompute-premier');
select cron.unschedule('sync-boosts')
where exists (select 1 from cron.job where jobname = 'sync-boosts');
select cron.unschedule('recompute-premier')
where exists (select 1 from cron.job where jobname = 'recompute-premier');

select cron.schedule(
  'sync-boosts',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://yjalywfzdelacdzccpgb.supabase.co/functions/v1/supabase-cron-sync-boosts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'scheduler_service_role_key'
      ),
      'X-Internal-Caller', 'pg_cron'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

select cron.schedule('recompute-premier', '*/5 * * * *', $$select public.recompute_due_place_boosts()$$);
