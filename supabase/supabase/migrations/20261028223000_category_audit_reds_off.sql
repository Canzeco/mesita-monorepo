-- MESITA-2962: the category audit. Pato, 2026-10-28: "a beaty salon must not
-- be allowed in mesita. please list all the categoires that might not be
-- allowed in mesita" → on the audit (green · yellow · red · black): "Yes, ship
-- it".
--
-- 1. The 31 reds go off: a service used alone, a fitness place, a shop, or a
--    public place nobody runs. 247 enabled → 216. The code map moved them to
--    no family in the same PR (catalog-families.ts NO_FAMILY_TYPES), so
--    Search, Map and Create refuse them too.
-- 2. Every place whose main Google category is off is archived — the admin
--    Delete's own soft delete (places.state = 'archived', the deletion law:
--    never a hard delete). Today that is one place: "Hello Salon"
--    (beauty_salon), minted by a guest's open because the Map gate counted
--    Undefined as a family. Create now also reads this switch.

update public.catalog_membership
   set enabled = false
 where enabled
   and slug in (
     'massage', 'yoga_studio', 'swimming_pool', 'sports_complex',
     'sports_activity_location', 'skateboard_park',
     'candy_store', 'tea_store', 'health_food_store', 'shopping_mall', 'internet_cafe',
     'park', 'city_park', 'state_park', 'national_park', 'garden', 'plaza',
     'fountain', 'sculpture', 'monument', 'historical_landmark', 'historical_place',
     'cultural_landmark', 'scenic_spot', 'hiking_area', 'mountain_peak', 'lake',
     'beach', 'marina', 'picnic_ground', 'playground'
   );

update public.places p
   set state = 'archived'
  from public.place_profiles pp
 where pp.id = p.id
   and p.state is distinct from 'archived'
   and exists (
     select 1 from public.catalog_membership c
      where c.slug = pp.category and not c.enabled
   );

-- Postflight.
do $$
declare
  n int;
begin
  select count(*) into n from public.catalog_membership
   where not enabled
     and slug in (
       'massage', 'yoga_studio', 'swimming_pool', 'sports_complex',
       'sports_activity_location', 'skateboard_park',
       'candy_store', 'tea_store', 'health_food_store', 'shopping_mall', 'internet_cafe',
       'park', 'city_park', 'state_park', 'national_park', 'garden', 'plaza',
       'fountain', 'sculpture', 'monument', 'historical_landmark', 'historical_place',
       'cultural_landmark', 'scenic_spot', 'hiking_area', 'mountain_peak', 'lake',
       'beach', 'marina', 'picnic_ground', 'playground'
     );
  if n <> 31 then
    raise exception 'catalog_membership has % of the 31 audit reds off', n;
  end if;
  select count(*) into n
    from public.places p
    join public.place_profiles pp on pp.id = p.id
    join public.catalog_membership c on c.slug = pp.category
   where not c.enabled
     and p.state is distinct from 'archived';
  if n <> 0 then
    raise exception '% places still show with a main Google category that is off', n;
  end if;
end;
$$;
