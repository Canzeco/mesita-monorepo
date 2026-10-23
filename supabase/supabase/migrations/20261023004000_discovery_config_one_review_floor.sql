-- MESITA-2702 — one Google reviews floor.
--
--   general.minReviews   the Name pipeline's own floor (live 10). Retired:
--                        `map.googleMinReviews` (live 100) is the one floor,
--                        on Google rows only, on every pipeline. A Mesita row
--                        answers Active alone.
--
-- Both normalizers drop the key on the next Save; this strips the stored
-- copy now. No SQL function reads discovery_config.

update public.app_config
   set discovery_config = discovery_config #- '{general,minReviews}'
 where id = 1;

do $postflight$
begin
  if exists (
    select 1
      from public.app_config
     where id = 1
       and discovery_config #> '{general,minReviews}' is not null
  ) then
    raise exception 'discovery_config still holds general.minReviews';
  end if;
end $postflight$;
