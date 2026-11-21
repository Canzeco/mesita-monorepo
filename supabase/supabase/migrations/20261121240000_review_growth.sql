-- MESITA-4514: one Google review snapshot per successful Fast Update, and
-- Popularity blends recent review growth into the established base.
-- Stars stay linear (20261121230000). GoogleExp is unchanged.
-- No backfill and no poll: a place that is not updated keeps the gap.

create table public.google_review_observations (
  place_id uuid not null references public.places (id) on delete cascade,
  google_place_id text not null,
  observed_at timestamptz not null,
  review_count integer not null,
  stars double precision,
  constraint google_review_observations_count_nonneg check (review_count >= 0),
  constraint google_review_observations_pk primary key (place_id, observed_at)
);

create index google_review_observations_lookup
  on public.google_review_observations (place_id, google_place_id, observed_at);

alter table public.google_review_observations enable row level security;
revoke all on table public.google_review_observations from public, anon, authenticated;
grant select, insert, update on table public.google_review_observations to service_role;

comment on table public.google_review_observations is
  'MESITA-4514: one row per successful Fast Update that stored a Google review count. Retries of the same observed_at do not add a row. Gaps are real: nothing polls Google.';

-- The weight schedule. 0 before 7 days, 0.20 at 7 days, the cap at 30 days
-- and after. Launch cap is 0.50. A stored cap of 0.80 is the experiment.
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
    else
      case
        when p_elapsed >= 30 then least(0.8::double precision, greatest(0::double precision, coalesce(p_cap, 0.5)))
        else
          least(0.20::double precision, least(0.8::double precision, greatest(0::double precision, coalesce(p_cap, 0.5))))
          + (p_elapsed - 7) / 23.0 * (
            least(0.8::double precision, greatest(0::double precision, coalesce(p_cap, 0.5)))
            - least(0.20::double precision, least(0.8::double precision, greatest(0::double precision, coalesce(p_cap, 0.5))))
          )
      end
  end
$$;

revoke all on function public.discovery_growth_weight(double precision, double precision, text) from public, anon, authenticated;
grant execute on function public.discovery_growth_weight(double precision, double precision, text) to service_role;

-- One row per gated place. kind:
--   missing   one snapshot or none
--   short     two snapshots less than 7 days apart
--   flat      watched, and reviews did not rise (growth_base 0)
--   grow      positive velocity, scaled onto the cohort's established bases
--   fallback  positive velocity, but fewer than 8 peers in the city
-- Cohort: lower(trim(city)) + the first known family. 8 positive-velocity
-- peers there, else the whole city if that has 8, else fallback.
create or replace function public.discovery_growth_bases(
  p_require_active boolean,
  p_known_families text[],
  p_now timestamptz default now()
) returns table (
  place_id uuid,
  elapsed_days double precision,
  growth_base double precision,
  kind text
)
language sql
stable
security invoker
set search_path to 'public'
as $$
  with gated as (
    select p.id,
           lower(btrim(coalesce(p.city, ''))) as market,
           (
             select f
               from unnest(coalesce(p.family_keys, '{}'::text[])) as f
              where f <> 'undefined'
                and f = any (coalesce(p_known_families, '{}'::text[]))
              limit 1
           ) as category,
           case
             when p.google_stars_overall is null
               or p.google_review_count is null
               or p.google_review_count <= 0 then 0::double precision
             else greatest(0::double precision, p.google_stars_overall::double precision)
                  * p.google_review_count::double precision
           end as established,
           nullif(btrim(p.google_place_id), '') as google_place_id
      from public.profiles p
     where p.state = 'active'
       and p.content_state = 'ready'
       and (not coalesce(p_require_active, false) or p.business_state = 'OPERATIONAL')
       and p.family_keys && coalesce(p_known_families, '{}'::text[])
  ),
  spans as (
    select g.id,
           count(*)::int as n,
           extract(epoch from (max(o.observed_at) - min(o.observed_at))) / 86400.0 as elapsed_days,
           (array_agg(o.review_count order by o.observed_at asc))[1] as earliest_count,
           (array_agg(o.review_count order by o.observed_at desc))[1] as latest_count
      from gated g
      join public.google_review_observations o
        on o.place_id = g.id
       and o.google_place_id = g.google_place_id
       and o.observed_at >= p_now - interval '90 days'
       and o.observed_at <= p_now
     where g.google_place_id is not null
     group by g.id
  ),
  vel as (
    select g.id, g.market, g.category, g.established, s.elapsed_days,
           case
             when s.n >= 2 and s.elapsed_days >= 7
               then (s.latest_count - s.earliest_count)::double precision / s.elapsed_days
             else null
           end as velocity,
           case
             when s.id is null or s.n < 2 then 'missing'
             when s.elapsed_days < 7 then 'short'
             else null
           end as early_kind
      from gated g
      left join spans s on s.id = g.id
  ),
  positive as (
    select * from vel where velocity > 0
  ),
  family_counts as (
    select market, category, count(*)::int as n
      from positive
     group by market, category
  ),
  city_counts as (
    select market, count(*)::int as n
      from positive
     group by market
  ),
  chosen as (
    select v.*,
           case
             when v.early_kind is not null then v.early_kind
             when v.velocity <= 0 then 'flat'
             when coalesce(fc.n, 0) >= 8 then 'family'
             when coalesce(cc.n, 0) >= 8 then 'city'
             else 'fallback'
           end as cohort
      from vel v
      left join family_counts fc
        on fc.market = v.market and fc.category is not distinct from v.category
      left join city_counts cc on cc.market = v.market
  ),
  pct as (
    select c.*,
           case
             when c.cohort = 'flat' then 0::double precision
             when c.cohort in ('family', 'city') then (
               select case
                        when count(*) <= 1 then 0.5
                        else (
                          count(*) filter (where p.velocity < c.velocity)::double precision
                          + 0.5 * (count(*) filter (where p.velocity = c.velocity) - 1)
                        ) / (count(*) - 1)
                      end
                 from positive p
                where p.market = c.market
                  and (c.cohort = 'city' or p.category is not distinct from c.category)
             )
             else null
           end as pct
      from chosen c
  ),
  scaled as (
    select t.id, t.elapsed_days, t.cohort,
           case
             when t.cohort = 'flat' then 0::double precision
             when t.cohort in ('family', 'city') and t.pct is not null then (
               select percentile_cont(least(1.0, greatest(0.0, t.pct)))
                        within group (order by g.established)
                 from gated g
                where g.established > 0
                  and g.market = t.market
                  and (t.cohort = 'city' or g.category is not distinct from t.category)
             )
             else null
           end as growth_base
      from pct t
  )
  select s.id,
         s.elapsed_days,
         s.growth_base,
         case
           when s.cohort in ('family', 'city') and s.growth_base is null then 'fallback'
           when s.cohort in ('family', 'city') then 'grow'
           else s.cohort
         end
    from scaled s
$$;

revoke all on function public.discovery_growth_bases(boolean, text[], timestamptz) from public, anon, authenticated;
grant execute on function public.discovery_growth_bases(boolean, text[], timestamptz) to service_role;

comment on function public.discovery_growth_bases(boolean, text[], timestamptz) is
  'MESITA-4514: per gated place, the review-growth term. 90-day window on the current Google place id. 7-day minimum. Positive velocity becomes the matching quantile of establishedBase (reviews × stars) among city+family peers, or the city when the family has fewer than 8 growers. Flat history yields 0. Missing, short, or sparse history yields a null base.';

-- Same signature as 20261121230000. Stars exponents stay ignored.
-- Popularity is ((1 − w) × stars × reviews + w × growthBase) ^ GoogleExp.
-- w is 0 when there is no usable growth, so a cold place is exactly
-- (stars × reviews) ^ GoogleExp.
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
  p_ad_floor double precision default 0.2
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
           -- Cold start (w = 0) is exactly established ^ GoogleExp.
           (case
              when p.established <= 0 then 0::double precision
              else power((1 - p.w) * p.established + p.w * p.growth_base, p_organic_google_exp)
            end) as pop_organic,
           (case
              when p.established <= 0 then 0::double precision
              else power((1 - p.w) * p.established + p.w * p.growth_base, p_ad_google_exp)
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

comment on function public.catalog_rank_lanes(double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, text[], text[], boolean, double precision, double precision) is
  'MESITA-4454, MESITA-4463, MESITA-4514: Proximity × Popularity × premierFactor^PremierExp. Popularity is ((1 − w) × stars × reviews + w × growthBase) ^ GoogleExp. w is 0 with no usable 7-day review history, so a cold place is (stars × reviews) ^ GoogleExp. Stars exponents are ignored. p_repeat is ignored.';
