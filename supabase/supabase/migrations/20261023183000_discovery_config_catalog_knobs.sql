-- MESITA-2727 — the Map and Home's catalog each get their own Distance
-- penalty and Places shown.
--
-- `params.proximity.radiusDivisor` and `map.placesShown` stay the stored keys
-- and become the Map's. This seeds Home's two new keys from them, so the
-- catalog keeps ranking exactly as it does today until the operator changes
-- it. Live values read on 2026-10-23: radiusDivisor 0.1, placesShown 30.
--
-- Idempotent: an already-written key is kept. No SQL function reads
-- discovery_config; both normalizers fall back to the Map's value anyway.

update public.app_config
   set discovery_config = jsonb_set(
         jsonb_set(
           discovery_config,
           '{params,proximity,catalogRadiusDivisor}',
           coalesce(
             discovery_config #> '{params,proximity,catalogRadiusDivisor}',
             discovery_config #> '{params,proximity,radiusDivisor}',
             '2'::jsonb),
           true),
         '{map,catalogPlacesShown}',
         coalesce(
           discovery_config #> '{map,catalogPlacesShown}',
           discovery_config #> '{map,placesShown}',
           '20'::jsonb),
         true)
 where id = 1
   and discovery_config #> '{params,proximity}' is not null
   and discovery_config -> 'map' is not null;

do $postflight$
begin
  if exists (
    select 1
      from public.app_config
     where id = 1
       and discovery_config #> '{params,proximity}' is not null
       and discovery_config -> 'map' is not null
       and (discovery_config #> '{params,proximity,catalogRadiusDivisor}' is null
            or discovery_config #> '{map,catalogPlacesShown}' is null)
  ) then
    raise exception 'discovery_config was not seeded with the catalog knobs';
  end if;
end $postflight$;
