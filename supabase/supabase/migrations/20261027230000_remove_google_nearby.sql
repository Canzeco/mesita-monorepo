-- MESITA-2872 — Google Nearby Search is gone (Pato, 2026-10-27: "We are only
-- going to have Mesita Nearby Search"). The Area pipeline (the Map and Home)
-- reads Mesita's places only, so:
--
-- 1. `public.nearby_google_attempts`, the per-IP / global Nearby ledger
--    (MESITA-1700, MESITA-2870), has no writer or reader left. Dropped.
-- 2. `map.googlePopular` / `map.googleClosest`, the two Google source
--    switches (MESITA-2703), are stripped; both normalizers already drop them.
-- 3. `map.placesShown` / `map.catalogPlacesShown` max is now 40 (2 sources ×
--    20); a stored value above it is lowered to 40, as the normalizers do.
--
-- Live values read on 2026-10-27, kept here so a reversal can restore them:
--   map.googlePopular 20 · map.googleClosest 20
--   map.placesShown 80 · map.catalogPlacesShown 80
--   nearby_google_attempts: 1573 rows (no history worth keeping)
-- No SQL function reads discovery_config or the ledger.

drop table if exists public.nearby_google_attempts;

update public.app_config
   set discovery_config = jsonb_set(
         discovery_config,
         '{map}',
         (coalesce(discovery_config -> 'map', '{}'::jsonb) - 'googlePopular' - 'googleClosest')
         || jsonb_strip_nulls(jsonb_build_object(
              'placesShown', case when (discovery_config #>> '{map,placesShown}')::numeric > 40
                                  then '40'::jsonb end,
              'catalogPlacesShown', case when (discovery_config #>> '{map,catalogPlacesShown}')::numeric > 40
                                         then '40'::jsonb end
            )),
         true)
 where id = 1;

do $postflight$
begin
  if to_regclass('public.nearby_google_attempts') is not null then
    raise exception 'nearby_google_attempts still exists';
  end if;
  if exists (
    select 1
      from public.app_config
     where id = 1
       and (discovery_config -> 'map' ?| array['googlePopular', 'googleClosest']
            or coalesce((discovery_config #>> '{map,placesShown}')::numeric, 0) > 40
            or coalesce((discovery_config #>> '{map,catalogPlacesShown}')::numeric, 0) > 40)
  ) then
    raise exception 'discovery_config still holds Google Nearby keys';
  end if;
end $postflight$;
