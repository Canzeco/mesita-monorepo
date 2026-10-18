-- MESITA-2382: a Google category can sit in no family. These types were on a
-- family they are not a trip for (a plaza is not Go out, a cafeteria is not
-- Breakfast), so picking that family returned places that did not look like
-- it. They move to no family (`undefined`), the same as the code twin
-- `_shared/catalog-families.ts`; `_shared/sourcing.test.ts` pins the pair.
-- None of them is a Mesita category, so `place_categories` is untouched.

update public.catalog_membership
set family_keys = array['undefined']::text[]
where slug in (
  'athletic_field',
  'barbecue_area',
  'beautician',
  'body_art_service',
  'cafeteria',
  'dog_park',
  'fishing_charter',
  'fishing_pier',
  'fishing_pond',
  'foot_care',
  'fountain',
  'makeup_artist',
  'marina',
  'meal_delivery',
  'off_roading_area',
  'picnic_ground',
  'plaza',
  'race_course',
  'sculpture',
  'skin_care_clinic',
  'tanning_studio',
  'visitor_center',
  'wildlife_refuge'
);
