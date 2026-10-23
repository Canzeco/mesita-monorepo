-- MESITA-2729 — the tuned Area distance penalties.
--
-- Map (`params.proximity.radiusDivisor`) 0.5: on the Search screen a place at
-- the edge needs about 1.5× the popularity of a place on the cross to tie.
-- Catalog (`params.proximity.catalogRadiusDivisor`) 1.5: Home and Chat, so a
-- clearly better place a short ride away reaches the first tiles and a famous
-- place across the 15 km circle does not, unless it is Selected.
--
-- The live row was saved to these numbers on 2026-10-23 before this migration.
-- Idempotent: writing the same two numbers again. Other knobs stay. Code
-- defaults stay 2 / 2 for a missing blob. No SQL function reads discovery_config.

update public.app_config
   set discovery_config = jsonb_set(
         jsonb_set(
           discovery_config,
           '{params,proximity,radiusDivisor}',
           '0.5'::jsonb),
         '{params,proximity,catalogRadiusDivisor}',
         '1.5'::jsonb)
 where id = 1
   and discovery_config #> '{params,proximity}' is not null;

do $postflight$
begin
  if exists (
    select 1
      from public.app_config
     where id = 1
       and discovery_config #> '{params,proximity}' is not null
       and ((discovery_config #>> '{params,proximity,radiusDivisor}')::numeric <> 0.5
            or (discovery_config #>> '{params,proximity,catalogRadiusDivisor}')::numeric <> 1.5)
  ) then
    raise exception 'discovery_config distance penalties were not saved';
  end if;
end $postflight$;
