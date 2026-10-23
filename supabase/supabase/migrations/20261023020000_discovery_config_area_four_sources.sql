-- MESITA-2703 — the Area pipeline's four sources.
--
-- Area is now (point, radius) → Google Popular · Google Closest · Mesita
-- Popular · Mesita Closest, each `map.<source>` 0 or 20, merged and sorted by
-- Proximity^a × Popularity^b. This writes the new keys and strips the ones
-- they replace; both normalizers already drop the old keys on the next Save.
--
-- Live values read on 2026-10-22, kept here so a reversal can restore them:
--   map.googleFill          true
--   map.googlePlaces        20   (Home: 1 Nearby call per load)
--   map.mapGooglePlaces     20   (Map: 1 Nearby call per load)
--   map.mesitaPlaces        20
--   params.proximity        {"reachKm": 15}
--   params.selected         {"otherFactor": 0.3}
--
-- New: map.googlePopular / googleClosest / mesitaPopular / mesitaClosest
-- (20 each, so a load bills 2 Nearby calls; 0 if the stored googleFill was
-- false, so Google stays off) and map.popularityWeight 1. Idempotent: an
-- already-written key is kept. No SQL function reads discovery_config.

update public.app_config
   set discovery_config = jsonb_set(
         discovery_config,
         '{map}',
         (coalesce(discovery_config -> 'map', '{}'::jsonb)
            - 'googleFill' - 'googlePlaces' - 'mapGooglePlaces' - 'mesitaPlaces')
         || jsonb_build_object(
              'googlePopular', coalesce(
                discovery_config #> '{map,googlePopular}',
                case when discovery_config #>> '{map,googleFill}' = 'false'
                     then '0'::jsonb else '20'::jsonb end),
              'googleClosest', coalesce(
                discovery_config #> '{map,googleClosest}',
                case when discovery_config #>> '{map,googleFill}' = 'false'
                     then '0'::jsonb else '20'::jsonb end),
              'mesitaPopular', coalesce(discovery_config #> '{map,mesitaPopular}', '20'::jsonb),
              'mesitaClosest', coalesce(discovery_config #> '{map,mesitaClosest}', '20'::jsonb),
              'popularityWeight', coalesce(discovery_config #> '{map,popularityWeight}', '1'::jsonb)
            ),
         true)
       #- '{params,proximity}'
       #- '{params,selected}'
 where id = 1;

do $postflight$
begin
  if exists (
    select 1
      from public.app_config
     where id = 1
       and (discovery_config -> 'map' ?| array['googleFill', 'googlePlaces', 'mapGooglePlaces', 'mesitaPlaces']
            or discovery_config #> '{params,proximity}' is not null
            or discovery_config #> '{params,selected}' is not null
            or not (discovery_config -> 'map' ?& array['googlePopular', 'googleClosest',
                                                       'mesitaPopular', 'mesitaClosest',
                                                       'popularityWeight']))
  ) then
    raise exception 'discovery_config was not moved to the four Area sources';
  end if;
end $postflight$;
