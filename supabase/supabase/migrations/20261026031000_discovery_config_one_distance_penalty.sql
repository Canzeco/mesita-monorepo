-- MESITA-2776 — one Distance penalty for the Map, Home and Chat.
--
-- `params.proximity.radiusDivisor` is now the only penalty every Area caller
-- ranks with; Home's own `params.proximity.catalogRadiusDivisor`
-- (MESITA-2727) is retired from the code and removed from the stored row so
-- nothing reads a stale second number. The Map's value stays as saved
-- (1 on 2026-10-26); Home and Chat move from 0.1 to it. Other knobs stay.
-- Idempotent: removing an absent key is a no-op. No SQL function reads
-- discovery_config.

update public.app_config
   set discovery_config = discovery_config #- '{params,proximity,catalogRadiusDivisor}'
 where id = 1
   and discovery_config #> '{params,proximity,catalogRadiusDivisor}' is not null;

do $postflight$
begin
  if exists (
    select 1
      from public.app_config
     where id = 1
       and discovery_config #> '{params,proximity,catalogRadiusDivisor}' is not null
  ) then
    raise exception 'discovery_config still carries catalogRadiusDivisor';
  end if;
end $postflight$;
