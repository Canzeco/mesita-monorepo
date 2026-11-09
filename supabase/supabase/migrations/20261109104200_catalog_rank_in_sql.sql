-- MESITA-3059: the Catalog ranks in SQL, with no 10,000-row scan cap.
--
-- Until now consumer-web-list-catalog walked every gated row's scoring
-- columns through PostgREST, 1,000 rows a page, at most 10 pages, and ranked
-- them in TypeScript. Past 10,000 rows the cut fell by id again
-- (`catalog_scan_capped`). This function ranks every gated place in one
-- statement and returns the ordered ids as one jsonb value, so PostgREST's
-- max_rows never cuts it and there is no pass-1 walk.
--
-- The score is the one area-score.ts states (Docs › Discovery):
--   final = Proximity × Popularity × the Premier factor
--   Proximity  = 1 ÷ (1 + (d ÷ D)^e); 1 at d ≤ 0; 0 with no coordinates;
--                absent (×1) with no anchor
--   Popularity = (1 + max(0, reviews) × max(0, stars))^root; 0 with no
--                stars or no review count
--   Premier    = the tier's factor (boost_tier 1 / 2), 1 otherwise
-- Every number the operator owns (D, e, root) and every constant the engine
-- owns (the tier factors, the family slugs) is an ARGUMENT, read by the EF
-- from the same TypeScript the rest of Discovery reads: SQL owns the
-- arithmetic only. Order: final desc, distance asc (no coordinates last),
-- id asc. With p_nearest: distance asc, then id (the Reward tab,
-- MESITA-3214).
--
-- Gates, the same ones mesitaPoolQuery pushes down: state active, content
-- ready, business_state OPERATIONAL when General's requireActive is on, and
-- the Family gate (a place needs a known family; with families asked, one of
-- them).
--
-- Read-only. Service role only: consumer-web-list-catalog is its one caller.

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
  p_nearest boolean default false
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
  scored as (
    select m.id,
           m.km,
           (case
              when p_lat is null or p_lng is null then 1
              when m.km is null then 0
              when m.km <= 0 then 1
              when p_half_km is null or p_half_km <= 0 then 0
              else 1 / (1 + power(m.km / p_half_km, p_exponent))
            end)
           * (case
                when m.stars is null or m.reviews is null then 0
                else power(1 + greatest(0, m.reviews) * greatest(0, m.stars), p_root)
              end)
           * (case m.tier when 2 then p_premier_2 when 1 then p_premier_1 else 1 end)
           as final
      from measured m
  )
  select jsonb_build_object(
    'read', (select count(*) from gated),
    'ids', coalesce(
      (select jsonb_agg(s.id order by
                case when p_nearest then null else s.final end desc nulls last,
                s.km asc nulls last,
                s.id::text collate "C" asc)
         from scored s),
      '[]'::jsonb)
  );
$function$;

comment on function public.catalog_rank(double precision, double precision, double precision, double precision, double precision, double precision, double precision, text[], text[], boolean, boolean) is
  'MESITA-3059: every gated Catalog place ranked by Proximity × Popularity × Premier (area-score.ts), ids best first, as jsonb {read, ids}. No row cap. Service role only (consumer-web-list-catalog).';

revoke all on function public.catalog_rank(double precision, double precision, double precision, double precision, double precision, double precision, double precision, text[], text[], boolean, boolean) from public, anon, authenticated;
grant execute on function public.catalog_rank(double precision, double precision, double precision, double precision, double precision, double precision, double precision, text[], text[], boolean, boolean) to service_role;

do $$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'catalog_rank') then
    raise exception 'catalog_rank is missing after apply';
  end if;
end $$;
