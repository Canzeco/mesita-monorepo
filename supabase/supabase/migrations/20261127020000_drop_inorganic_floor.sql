-- MESITA-5029: the Inorganic floor is gone (Pato, 2026-11-26: "i want to
-- remove that hyperparam … its just to complex"). Every Premier place in the
-- Inorganic lane is admitted; the lane's order (Proximity × Popularity ×
-- premierFactor ^ PremierExp) still puts the nearest paid places first.
--
-- p_ad_floor stays in the signature, ignored, like p_repeat: the Edge
-- Function that still sends it keeps working in the minutes between this
-- migration and its redeploy. 'below_floor' stays in the answer, always 0.
-- Body copied from 20261122010000_foursquare_popularity.sql (live md5
-- 6ab4ecc5… checked 2026-11-27); only `admitted` changed.

create or replace function public.catalog_rank_lanes(
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
           true as admitted, -- MESITA-5029: no Inorganic floor; p_ad_floor is ignored.
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

comment on function public.catalog_rank_lanes(double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, text[], text[], boolean, double precision, double precision, double precision, double precision, double precision, double precision) is
  'MESITA-4515, MESITA-5029: Premier boost × (Google popularity × Foursquare boost) × Proximity. Google popularity is ((1 − w) × stars × reviews + w × growthBase) ^ GoogleExp. w is 0 under 7 days, then 0.20 + 0.60 × min(days / 30, 1), capped at 0.80. A null Foursquare score is a 1× boost. Every Premier place is admitted to the Inorganic lane (no floor). Stars exponents, p_repeat and p_ad_floor are ignored.';

-- The saved key goes too: nothing reads params.mix.adFloor any more.
update public.app_config
   set discovery_config = discovery_config #- '{params,mix,adFloor}'
 where id = 1
   and discovery_config #> '{params,mix}' ? 'adFloor';
