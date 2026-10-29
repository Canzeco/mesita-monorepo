-- MESITA-3086 — each Discovery box holds only its own knobs.
--
-- Pato, 2026-10-29: "CONSUMER PIPELINE does not have a radius, the radius
-- depends on the screen size"; Map Search = Popularity root · page size ·
-- reload; "Minimum popularity must go to the Name Search, not to the
-- catalog nor map".
--
--   map.popularityFloor  → name.popularityFloor  (copied; the Area hides
--                          nothing for Popularity any more, the Search bar
--                          only orders by it)
--   map.popularityRoot   new, seeded from params.popularity.root so the
--                          Map does not move on deploy
--   map.radiusKm         stripped (the code reads NO_SCREEN_RADIUS_KM = 15)
--
-- Idempotent: an existing name.popularityFloor or map.popularityRoot is
-- never overwritten. Missing values fall back to the code defaults
-- (2.7, 0.33). No SQL function reads these keys.
--
-- UNDO (if this is reverted): copy name.popularityFloor back to
-- map.popularityFloor, set map.radiusKm to 15, drop map.popularityRoot and
-- name.popularityFloor:
--   update public.app_config set discovery_config =
--     jsonb_set(jsonb_set(discovery_config, '{map,popularityFloor}',
--       coalesce(discovery_config #> '{name,popularityFloor}', '2.7')),
--       '{map,radiusKm}', '15') #- '{map,popularityRoot}' #- '{name,popularityFloor}'
--   where id = 1;

update public.app_config c
   set discovery_config = (
         jsonb_set(
           jsonb_set(
             jsonb_set(coalesce(c.discovery_config, '{}'::jsonb), '{name}',
                       coalesce(c.discovery_config -> 'name', '{}'::jsonb), true),
             '{name,popularityFloor}',
             coalesce(c.discovery_config #> '{name,popularityFloor}',
                      c.discovery_config #> '{map,popularityFloor}',
                      '2.7'::jsonb),
             true),
           '{map}',
           (coalesce(c.discovery_config -> 'map', '{}'::jsonb)
              - 'popularityFloor' - 'radiusKm')
             || jsonb_build_object('popularityRoot',
                  coalesce(c.discovery_config #> '{map,popularityRoot}',
                           c.discovery_config #> '{params,popularity,root}',
                           '0.33'::jsonb)),
           true)
       )
 where c.id = 1;

do $postflight$
begin
  if exists (
    select 1
      from public.app_config
     where id = 1
       and (discovery_config #> '{map,popularityFloor}' is not null
         or discovery_config #> '{map,radiusKm}' is not null
         or discovery_config #> '{name,popularityFloor}' is null
         or discovery_config #> '{map,popularityRoot}' is null)
  ) then
    raise exception 'MESITA-3086: discovery_config keys did not move';
  end if;
end
$postflight$;
