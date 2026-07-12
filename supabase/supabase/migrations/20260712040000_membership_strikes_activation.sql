-- Buzz v4 membership: activation gate + strikes ladder (MESITA-542).
--
-- Activation: staff WhatsApp test ping + first guest ticket honored → live.
-- Strikes (refused/ignored QR): 1 warning+re-test · 2 pause promo 30d ·
-- 3 remove paid posture (plan→free, rates cleared, fee forfeited stamp).
-- Strikes decay after 6 months clean. Burned guest gets a compensation coupon.

-- ── projects columns ─────────────────────────────────────────────────────────
alter table public.projects
  add column if not exists staff_channel_pinged_at timestamptz,
  add column if not exists first_ticket_honored_at timestamptz,
  add column if not exists membership_live_at timestamptz,
  add column if not exists strike_count smallint not null default 0
    constraint projects_strike_count_range check (strike_count between 0 and 3),
  add column if not exists last_strike_at timestamptz,
  add column if not exists promo_paused_until timestamptz,
  add column if not exists membership_forfeited_at timestamptz;

comment on column public.projects.staff_channel_pinged_at is
  'Last successful staff WhatsApp activation/test ping (MESITA-542).';
comment on column public.projects.first_ticket_honored_at is
  'When the first discount ticket was honored at the bill (MESITA-542).';
comment on column public.projects.membership_live_at is
  'Promo lane open: ping + first ticket honored (MESITA-542). Null = not yet live.';
comment on column public.projects.strike_count is
  'Active membership strikes (0–3). Decays after 6 months clean.';
comment on column public.projects.last_strike_at is
  'Timestamp of the most recent strike (drives 6-month decay).';
comment on column public.projects.promo_paused_until is
  'Strike-2 pause: promo lane blocked until this instant.';
comment on column public.projects.membership_forfeited_at is
  'Strike-3 forfeit stamp. Plan/rates cleared; place stays in catalog.';

-- ── strikes audit log ────────────────────────────────────────────────────────
create table if not exists public.membership_strikes (
  id                      uuid primary key default gen_random_uuid(),
  created_at              timestamptz not null default now(),
  project_id              uuid not null references public.projects(id) on delete cascade,
  consumer_id             uuid references public.consumers(id) on delete set null,
  ticket_id               uuid references public.tickets(id) on delete set null,
  reason                  text not null
    check (reason in ('refused_qr', 'ignored_qr')),
  strike_number           smallint not null check (strike_number between 1 and 3),
  compensation_coupon_id  uuid references public.coupons(id) on delete set null,
  notes                   text
);

create index if not exists membership_strikes_project_idx
  on public.membership_strikes (project_id, created_at desc);

alter table public.membership_strikes enable row level security;
-- EF-only lockdown (no policies) — same pattern as other ops tables.

comment on table public.membership_strikes is
  'Buzz v4 membership strike ledger (MESITA-542). Written only by Edge Functions.';

-- ── expose membership columns on projects_view (read path) ───────────────────
create or replace view public.projects_view
with (security_invoker = false)
as
select
  p.id,
  p.created_at,
  p.updated_at,
  p.google_place_id,
  u.slug,
  p.name,
  p.category,
  p.vibe,
  p.price_level,
  u.listing_type,
  u.status,
  p.lat,
  p.lng,
  p.address,
  p.timezone,
  p.closes_at,
  p.phone,
  p.pitch,
  p.story,
  p.photos,
  p.website_url,
  p.instagram_url,
  p.tiktok_url,
  p.facebook_url,
  p.whatsapp_url,
  p.opentable_url,
  p.resy_url,
  p.uber_eats_url,
  u.fiscal_type,
  u.plan,
  p.x_url,
  p.threads_url,
  p.reddit_url,
  p.google_maps_url,
  p.tripadvisor_url,
  p.didi_food_url,
  p.email,
  p.hours,
  p.embedding,
  p.embedding_source_hash,
  p.country,
  p.description,
  p.menu_pdf_url,
  p.tags,
  p.whatsapp_pr_urls,
  p.instagram_pr_urls,
  p.google_business_url,
  p.google_stars_overall,
  p.google_review_count,
  p.google_visitor_count,
  p.mesita_stars_overall,
  p.mesita_stars_food,
  p.mesita_stars_service,
  p.mesita_stars_ambience,
  p.mesita_review_count,
  p.mesita_visitor_count,
  p.instagram_followers_count,
  u.segmentation_basic_enabled,
  u.segmentation_advanced_enabled,
  u.currency,
  p.menu_pdf_name,
  u.welcome_free_rate,
  u.welcome_premium_rate,
  u.free_rate,
  u.premium_rate,
  p.enriched_at,
  p.enrichment_sources,
  p.editorial_summary,
  p.zone,
  p.city,
  p.established_year,
  p.executive_chef,
  u.reward_cap_cents,
  u.requires_story,
  p.facebook_rating,
  p.facebook_followers,
  p.mesita_stars_value,
  p.details,
  p.google_reviews,
  p.menus,
  p.popular_times,
  u.monthly_promo_cap,
  p.products,
  p.category_label,
  u.content_status,
  p.yelp_url,
  p.reservation_endpoint,
  p.reservation_contacts,
  u.staff_channel_pinged_at,
  u.first_ticket_honored_at,
  u.membership_live_at,
  u.strike_count,
  u.last_strike_at,
  u.promo_paused_until,
  u.membership_forfeited_at
from public.projects u
join public.places p on p.id = u.id;

comment on view public.projects_view is
  'SECURITY DEFINER join of projects ⋈ places. Accepted advisor 0010 exception — invoker would hide pending/enriching places from consumer browse. EF-only writes via INSTEAD OF triggers.';

-- ── coupon trigger: paid places need a live, unpaused membership ─────────────
create or replace function public.tg_saved_places_issue_coupon()
 returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare v record;
begin
  select listing_type, plan, welcome_free_rate, welcome_premium_rate, free_rate, premium_rate,
         currency, membership_live_at, promo_paused_until, membership_forfeited_at
    into v from public.projects where id = new.project_id;
  if not found or v.listing_type <> 'partner' then return new; end if;
  -- Paid postures only issue wallet coupons once membership is live and not paused/forfeited.
  if v.plan is distinct from 'free'::public.membership then
    if v.membership_forfeited_at is not null then return new; end if;
    if v.membership_live_at is null then return new; end if;
    if v.promo_paused_until is not null and v.promo_paused_until > now() then return new; end if;
  end if;
  insert into public.coupons (
    consumer_id, project_id, saved_place_id,
    welcome_free_rate, welcome_premium_rate, free_rate, premium_rate, cap_cents, currency
  ) values (
    new.consumer_id, new.project_id, new.id,
    v.welcome_free_rate, v.welcome_premium_rate, v.free_rate, v.premium_rate, 0, coalesce(v.currency,'MXN')
  ) on conflict (consumer_id, project_id) where status = 'active' do nothing;
  return new;
end$function$;

-- ── grandfather existing paid places so they aren't locked out ───────────────
update public.projects
set
  membership_live_at = coalesce(membership_live_at, now()),
  staff_channel_pinged_at = coalesce(staff_channel_pinged_at, now()),
  first_ticket_honored_at = coalesce(first_ticket_honored_at, now())
where plan is distinct from 'free'::public.membership
  and membership_forfeited_at is null
  and membership_live_at is null;

-- ── admin_reset: include membership_strikes ──────────────────────────────────
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
    public.membership_strikes,
    public.coupons,
    public.saved_places,
    public.tickets,
    public.project_verifications,
    public.account_invites,
    public.staff_invites,
    public.project_roles,
    public.project_members,
    public.place_enrichment_events,
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
    ('free',    'Free',    0, null, 2,    0,     'MXN', 1.0),
    ('premium', 'Premium', 1, 1000, null, 10000, 'MXN', 1.5)
  on conflict (key) do update set
    label                     = excluded.label,
    rank                      = excluded.rank,
    follower_threshold        = excluded.follower_threshold,
    monthly_reservation_limit = excluded.monthly_reservation_limit,
    price_cents               = excluded.price_cents,
    currency                  = excluded.currency,
    recommendation_weight     = excluded.recommendation_weight;

  insert into public.business_plans (key, label, price_cents, currency) values
    ('pro',   'Pro',     10000,  'MXN'),
    ('ultra', 'Ultra',   500000, 'MXN')
  on conflict (key) do update set
    label       = excluded.label,
    price_cents = excluded.price_cents,
    currency    = excluded.currency;

  perform public.seed_place_categories();
  perform public.seed_place_tags();

  delete from auth.users u
  where u.email is null
     or lower(u.email) not in (select lower(email) from public.super_admins);
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
