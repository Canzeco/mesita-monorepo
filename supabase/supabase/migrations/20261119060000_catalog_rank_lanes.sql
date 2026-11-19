-- MESITA-4454: Discovery ranking v2 — one formula, two lanes, three modes.
--
-- Home asks one of three questions (Nearby · Popular · Family) and each one
-- ranks two lanes with its own recipe row (`params.recipes`, seeded below):
--
--   Score     = Proximity × (stars ^ StarsExp × reviews) ^ GoogleExp
--               × premierFactor ^ PremierExp
--   Proximity = 1 ÷ (1 + (km ÷ HalfDistance) ^ DistanceExp); no point = 1
--   premierFactor = 1 · 2 · 5 (no plan · 2X · 5X, `places.boost_tier`)
--
-- A place with 0 reviews or no stars scores 0 and ranks last.
--
--   Organic    every gated place (catalog_rank's gates), the n-th of a kind
--              × repeat^(n − 1) (Nearby sends 1 = off). Order → `ids`.
--   Inorganic  Premier places only (boost_tier 1 or 2), admitted when
--              Proximity (this lane's row) × premierFactor ≥ the ad floor.
--              Order → `premier`; the rest are counted in `below_floor`;
--              `inorganic_total` counts every gated Premier place.
--
-- The EF (consumer-web-list-catalog) merges the two lanes and shuffles the
-- first page in TypeScript (_shared/area-pipeline.ts); SQL owns the
-- arithmetic only, every number comes from _shared/discovery-config.ts.
--
-- catalog_rank_lanes is a NEW function beside catalog_rank, which stays
-- byte-identical (the deployed EF keeps calling it until it redeploys, and
-- `nearest`, the Reward tab, keeps reading it). A follow-up migration drops
-- catalog_rank once the lanes are live and verified (F8).
--
-- The seed adds `params.recipes` and `params.mix` to app_config's
-- discovery_config ONLY where absent: every key that exists before this runs
-- keeps its exact value, and a second run changes nothing (E3, DX-n).

create or replace function public.catalog_rank_lanes(
  p_lat double precision,
  p_lng double precision,
  -- The Organic row.
  p_org_half_km double precision,
  p_org_distance_exp double precision,
  p_org_stars_exp double precision,
  p_org_google_exp double precision,
  p_org_premier_exp double precision,
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
  -- Organic only; 1 = no penalty.
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
  family_counts as (
    select f as family, count(*) as n
      from measured m, unnest(m.family_keys) f
     where f = any(coalesce(p_known_families, '{}'::text[]))
     group by f
  ),
  parts as (
    select m.*,
           (select fc.family
              from unnest(m.family_keys) f
              join family_counts fc on fc.family = f
             order by fc.n asc, fc.family collate "C" asc
             limit 1) as kind,
           -- Proximity, once per row.
           (case
              when p_lat is null or p_lng is null then 1
              when m.km is null then 0
              when m.km <= 0 then 1
              when p_org_half_km is null or p_org_half_km <= 0 then 0
              else 1 / (1 + power(m.km / p_org_half_km, p_org_distance_exp))
            end) as prox_org,
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
              else power(power(greatest(0, m.stars), p_org_stars_exp) * m.reviews, p_org_google_exp)
            end) as pop_org,
           (case
              when m.stars is null or m.reviews is null or m.reviews <= 0 then 0
              else power(power(greatest(0, m.stars), p_ad_stars_exp) * m.reviews, p_ad_google_exp)
            end) as pop_ad
      from measured m
  ),
  organic as (
    select x.id,
           x.km,
           x.prox_org * x.pop_org * power(x.factor, coalesce(p_org_premier_exp, 0))
             * (case
                  when p_repeat is null or p_repeat >= 1 or p_repeat <= 0 then 1
                  else power(p_repeat, (row_number() over (
                         partition by x.kind
                         order by x.prox_org * x.pop_org * power(x.factor, coalesce(p_org_premier_exp, 0)) desc,
                                  x.km asc nulls last,
                                  x.id::text collate "C"
                       ) - 1)::double precision)
                end) as final
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
  'MESITA-4454: every gated Catalog place ranked in two lanes by Proximity × (stars^StarsExp × reviews)^GoogleExp × premierFactor^PremierExp: Organic (every place, the n-th of a kind × repeat^(n − 1)) and Inorganic (Premier places whose Proximity × premierFactor reaches the ad floor). jsonb {read, ids, premier, below_floor, inorganic_total}. No row cap. Service role only (consumer-web-list-catalog).';

revoke all on function public.catalog_rank_lanes(double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, text[], text[], boolean, double precision, double precision) from public, anon, authenticated;
grant execute on function public.catalog_rank_lanes(double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, text[], text[], boolean, double precision, double precision) to service_role;

-- ── The seed: absent keys only ─────────────────────────────────────────────
--
-- jsonb_fill_absent(target, defaults): every key of `defaults` that `target`
-- lacks is added; where both hold an object it recurses; a key `target`
-- already holds keeps its value, whatever it is. Pure, so a second run is a
-- no-op by construction (pinned by catalog_rank_lanes.test.sql).

create or replace function public.jsonb_fill_absent(p_target jsonb, p_defaults jsonb)
 returns jsonb
 language plpgsql
 immutable
 set search_path to 'public'
as $function$
declare
  k text;
  v jsonb;
  result jsonb;
begin
  if p_target is null then
    return p_defaults;
  end if;
  if jsonb_typeof(p_target) <> 'object' or jsonb_typeof(p_defaults) is distinct from 'object' then
    return p_target;
  end if;
  result := p_target;
  for k, v in select e.key, e.value from jsonb_each(p_defaults) e loop
    if not (result ? k) then
      result := result || jsonb_build_object(k, v);
    elsif jsonb_typeof(result -> k) = 'object' and jsonb_typeof(v) = 'object' then
      result := jsonb_set(result, array[k], public.jsonb_fill_absent(result -> k, v));
    end if;
  end loop;
  return result;
end;
$function$;

comment on function public.jsonb_fill_absent(jsonb, jsonb) is
  'MESITA-4454: deep-merge that only ADDS keys `target` lacks; every existing key keeps its value. Used by config seeds so a re-run changes nothing.';

revoke all on function public.jsonb_fill_absent(jsonb, jsonb) from public, anon, authenticated;

-- The recipe table (Pato, 2026-11-19) and the mix. Map rows have no
-- Proximity, so their distance numbers are null. Organic rows' Premier
-- exponent is 0: a plan never moves the organic list.
update public.app_config c
   set discovery_config = public.jsonb_fill_absent(
         coalesce(c.discovery_config, '{}'::jsonb),
         '{
           "params": {
             "recipes": {
               "catalogNearbyOrganic":    {"halfKm": 0.1,  "distanceExp": 4,    "starsExp": 2, "googleExp": 0.33, "premierExp": 0},
               "catalogNearbyInorganic":  {"halfKm": 0.5,  "distanceExp": 2,    "starsExp": 2, "googleExp": 0.17, "premierExp": 1},
               "catalogFamilyOrganic":    {"halfKm": 2,    "distanceExp": 2,    "starsExp": 2, "googleExp": 0.33, "premierExp": 0},
               "catalogFamilyInorganic":  {"halfKm": 2,    "distanceExp": 2,    "starsExp": 2, "googleExp": 0.17, "premierExp": 1},
               "catalogPopularOrganic":   {"halfKm": 10,   "distanceExp": 2,    "starsExp": 2, "googleExp": 0.33, "premierExp": 0},
               "catalogPopularInorganic": {"halfKm": 10,   "distanceExp": 2,    "starsExp": 2, "googleExp": 0.17, "premierExp": 1},
               "mapOrganic":              {"halfKm": null, "distanceExp": null, "starsExp": 2, "googleExp": 0.33, "premierExp": 0},
               "mapInorganic":            {"halfKm": null, "distanceExp": null, "starsExp": 2, "googleExp": 0.17, "premierExp": 1}
             },
             "mix": {
               "temperature": {"nearby": 0.33, "family": 0.5, "popular": 1},
               "adFloor": 0.2,
               "adEvery": 1
             }
           }
         }'::jsonb)
 where c.id = 1;

do $$
begin
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'catalog_rank') <> 1 then
    raise exception 'catalog_rank: expected exactly one signature (it stays until F8)';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'catalog_rank_lanes') <> 1 then
    raise exception 'catalog_rank_lanes: expected exactly one signature after apply';
  end if;
end $$;
