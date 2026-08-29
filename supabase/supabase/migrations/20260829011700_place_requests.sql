-- Requests: consumer demand toward a usable Mesita profile.
--
-- A Listed place may exist without a usable profile (content_status <> ready).
-- Consumers request that profile; the count is numeric. Requested is derived
-- (count > 0 and not ready), never a status-per-count. The Intake knob
-- atlasRequestThreshold is the single consumer-driven auto-enrich trigger.
-- Admin create/enrich does not read this table.

alter table public.places
  add column if not exists request_count integer not null default 0;

alter table public.places
  drop constraint if exists places_request_count_nonneg;

alter table public.places
  add constraint places_request_count_nonneg check (request_count >= 0);

comment on column public.places.request_count is
  'Consumer Requests count. Progress toward Intake atlasRequestThreshold. Requested is derived (count > 0 and content_status <> ready).';

create table if not exists public.place_requests (
  consumer_id uuid not null references public.consumers (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (consumer_id, place_id)
);

comment on table public.place_requests is
  'One request per consumer per place. EF-only (RLS, no policies; client privileges revoked).';

create index if not exists place_requests_place_id_idx
  on public.place_requests (place_id);

alter table public.place_requests enable row level security;
revoke all on table public.place_requests from public, anon, authenticated;
grant all on table public.place_requests to service_role;

-- Atomic insert + increment. ON CONFLICT DO NOTHING is the idempotency door.
create or replace function public.apply_place_request(
  p_consumer_id uuid,
  p_place_id uuid
) returns table (inserted boolean, request_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
  v_count integer;
begin
  insert into public.place_requests (consumer_id, place_id)
  values (p_consumer_id, p_place_id)
  on conflict (consumer_id, place_id) do nothing;
  get diagnostics n = row_count;

  if n > 0 then
    update public.places
       set request_count = places.request_count + 1
     where id = p_place_id
     returning places.request_count into v_count;
  else
    select p.request_count into v_count
      from public.places p
     where p.id = p_place_id;
  end if;

  inserted := n > 0;
  request_count := coalesce(v_count, 0);
  return next;
end;
$$;

revoke all on function public.apply_place_request(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.apply_place_request(uuid, uuid) to service_role;

comment on function public.apply_place_request(uuid, uuid) is
  'Idempotent consumer request. Inserts place_requests; increments places.request_count only on a new row. Service-role only.';

-- Backfill the Intake knob before the CHECK requires it.
update public.app_config
   set enrichment_config = jsonb_set(
     coalesce(enrichment_config, '{}'::jsonb),
     '{atlasRequestThreshold}',
     '3'::jsonb,
     true
   )
 where enrichment_config->>'atlasRequestThreshold' is null;

alter table public.app_config
  drop constraint if exists app_config_enrichment_config_check;

alter table public.app_config
  add constraint app_config_enrichment_config_check check (
    jsonb_typeof(enrichment_config) = 'object'
    and coalesce((enrichment_config->>'atlasGatherGoogleImages')::int, -1) between 0 and 10
    and coalesce((enrichment_config->>'atlasGatherInstagramDepth')::int, -1) between 1 and 30
    and coalesce((enrichment_config->>'atlasGatherInstagramPosts')::int, -1) between 0 and 30
    and coalesce((enrichment_config->>'atlasGatherInstagramPosts')::int, 999)
        <= coalesce((enrichment_config->>'atlasGatherInstagramDepth')::int, 0)
    and coalesce((enrichment_config->>'atlasGatherReviews')::int, -1) between 0 and 100
    and jsonb_typeof(enrichment_config->'atlasImageVisionEnabled') = 'boolean'
    and coalesce((enrichment_config->>'atlasAnalyzeGoogleImages')::int, -1) between 0 and 10
    and coalesce((enrichment_config->>'atlasAnalyzeInstagramImages')::int, -1) between 0 and 30
    and coalesce((enrichment_config->>'atlasSaveTotalImages')::int, -1) between 0 and 10
    and jsonb_typeof(enrichment_config->'atlasSaveImagesToStorage') = 'boolean'
    and jsonb_typeof(enrichment_config->'atlasImageAnalysisPrompt') = 'string'
    and length(enrichment_config->>'atlasImageAnalysisPrompt') <= 4000
    and jsonb_typeof(enrichment_config->'atlasImageSortingPrompt') = 'string'
    and length(enrichment_config->>'atlasImageSortingPrompt') <= 4000
    and coalesce(enrichment_config->>'atlasSynthesisQuality', '') in ('economy', 'standard', 'high')
    and coalesce(enrichment_config->>'atlasVisionQuality', '') in ('economy', 'standard', 'high')
    and coalesce(enrichment_config->>'atlasPerplexityPreset', '') in (
      'fast-search', 'pro-search', 'deep-research', 'advanced-deep-research'
    )
    and coalesce((enrichment_config->>'atlasPerRunCostCapUsd')::numeric, -1) >= 0
    and coalesce((enrichment_config->>'atlasDiscoverWebsiteN')::int, -1) between 0 and 10
    and coalesce((enrichment_config->>'atlasDiscoverInstagramN')::int, -1) between 0 and 10
    and coalesce((enrichment_config->>'atlasDiscoverFacebookN')::int, -1) between 0 and 10
    and coalesce((enrichment_config->>'atlasDiscoverOpentableN')::int, -1) between 0 and 10
    and coalesce((enrichment_config->>'atlasDiscoverUbereatsN')::int, -1) between 0 and 10
    and coalesce((enrichment_config->>'atlasRequestThreshold')::int, -1) between 1 and 100
  );

-- CREATE OR REPLACE can only ADD columns at the end.
create or replace view public.profiles
  with (security_invoker = true)
as
 select p.id,
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
    u.discount_cap_cents,
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
    u.staff_channel_pinged_at,
    u.first_ticket_honored_at,
    u.plan_live_at,
    u.strike_count,
    u.last_strike_at,
    u.promo_paused_until,
    u.plan_forfeited_at,
    p.embedding_source_text,
    p.google_name,
    p.description_es,
    p.mesita_name,
    p.reservation_channel,
    p.reservation_target,
    p.order_channel,
    p.order_target,
    p.business_status,
    p.business_status_at,
    p.name_embedding,
    p.name_embedding_hash,
    null::text as tiktok_url,
    null::text as tripadvisor_url,
    null::text as yelp_url,
    false as requires_story,
    p.request_count
   from projects u
     join places p on p.id = u.id;

comment on view public.profiles is
  'SECURITY INVOKER join of projects ⋈ places. Dummy tiktok_url / tripadvisor_url / yelp_url / requires_story keep pre-redeploy EFs selecting; base tables no longer store them. INVARIANT: any create-or-replace MUST keep with (security_invoker = true).';

grant select on table public.profiles to anon, authenticated;
grant select, insert, update, delete, truncate, references, trigger
  on table public.profiles to service_role;

do $$
begin
  if not exists (
    select 1 from pg_class
     where oid = 'public.profiles'::regclass
       and 'security_invoker=true' = any (reloptions)
  ) then
    raise exception 'public.profiles lost security_invoker=true';
  end if;
  if not has_table_privilege('anon', 'public.profiles', 'select') then
    raise exception 'anon lost SELECT on public.profiles';
  end if;
  if (
    select count(*) from pg_trigger t
     where t.tgrelid = 'public.profiles'::regclass and not t.tgisinternal
  ) <> 2 then
    raise exception 'profiles lost an INSTEAD OF trigger';
  end if;
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'places'
       and column_name = 'request_count'
  ) then
    raise exception 'places.request_count missing';
  end if;
end $$;

notify pgrst, 'reload schema';
