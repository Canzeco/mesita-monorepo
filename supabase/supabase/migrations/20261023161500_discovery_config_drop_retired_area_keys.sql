-- MESITA-2724: drop the Area keys retired by MESITA-2721 and MESITA-2722 from
-- the stored discovery_config.
--
--   map.googleMinReviews   the Google reviews minimum (MESITA-2721)
--   map.proximityWeight    Proximity's exponent a (MESITA-2722)
--   map.popularityWeight   Popularity's exponent b (MESITA-2722)
--
-- The live row is already clean (an admin Save rebuilt it), but replaying the
-- migrations still writes map.popularityWeight (20261023020000), so the
-- schema invariant that names these keys would fail on a fresh database.
-- Idempotent: `#-` on a missing path is a no-op.

update public.app_config
   set discovery_config = discovery_config
     #- '{map,googleMinReviews}'
     #- '{map,proximityWeight}'
     #- '{map,popularityWeight}'
 where id = 1;

do $$
begin
  if exists (
    select 1 from public.app_config
     where id = 1
       and coalesce(discovery_config -> 'map', '{}'::jsonb)
           ?| array['googleMinReviews', 'proximityWeight', 'popularityWeight']
  ) then
    raise exception 'MESITA-2724: a retired map key survived the strip';
  end if;
end $$;
