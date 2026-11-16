-- MESITA-4153: Home's Catalog finds the best places, and more kinds of them.
--
-- Pato, 2026-11-16: "in catalog I always see the same places … other types
-- of places, even if those are a bit far away … finding the best places".
-- Live from the Tec, 17 of the top 20 sat within 1.5 km and 7 were
-- taquerías; Ryoshi (13.5k reviews, 4.9★, 4.4 km) was #23.
--
-- catalog_rank gains two arguments, both read by the EF from
-- _shared/discovery-config.ts (SQL owns the arithmetic only):
--   p_stars_power k  Popularity × (stars ÷ 5)^k (`params.popularity.starsPower`).
--                    0 = the old score.
--   p_repeat r       each place's KIND is its rarest known family in the
--                    ranked set (ties by slug); the n-th place of a kind
--                    scores × r^(n − 1) (`params.variety.repeat`). 1 = no
--                    penalty. Not applied with p_nearest.
-- Both default to "off", so the EF already deployed (which sends neither)
-- keeps ranking exactly as before until it redeploys. The shuffle after the
-- sort (`params.shuffle.temperature`) is the EF's, not SQL's.
--
-- The live half distance moves 1 → 3 km (Monterrey is a car city; Docs ›
-- Discovery). UNDO: set it back to 1:
--   update public.app_config set discovery_config =
--     jsonb_set(discovery_config, '{params,proximity,halfKm}', '1') where id = 1;

drop function if exists public.catalog_rank(double precision, double precision, double precision, double precision, double precision, double precision, double precision, text[], text[], boolean, boolean);

create or replace function public.catalog_rank(
  p_lat double precision,
  p_lng double precision,
  p_half_km double precision,
  p_exponent double precision,
  p_root double precision,
  p_premier_1 double precision,
  p_premier_2 double precision,
  p_families text[],
  p_known_families text[],
  p_require_active boolean,
  p_nearest boolean default false,
  p_stars_power double precision default 0,
  p_repeat double precision default 1
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
           end as km
      from gated g
     where g.family_keys && coalesce(p_known_families, '{}'::text[])
  ),
  -- How many ranked places hold each known family: the rarest one names a
  -- place's kind (tacos before mexican, both before dinner or family).
  family_counts as (
    select f as family, count(*) as n
      from measured m, unnest(m.family_keys) f
     where f = any(coalesce(p_known_families, '{}'::text[]))
     group by f
  ),
  kinded as (
    select m.*,
           (select fc.family
              from unnest(m.family_keys) f
              join family_counts fc on fc.family = f
             order by fc.n asc, fc.family collate "C" asc
             limit 1) as kind
      from measured m
  ),
  scored as (
    select k.id,
           k.km,
           k.kind,
           (case
              when p_lat is null or p_lng is null then 1
              when k.km is null then 0
              when k.km <= 0 then 1
              when p_half_km is null or p_half_km <= 0 then 0
              else 1 / (1 + power(k.km / p_half_km, p_exponent))
            end)
           * (case
                when k.stars is null or k.reviews is null then 0
                else power(1 + greatest(0, k.reviews) * greatest(0, k.stars), p_root)
                     * (case
                          when coalesce(p_stars_power, 0) <= 0 then 1
                          else power(greatest(0, k.stars) / 5, p_stars_power)
                        end)
              end)
           * (case k.tier when 2 then p_premier_2 when 1 then p_premier_1 else 1 end)
           as base
      from kinded k
  ),
  varied as (
    select s.*,
           s.base * (case
                       when p_nearest or p_repeat is null or p_repeat >= 1 or p_repeat <= 0 then 1
                       else power(p_repeat, (row_number() over (
                              partition by s.kind
                              order by s.base desc, s.km asc nulls last, s.id::text collate "C"
                            ) - 1)::double precision)
                     end) as final
      from scored s
  )
  select jsonb_build_object(
    'read', (select count(*) from gated),
    'ids', coalesce(
      (select jsonb_agg(v.id order by
                case when p_nearest then null else v.final end desc nulls last,
                v.km asc nulls last,
                v.id::text collate "C" asc)
         from varied v),
      '[]'::jsonb)
  );
$function$;

comment on function public.catalog_rank(double precision, double precision, double precision, double precision, double precision, double precision, double precision, text[], text[], boolean, boolean, double precision, double precision) is
  'MESITA-3059, MESITA-4153: every gated Catalog place ranked by Proximity × Popularity × (stars ÷ 5)^k × Premier, the n-th of a kind × repeat^(n − 1), ids best first, as jsonb {read, ids}. No row cap. Service role only (consumer-web-list-catalog).';

revoke all on function public.catalog_rank(double precision, double precision, double precision, double precision, double precision, double precision, double precision, text[], text[], boolean, boolean, double precision, double precision) from public, anon, authenticated;
grant execute on function public.catalog_rank(double precision, double precision, double precision, double precision, double precision, double precision, double precision, text[], text[], boolean, boolean, double precision, double precision) to service_role;

-- The live half distance: 1 → 3 km.
update public.app_config c
   set discovery_config = jsonb_set(
         jsonb_set(
           jsonb_set(coalesce(c.discovery_config, '{}'::jsonb), '{params}',
                     coalesce(c.discovery_config -> 'params', '{}'::jsonb), true),
           '{params,proximity}',
           coalesce(c.discovery_config #> '{params,proximity}', '{}'::jsonb), true),
         '{params,proximity,halfKm}', '3'::jsonb, true);

do $$
begin
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'catalog_rank') <> 1 then
    raise exception 'catalog_rank: expected exactly one signature after apply';
  end if;
end $$;
