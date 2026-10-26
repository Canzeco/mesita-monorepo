-- MESITA-1998 — Spotlight: anyone can pay a monthly or yearly tier for a
-- place from the consumer app (Pato, 2026-10-25), before the Business
-- Console exists. Two tiers, Spotlight ($10/mo) and Spotlight Plus
-- ($100/mo); many guests may back one place, each with their OWN Stripe
-- subscription, and the place holds the highest tier its live backings pay
-- for together. One lapsed card never takes the tier from the others.
--
-- Paid, never verified, and never Selected: `places.selected` stays the
-- operator's mark (MESITA-2707). The paid tier is its own derived column,
-- `places.spotlight_tier`, recomputed by trigger from `place_backings`.
--
-- place_backings is EF-only (RLS on, no policies, client roles hold
-- nothing): consumer-web-start-spotlight opens a row at Checkout,
-- consumer-web-get-spotlight confirms it on return, consumer-web-cancel-
-- spotlight stops renewal, supabase-cron-sync-spotlights keeps status and
-- period from Stripe. Stripe is the record; this table mirrors it.

create table public.place_backings (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  -- Null once the guest deletes their account (their subscription is
  -- cancelled by consumer-web-delete-account first).
  consumer_id uuid references public.consumers (id) on delete set null,
  tier text not null check (tier in ('spotlight', 'spotlight_plus')),
  billing_interval text not null check (billing_interval in ('month', 'year')),
  -- What the guest pays per interval, in cents of `currency`.
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'usd',
  stripe_checkout_session_id text unique,
  stripe_subscription_id text unique,
  stripe_customer_id text,
  -- Stripe's subscription status; 'open' until Checkout completes.
  status text not null default 'open',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  -- The guest chose to be named on the place screen.
  show_name boolean not null default false,
  livemode boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.place_backings is
  'MESITA-1998 Spotlight: one guest''s Stripe subscription backing one place''s paid tier. Many per place; places.spotlight_tier is derived from the live ones. EF-only (RLS, no policies; client privileges revoked).';

create index place_backings_place_idx on public.place_backings (place_id);
create index place_backings_consumer_idx on public.place_backings (consumer_id);
create index place_backings_due_idx on public.place_backings (current_period_end)
  where status in ('active', 'trialing', 'past_due', 'incomplete', 'open');

alter table public.place_backings enable row level security;
revoke all on table public.place_backings from public, anon, authenticated;
grant all on table public.place_backings to service_role;

-- ── The derived tier ─────────────────────────────────────────────────────
alter table public.places
  add column if not exists spotlight_tier smallint not null default 0
  check (spotlight_tier between 0 and 2);

comment on column public.places.spotlight_tier is
  'MESITA-1998 Spotlight: 0 none, 1 Spotlight, 2 Spotlight Plus — the highest tier whose price the place''s live backings (place_backings, active or trialing, period not ended) cover together, a yearly backing counted as a twelfth a month. Written only by the place_backings trigger. Paid, never verified; independent of places.selected.';

grant select (spotlight_tier) on table public.places to anon, authenticated;

-- Monthly-equivalent cents a place's live backings pay, and the tier they buy.
-- Prices: Spotlight 1000, Spotlight Plus 10000 (_shared/spotlight.ts).
create or replace function public.recompute_place_spotlight(p_place_id uuid)
 returns smallint
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_cents numeric;
  v_tier smallint;
begin
  select coalesce(sum(
           case when b.billing_interval = 'year' then b.amount_cents / 12.0
                else b.amount_cents end), 0)
    into v_cents
    from public.place_backings b
   where b.place_id = p_place_id
     and b.status in ('active', 'trialing')
     and b.current_period_end > now();

  v_tier := case when v_cents >= 10000 then 2
                 when v_cents >= 1000 then 1
                 else 0 end;

  update public.places
     set spotlight_tier = v_tier
   where id = p_place_id
     and spotlight_tier is distinct from v_tier;

  return v_tier;
end;
$function$;

revoke all on function public.recompute_place_spotlight(uuid) from public;
revoke execute on function public.recompute_place_spotlight(uuid) from anon, authenticated;

create or replace function public.place_backings_recompute()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.recompute_place_spotlight(old.place_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.place_id <> old.place_id) then
    perform public.recompute_place_spotlight(new.place_id);
  end if;
  return null;
end;
$function$;

revoke all on function public.place_backings_recompute() from public;
revoke execute on function public.place_backings_recompute() from anon, authenticated;

create trigger place_backings_recompute
  after insert or update or delete on public.place_backings
  for each row execute function public.place_backings_recompute();

-- ── The view carries the tier ────────────────────────────────────────────
-- Append-only: replace keeps grants and the INSTEAD OF triggers.
create or replace view public.profiles with (security_invoker = true) as
 SELECT p.id,
    p.created_at,
    p.updated_at,
    p.google_place_id,
    p.google_primary_type,
    p.google_types,
    p.mesita_categories,
    p.prepay_enabled,
    p.payments_enabled,
    u.slug,
    p.name,
    p.category,
    p.price_level,
    u.state,
    p.lat,
    p.lng,
    p.address,
    p.timezone,
    p.closes_at,
    p.phone,
    p.pitch,
    p.story,
    p.photos,
    p.google_photos,
    p.mesita_photos,
    p.website_url,
    p.instagram_url,
    p.facebook_url,
    p.whatsapp_url,
    p.opentable_url,
    p.resy_url,
    p.uber_eats_url,
    p.x_url,
    p.threads_url,
    p.reddit_url,
    p.google_maps_url,
    p.didi_food_url,
    p.hours,
    p.embedding,
    p.embedding_source_hash,
    p.description,
    p.menu_pdf_url,
    p.tags,
    p.google_stars_overall,
    p.google_review_count,
    p.instagram_followers_count,
    u.currency,
    p.menu_pdf_name,
    p.enriched_at,
    p.enrichment_sources,
    p.zone,
    p.city,
    p.facebook_followers,
    p.google_reviews,
    p.menus,
    p.popular_times,
    p.products,
    p.category_label,
    u.content_state,
    p.embedding_source_text,
    p.google_name,
    p.mesita_name,
    p.reservation_channel,
    p.reservation_target,
    p.business_state,
    p.business_state_at,
    p.name_embedding,
    p.name_embedding_hash,
    p.request_count,
    public.families_for_category(p.category) as family_keys,
    p.reservations_enabled,
    p.google_address,
    p.source_sync,
    u.selected,
    p.google_tags,
    u.spotlight_tier
   FROM places u
     JOIN place_profiles p ON p.id = u.id;

-- ── Keep status and period from Stripe ───────────────────────────────────
-- Hourly. Same pg_net + vault pattern as run-reservation-retries.
-- Kill switch: select cron.unschedule('sync-spotlights');
select cron.unschedule('sync-spotlights')
where exists (select 1 from cron.job where jobname = 'sync-spotlights');

select cron.schedule(
  'sync-spotlights',
  '7 * * * *',
  $$
  select net.http_post(
    url := 'https://yjalywfzdelacdzccpgb.supabase.co/functions/v1/supabase-cron-sync-spotlights',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'scheduler_service_role_key'
      ),
      'X-Internal-Caller', 'pg_cron'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
