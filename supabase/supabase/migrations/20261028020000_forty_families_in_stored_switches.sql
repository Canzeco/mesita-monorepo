-- MESITA-2892: the forty families everywhere (Pato, 2026-10-27: "put the new
-- list of 40 items in all the mesita platform. delete all the old list from
-- everywhere").
--
-- MESITA-2888 moved the code, the catalog tables and Docs to forty families.
-- app_config.discovery_config still stored the fifty in the two Name switch
-- sets (name.fast.supers, name.deep.supers): sixteen dead keys, and none of
-- the six new rails. normalizeSuperParams drops them on the next admin Save,
-- but nothing had saved. Each set is rebuilt from place_families: a key that
-- survives keeps its stored value, a new rail starts off (DEFAULT_MAP_SUPERS).
-- map.supers was already empty and stays untouched.

do $$
declare
  path text[];
begin
  foreach path slice 1 in array array[array['name','fast','supers'], array['name','deep','supers']]
  loop
    update public.app_config c
       set discovery_config = jsonb_set(
             c.discovery_config,
             path,
             (select coalesce(jsonb_object_agg(f.slug,
                       coalesce(c.discovery_config #> (path || f.slug), 'false'::jsonb)
                     order by f.sort_order), '{}'::jsonb)
                from public.place_families f
               where f.slug <> 'undefined'))
     where c.discovery_config #> path is not null;
  end loop;
end;
$$;

do $$
declare
  stale int;
begin
  select count(*) into stale
    from public.app_config c,
         lateral (values (c.discovery_config #> '{name,fast,supers}'),
                         (c.discovery_config #> '{name,deep,supers}')) v(obj),
         lateral jsonb_object_keys(coalesce(v.obj, '{}'::jsonb)) k
   where k not in (select slug from public.place_families);
  if stale <> 0 then
    raise exception '% stored discovery switches still name a family that is gone', stale;
  end if;
end;
$$;
