-- MESITA-2431 — `params` keeps only what `normalizeSignalParams` reads.
--
-- The first Area calibration (MESITA-2327) stored `params.proximity.halfDistanceKm`
-- and `params.popularity.referenceRating` / `referenceReviews`. MESITA-2347
-- retired their reader and both normalizers drop them on the next Save, but
-- nobody has saved the Area box since, so the live row still carries them.
-- This strips them now: Proximity's new `reachKm` must not sit beside a dead
-- half distance an operator could mistake for it. A bag left empty goes, and
-- an empty `params` goes, so the code defaults apply. Live keys (`reachKm`,
-- `halfReviews`, `modes`) are kept as they are. No SQL function reads it.

with src as (
  select id,
         jsonb_strip_nulls(jsonb_build_object(
           'proximity', nullif((discovery_config #> '{params,proximity}') - 'halfDistanceKm', '{}'::jsonb),
           'popularity', nullif((discovery_config #> '{params,popularity}')
                                  - 'referenceRating' - 'referenceReviews', '{}'::jsonb),
           'modes', discovery_config #> '{params,modes}'
         )) as params
    from public.app_config
   where id = 1
)
update public.app_config c
   set discovery_config = case
         when src.params = '{}'::jsonb then c.discovery_config - 'params'
         else jsonb_set(c.discovery_config, '{params}', src.params)
       end
  from src
 where c.id = src.id;

do $postflight$
begin
  if exists (
    select 1
      from public.app_config
     where id = 1
       and (discovery_config #> '{params,proximity,halfDistanceKm}' is not null
         or discovery_config #> '{params,popularity,referenceRating}' is not null
         or discovery_config #> '{params,popularity,referenceReviews}' is not null)
  ) then
    raise exception 'a retired params key survived';
  end if;
end $postflight$;
