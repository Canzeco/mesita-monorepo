-- MESITA-2398: `catalog.railCap` only bounded the retired legacy Feed rails.
-- Idempotent: #- on a missing path is a no-op.

update public.app_config
   set discovery_config = discovery_config #- '{catalog,railCap}'
 where id = 1;

do $$
begin
  if exists (
    select 1 from public.app_config
     where id = 1
       and coalesce(discovery_config -> 'catalog', '{}'::jsonb) ? 'railCap'
  ) then
    raise exception 'MESITA-2398: catalog.railCap survived the strip';
  end if;
end $$;
