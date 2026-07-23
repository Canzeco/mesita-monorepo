-- Promos v5 — the engine half (MESITA-723), the follow-up #474 deferred.
--
-- #474 (20260722200000_rewards_config) shipped the operator-tunable grid on
-- app_settings.rewards_config + the admin/consumer UI, but left the bill on v4
-- and named this follow-up: "best-of resolution (replacing selectProjectRate)
-- + the magnetic class + the story/review action rails". This migration adds
-- the DATA that half needs; the resolver (_shared/rewards-config.ts) reads the
-- grid × the place's posture and pays best-of. It adds NO per-place rate
-- columns — the grid stays the single source of truth (grid-authoritative;
-- Pato 2026-07-22). A place's posture is still derived from its v4 rate
-- columns via postureForRates, exactly as #474 left it.

-- 1 · The Magnetic class — assigned (admin-side), never purchasable. rank 2
-- sits above premium; follower_threshold documents the working bar.
insert into public.classes
  (key, label, rank, follower_threshold, monthly_reservation_limit, price_cents, currency, recommendation_weight)
values
  ('magnetic', 'Magnetic', 2, 1000, null, 0, 'MXN', 1.5)
on conflict (key) do update set
  label                     = excluded.label,
  rank                      = excluded.rank,
  follower_threshold        = excluded.follower_threshold,
  monthly_reservation_limit = excluded.monthly_reservation_limit,
  price_cents               = excluded.price_cents,
  currency                  = excluded.currency,
  recommendation_weight     = excluded.recommendation_weight;

-- 2 · Google Review action rails on tickets — mirror of the story columns,
-- reusing the story_status enum (identical lifecycle: not_required → pending/
-- submitted → ai_/staff_ verified/rejected). The Story rung reuses the
-- existing story_* columns; this adds the Review rung's twin.
alter table public.tickets
  add column if not exists review_status public.story_status not null default 'not_required',
  add column if not exists review_screenshot_url text,
  add column if not exists review_submitted_at timestamptz,
  add column if not exists review_verified_at timestamptz,
  add column if not exists review_verified_by uuid,
  add column if not exists review_reject_reason text;

comment on column public.tickets.review_status is
  'Google Review action lifecycle (Promos v5). Same enum as story_status; not_required until the consumer opts in.';

create index if not exists tickets_review_status_idx on public.tickets (review_status)
  where review_status in ('submitted', 'ai_rejected');

-- 3 · Claim-once ledger for the Google Review rung. Google allows one review
-- per account per place, so the reward is claimable once per consumer × place.
-- EF-only table: RLS enabled with NO policies on purpose (service-role Edge
-- Functions only) — the deliberate lockdown pattern; do not add policies.
create table if not exists public.consumer_review_claims (
  consumer_id uuid not null references public.consumers (id) on delete cascade,
  project_id  uuid not null references public.projects (id) on delete cascade,
  ticket_id   uuid references public.tickets (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (consumer_id, project_id)
);
alter table public.consumer_review_claims enable row level security;
comment on table public.consumer_review_claims is
  'Promos v5: one Google Review discount per consumer per place, claimed at staff-verify time. EF-only (RLS, no policies).';

-- 4 · admin_reset_database(): seed the magnetic class alongside free/premium
-- and add consumer_review_claims to the explicit truncate inventory. Body
-- otherwise byte-identical to 20260716120000.
create or replace function public.admin_reset_database()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  deleted_users bigint;
begin
  truncate table
    public.ticket_reviews,
    public.consumer_pay_notifications,
    public.staff_whatsapp_messages,
    public.staff_whatsapp_sessions,
    public.consumer_subscriptions,
    public.project_subscriptions,
    public.stripe_events,
    public.reservations,
    public.coupons,
    public.membership_strikes,
    public.saved_places,
    public.consumer_review_claims,
    public.tickets,
    public.project_verifications,
    public.account_invites,
    public.staff_invites,
    public.project_roles,
    public.project_members,
    public.place_enrichment_events,
    public.place_creation_attempts,
    public.consumer_mcp_tokens,
    public.place_media_assets,
    public.place_research,
    public.projects,
    public.places,
    public.consumers,
    public.accounts
  restart identity cascade;

  update public.consumer_code_counter set next_value = 0 where id = 1;

  insert into public.classes
    (key, label, rank, follower_threshold, monthly_reservation_limit, price_cents, currency, recommendation_weight)
  values
    ('free',     'Free',     0, null, 2,    0,     'MXN', 1.0),
    ('premium',  'Premium',  1, 1000, null, 10000, 'MXN', 1.5),
    ('magnetic', 'Magnetic', 2, 1000, null, 0,     'MXN', 1.5)
  on conflict (key) do update set
    label                     = excluded.label,
    rank                      = excluded.rank,
    follower_threshold        = excluded.follower_threshold,
    monthly_reservation_limit = excluded.monthly_reservation_limit,
    price_cents               = excluded.price_cents,
    currency                  = excluded.currency,
    recommendation_weight     = excluded.recommendation_weight;

  insert into public.business_plans (key, label, price_cents, currency) values
    ('pro',   'Verified', 100000, 'MXN'),
    ('ultra', 'Ultra',    500000, 'MXN')
  on conflict (key) do update set
    label       = excluded.label,
    price_cents = excluded.price_cents,
    currency    = excluded.currency;

  perform public.seed_place_categories();
  perform public.seed_place_tags();

  delete from auth.users u
  where not exists (
    select 1
    from public.super_admins sa
    where (u.email is not null and lower(u.email) = lower(sa.email))
       or (u.phone is not null and sa.phone is not null and u.phone = sa.phone)
       or (sa.user_id is not null and sa.user_id = u.id)
  );
  get diagnostics deleted_users = row_count;

  return jsonb_build_object(
    'ok', true,
    'deleted_auth_users', deleted_users,
    'preserved_media_assets', true,
    'reset_at', now()
  );
end;
$function$;

notify pgrst, 'reload schema';
