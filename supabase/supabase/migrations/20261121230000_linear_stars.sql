-- Older deployed clients still supply the stars exponent arguments. Ignore them.
create or replace function public.catalog_rank_lanes(
  p_lat double precision,
  p_lng double precision,
  -- The Organic row.
  p_organic_half_km double precision,
  p_organic_distance_exp double precision,
  p_organic_stars_exp double precision,
  p_organic_google_exp double precision,
  p_organic_premier_exp double precision,
  -- The Inorganic row.
  p_ad_half_km double precision,
  p_ad_distance_exp double precision,
  p_ad_stars_exp double precision,
  p_ad_google_exp double precision,
  p_ad_premier_exp double precision,
  -- premierFactor for boost_tier 1 and 2 (PREMIER_FACTOR, 2 and 5).
  p_premier_1 double precision,
  p_premier_2 double precision,
  p_families text[],
  p_known_families text[],
  p_require_active boolean,
  -- IGNORED since MESITA-4463 (the repeat penalty is gone); the argument
  -- stays so the EF deployed before this migration keeps resolving, and
  -- MESITA-4457 drops it with catalog_rank.
  p_repeat double precision default 1,
  -- Inorganic only: Proximity × premierFactor must reach it.
  p_ad_floor double precision default 0.2
)
 returns jsonb
 language sql
 stable
 security invoker
 set search_path to 'public'
as $function$
  with gated as (
    select p.id,
           p.lat::double precision as lat,
           p.lng::double precision as lng,
           p.google_stars_overall::double precision as stars,
           p.google_review_count::double precision as reviews,
           coalesce(p.boost_tier, 0) as tier,
           coalesce(p.family_keys, '{}'::text[]) as family_keys
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
           -- Proximity, once per row.
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
           -- Popularity: 0 reviews or no stars scores 0.
           (case
              when m.stars is null or m.reviews is null or m.reviews <= 0 then 0
              else power(greatest(0, m.stars) * m.reviews, p_organic_google_exp)
            end) as pop_organic,
           (case
              when m.stars is null or m.reviews is null or m.reviews <= 0 then 0
              else power(greatest(0, m.stars) * m.reviews, p_ad_google_exp)
            end) as pop_ad
      from measured m
  ),
  organic as (
    select x.id,
           x.km,
           x.prox_organic * x.pop_organic * power(x.factor, coalesce(p_organic_premier_exp, 0)) as final
      from parts x
  ),
  inorganic as (
    select x.id,
           x.km,
           x.prox_ad * x.factor >= coalesce(p_ad_floor, 0) as admitted,
           x.prox_ad * x.pop_ad * power(x.factor, coalesce(p_ad_premier_exp, 0)) as final
      from parts x
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

comment on function public.catalog_rank_lanes(double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, text[], text[], boolean, double precision, double precision) is
  'MESITA-4454, MESITA-4463: every gated Catalog place ranked in two lanes by Proximity × (stars × reviews)^GoogleExp × premierFactor^PremierExp: Organic (every place; no repeat penalty since MESITA-4463, p_repeat is ignored) and Inorganic (Premier places whose Proximity × premierFactor reaches the ad floor). jsonb {read, ids, premier, below_floor, inorganic_total}. No row cap. Service role only (consumer-web-list-catalog).';

revoke all on function public.catalog_rank_lanes(double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, text[], text[], boolean, double precision, double precision) from public, anon, authenticated;
grant execute on function public.catalog_rank_lanes(double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, text[], text[], boolean, double precision, double precision) to service_role;

update public.app_config
set discovery_config = jsonb_set(discovery_config, '{params,recipes}', (
  select jsonb_object_agg(key, value - 'starsExp')
  from jsonb_each(discovery_config #> '{params,recipes}')
))
where jsonb_typeof(discovery_config #> '{params,recipes}') = 'object'
  and exists (select 1 from jsonb_each(discovery_config #> '{params,recipes}') where value ? 'starsExp');
