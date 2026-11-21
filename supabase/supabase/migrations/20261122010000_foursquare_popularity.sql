-- MESITA-4515: Popularity is Google popularity × a Foursquare boost.
-- The boost is 1 + factor × raw^exponent. A missing score is null, which
-- ranks as 1×. A measured 0 is stored as 0 and also ranks as 1×.
-- Recent weight is fixed: 0.20 + 0.60 × min(observed days / 30, 1) once two
-- snapshots are at least 7 days apart, and it stops at 80%. The stored
-- growth-weight cap is ignored.

alter table public.place_profiles
  add column if not exists foursquare_place_id text,
  add column if not exists foursquare_url text,
  add column if not exists foursquare_popularity double precision,
  add column if not exists foursquare_popularity_at timestamptz;

alter table public.place_profiles
  drop constraint if exists place_profiles_foursquare_popularity_range;

alter table public.place_profiles
  add constraint place_profiles_foursquare_popularity_range
  check (
    foursquare_popularity is null
    or (foursquare_popularity >= 0 and foursquare_popularity <= 1)
  );

comment on column public.place_profiles.foursquare_place_id is
  'MESITA-4515: the matched Foursquare place id. Null until a branch is confirmed.';
comment on column public.place_profiles.foursquare_url is
  'MESITA-4515: the canonical Foursquare venue page for the matched branch.';
comment on column public.place_profiles.foursquare_popularity is
  'MESITA-4515: raw Foursquare popularity, 0–1. Null means unavailable, which ranks as a 1× boost. 0 is a measured zero.';
comment on column public.place_profiles.foursquare_popularity_at is
  'MESITA-4515: when a popularity value was last stored. A failed refresh does not move it.';

-- Append only. CREATE OR REPLACE keeps the view's INSTEAD OF triggers and grants.
create or replace view public.profiles with (security_invoker = true) as
 SELECT p.id,
    p.created_at,
    p.updated_at,
    p.google_place_id,
    p.google_types,
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
    p.reservation_channel,
    p.reservation_target,
    p.business_state,
    p.business_state_at,
    p.request_count,
    place_family_keys(p.family_keys, p.google_types, p.category) AS family_keys,
    p.reservations_enabled,
    p.google_address,
    p.source_sync,
    p.google_tags,
    u.boost_tier,
    p.google_source_types,
    coalesce(p.profile_photo, p.photos[1]) AS profile_photo,
    p.foursquare_place_id,
    p.foursquare_url,
    p.foursquare_popularity,
    p.foursquare_popularity_at
   FROM places u
     JOIN place_profiles p ON p.id = u.id;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'foursquare_popularity'
  ) then
    raise exception 'MESITA-4515: profiles.foursquare_popularity missing after the rebuild';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.profiles'::regclass and tgname = 'profiles_update_trg') then
    raise exception 'MESITA-4515: profiles lost its update trigger';
  end if;
end $$;

create or replace function public.discovery_foursquare_boost(
  p_raw double precision,
  p_factor double precision,
  p_exponent double precision
) returns double precision
language sql
immutable
as $$
  select case
    when coalesce(p_factor, 0) <= 0 then 1::double precision
    when p_raw is null or p_raw <= 0 then 1::double precision
    when coalesce(p_exponent, 0) <= 0 then 1::double precision
    else 1 + p_factor * power(
      least(1::double precision, greatest(0::double precision, p_raw)),
      p_exponent
    )
  end
$$;

revoke all on function public.discovery_foursquare_boost(double precision, double precision, double precision) from public, anon, authenticated;
grant execute on function public.discovery_foursquare_boost(double precision, double precision, double precision) to service_role;

comment on function public.discovery_foursquare_boost(double precision, double precision, double precision) is
  'MESITA-4515: 1 + factor × raw^exponent. Missing, zero, or factor 0 is exactly 1.';

-- Same arguments as 20261121240000. The cap argument is ignored.
create or replace function public.discovery_growth_weight(
  p_elapsed double precision,
  p_cap double precision,
  p_kind text
) returns double precision
language sql
immutable
as $$
  select case
    when p_kind not in ('flat', 'grow') or p_elapsed is null or p_elapsed < 7 then 0::double precision
    else 0.20::double precision + 0.60::double precision * least(p_elapsed / 30.0, 1.0)
  end
$$;

comment on function public.discovery_growth_weight(double precision, double precision, text) is
  'MESITA-4515: 0 until 7 days. Then 0.20 + 0.60 × min(elapsed / 30, 1). The cap argument is ignored.';

drop function public.catalog_rank_lanes(
  double precision, double precision,
  double precision, double precision, double precision, double precision, double precision,
  double precision, double precision, double precision, double precision, double precision,
  double precision, double precision,
  text[], text[],
  boolean,
  double precision,
  double precision
);

create function public.catalog_rank_lanes(
  p_lat double precision,
  p_lng double precision,
  p_organic_half_km double precision,
  p_organic_distance_exp double precision,
  p_organic_stars_exp double precision,
  p_organic_google_exp double precision,
  p_organic_premier_exp double precision,
  p_ad_half_km double precision,
  p_ad_distance_exp double precision,
  p_ad_stars_exp double precision,
  p_ad_google_exp double precision,
  p_ad_premier_exp double precision,
  p_premier_1 double precision,
  p_premier_2 double precision,
  p_families text[],
  p_known_families text[],
  p_require_active boolean,
  p_repeat double precision default 1,
  p_ad_floor double precision default 0.2,
  p_organic_fsq_factor double precision default 1,
  p_organic_fsq_exp double precision default 20,
  p_ad_fsq_factor double precision default 1,
  p_ad_fsq_exp double precision default 20
)
 returns jsonb
 language sql
 stable
 security invoker
 set search_path to 'public'
as $function$
  with growth as (
    select * from public.discovery_growth_bases(coalesce(p_require_active, false), p_known_families)
  ),
  cap as (
    select coalesce((
      select case
               when (c.discovery_config #>> '{params,mix,growthWeightCap}') ~ '^[0-9]+(\.[0-9]+)?$'
                 then least(0.8::double precision, greatest(0::double precision,
                        (c.discovery_config #>> '{params,mix,growthWeightCap}')::double precision))
               else 0.5::double precision
             end
        from public.app_config c
       where c.id = 1
    ), 0.5::double precision) as cap
  ),
  gated as (
    select p.id,
           p.lat::double precision as lat,
           p.lng::double precision as lng,
           p.google_stars_overall::double precision as stars,
           p.google_review_count::double precision as reviews,
           coalesce(p.boost_tier, 0) as tier,
           coalesce(p.family_keys, '{}'::text[]) as family_keys,
           p.foursquare_popularity::double precision as fsq
      from public.profiles p
     where p.state = 'active'
       and p.content_state = 'ready'
       and (not coalesce(p_require_active, false) or p.business_state = 'OPERATIONAL')
       and (coalesce(cardinality(p_families), 0) = 0 or p.family_keys && p_families)
  ),
  measured as (
    select g.*,
           case
             when p_lat is null or p_lng is null or g.lat is null or g.lng is null then null
             else 2 * 6371 * asin(least(1, sqrt(
               power(sin(radians(g.lat - p_lat) / 2), 2) +
               cos(radians(p_lat)) * cos(radians(g.lat)) *
               power(sin(radians(g.lng - p_lng) / 2), 2)
             )))
           end as km,
           (case g.tier when 2 then p_premier_2 when 1 then p_premier_1 else 1 end)::double precision as factor
      from gated g
     where g.family_keys && coalesce(p_known_families, '{}'::text[])
  ),
  parts as (
    select m.*,
           (case
              when p_lat is null or p_lng is null then 1
              when m.km is null then 0
              when m.km <= 0 then 1
              when p_organic_half_km is null or p_organic_half_km <= 0 then 0
              else 1 / (1 + power(m.km / p_organic_half_km, p_organic_distance_exp))
            end) as prox_organic,
           (case
              when p_lat is null or p_lng is null then 1
              when m.km is null then 0
              when m.km <= 0 then 1
              when p_ad_half_km is null or p_ad_half_km <= 0 then 0
              else 1 / (1 + power(m.km / p_ad_half_km, p_ad_distance_exp))
            end) as prox_ad,
           public.discovery_growth_weight(gr.elapsed_days, (select cap from cap), gr.kind) as w,
           case
             when m.stars is null or m.reviews is null or m.reviews <= 0 then 0::double precision
             else greatest(0::double precision, m.stars) * m.reviews
           end as established,
           coalesce(gr.growth_base, 0::double precision) as growth_base
      from measured m
      left join growth gr on gr.place_id = m.id
  ),
  scored as (
    select p.*,
           (case
              when p.established <= 0 then 0::double precision
              else power((1 - p.w) * p.established + p.w * p.growth_base, p_organic_google_exp)
                   * public.discovery_foursquare_boost(p.fsq, p_organic_fsq_factor, p_organic_fsq_exp)
            end) as pop_organic,
           (case
              when p.established <= 0 then 0::double precision
              else power((1 - p.w) * p.established + p.w * p.growth_base, p_ad_google_exp)
                   * public.discovery_foursquare_boost(p.fsq, p_ad_fsq_factor, p_ad_fsq_exp)
            end) as pop_ad
      from parts p
  ),
  organic as (
    select x.id,
           x.km,
           x.prox_organic * x.pop_organic * power(x.factor, coalesce(p_organic_premier_exp, 0)) as final
      from scored x
  ),
  inorganic as (
    select x.id,
           x.km,
           x.prox_ad * x.factor >= coalesce(p_ad_floor, 0) as admitted,
           x.prox_ad * x.pop_ad * power(x.factor, coalesce(p_ad_premier_exp, 0)) as final
      from scored x
     where x.tier in (1, 2)
  )
  select jsonb_build_object(
    'read', (select count(*) from gated),
    'ids', coalesce(
      (select jsonb_agg(o.id order by o.final desc nulls last, o.km asc nulls last, o.id::text collate "C" asc)
         from organic o),
      '[]'::jsonb),
    'premier', coalesce(
      (select jsonb_agg(i.id order by i.final desc nulls last, i.km asc nulls last, i.id::text collate "C" asc)
         from inorganic i where i.admitted),
      '[]'::jsonb),
    'below_floor', (select count(*) from inorganic i where not i.admitted),
    'inorganic_total', (select count(*) from inorganic)
  );
$function$;

revoke all on function public.catalog_rank_lanes(double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, text[], text[], boolean, double precision, double precision, double precision, double precision, double precision, double precision) from public, anon, authenticated;
grant execute on function public.catalog_rank_lanes(double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, text[], text[], boolean, double precision, double precision, double precision, double precision, double precision, double precision) to service_role;

comment on function public.catalog_rank_lanes(double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, text[], text[], boolean, double precision, double precision, double precision, double precision, double precision, double precision) is
  'MESITA-4515: Premier boost × (Google popularity × Foursquare boost) × Proximity. Google popularity is ((1 − w) × stars × reviews + w × growthBase) ^ GoogleExp. w is 0 under 7 days, then 0.20 + 0.60 × min(days / 30, 1), capped at 0.80. A null Foursquare score is a 1× boost. Stars exponents and p_repeat are ignored.';
