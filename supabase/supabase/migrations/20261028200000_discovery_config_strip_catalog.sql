-- MESITA-2923: the `catalog` section held only the retired rails engine's
-- knobs (seedCount, generatedCount, placesPerRail, minSeedPlaces). No reader
-- is left: the engine is deleted and both normalizers drop the key on save.
-- Idempotent: `-` on a missing key is a no-op.

update public.app_config
   set discovery_config = discovery_config - 'catalog'
 where id = 1;

do $$
begin
  if exists (
    select 1 from public.app_config
     where id = 1
       and discovery_config ? 'catalog'
  ) then
    raise exception 'MESITA-2923: discovery_config.catalog survived the strip';
  end if;
end $$;
