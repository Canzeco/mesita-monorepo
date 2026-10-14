-- Catalog Search (MESITA-2199). Name ships at exponent 0.
-- A family list has no name query, so a stored 1 was an armed exponent
-- nothing called. An operator who already moved Name off 1 keeps that number.
-- Proximity and Popularity stay at 1. Randomness stays at 0.

update public.app_config
   set discovery_config = jsonb_set(
         discovery_config,
         '{catalog}',
         coalesce(discovery_config -> 'catalog', '{}'::jsonb) || jsonb_build_object(
           'ranking',
           coalesce(discovery_config #> '{catalog,ranking}', '{}'::jsonb) || '{"name":0}'::jsonb
         ),
         true
       )
 where id = 1
   and (
     discovery_config #>> '{catalog,ranking,name}' is null
     or (discovery_config #>> '{catalog,ranking,name}')::numeric = 1
   );
