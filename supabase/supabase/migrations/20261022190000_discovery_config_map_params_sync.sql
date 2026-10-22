-- MESITA-2687 — Discovery's stored params match what the code reads.
--
--   params.modes         the weights table. No view read it after
--                        MESITA-2516; its stored Nearby row (1 · 0 · 0)
--                        ranked Chat by distance alone. Chat now ranks like
--                        the Map and Home: Proximity^a × Popularity × Selected.
--   map.supers           the Families switches; every guest family is on
--                        (`enabledMapSupers`), so the stored false values lied.
--   map.reloadMinKm/Sec  the Map's distance gate, read by nothing since
--                        MESITA-2451 (`reloadIdleSec` replaced it).
--   map.pinCount         the one cap MESITA-2347 split in two.
--   map.radiusKm         50 → 15 = Proximity's reach: between 15 and 50 km a
--                        Home place scored 0 and sorted by distance alone.
--   map.mapGooglePlaces  new: the Map's Google stop (20 · 40 · 60 = 1 · 2 · 3
--                        Nearby calls per load); 20 keeps today's one call.
--
-- Both normalizers drop the retired keys on the next Save; this strips the
-- stored copy now. No SQL function reads discovery_config.

update public.app_config
   set discovery_config = jsonb_set(
         discovery_config #- '{params,modes}',
         '{map}',
         (coalesce(discovery_config -> 'map', '{}'::jsonb)
            - 'supers' - 'reloadMinKm' - 'reloadMinSec' - 'pinCount')
           || jsonb_build_object(
                'radiusKm', 15,
                'mapGooglePlaces',
                coalesce(discovery_config #> '{map,mapGooglePlaces}', '20'::jsonb)
              )
       )
 where id = 1;

do $postflight$
begin
  if exists (
    select 1
      from public.app_config
     where id = 1
       and (
         discovery_config #> '{params,modes}' is not null
         or discovery_config -> 'map' ?| array['supers', 'reloadMinKm', 'reloadMinSec', 'pinCount']
         or (discovery_config #>> '{map,radiusKm}')::numeric <> 15
         or discovery_config #> '{map,mapGooglePlaces}' is null
       )
  ) then
    raise exception 'discovery_config did not sync';
  end if;
end $postflight$;
