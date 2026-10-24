// Google Places (New) atmosphere booleans. The Details call already buys the
// Atmosphere SKU (editorialSummary, reviews). These fields ride that same
// mask. A true boolean becomes one google_tags slug. False and absent do not.
// Twin of packages/place-profile/src/lib/google-atmosphere.ts (labels).

export const GOOGLE_ATMOSPHERE_FIELDS: readonly {
  field: string;
  slug: string;
  label: string;
}[] = [
  { field: "takeout", slug: "takeout", label: "Takeout" },
  { field: "delivery", slug: "delivery", label: "Delivery" },
  { field: "dineIn", slug: "dine_in", label: "Dine-in" },
  { field: "curbsidePickup", slug: "curbside_pickup", label: "Curbside pickup" },
  { field: "reservable", slug: "reservable", label: "Reservations" },
  { field: "servesBreakfast", slug: "serves_breakfast", label: "Breakfast" },
  { field: "servesBrunch", slug: "serves_brunch", label: "Brunch" },
  { field: "servesLunch", slug: "serves_lunch", label: "Lunch" },
  { field: "servesDinner", slug: "serves_dinner", label: "Dinner" },
  { field: "servesDessert", slug: "serves_dessert", label: "Dessert" },
  { field: "servesCoffee", slug: "serves_coffee", label: "Coffee" },
  { field: "servesBeer", slug: "serves_beer", label: "Beer" },
  { field: "servesWine", slug: "serves_wine", label: "Wine" },
  { field: "servesCocktails", slug: "serves_cocktails", label: "Cocktails" },
  { field: "servesVegetarianFood", slug: "serves_vegetarian_food", label: "Vegetarian" },
  { field: "outdoorSeating", slug: "outdoor_seating", label: "Outdoor seating" },
  { field: "liveMusic", slug: "live_music", label: "Live music" },
  { field: "menuForChildren", slug: "menu_for_children", label: "Kids' menu" },
  { field: "goodForChildren", slug: "good_for_children", label: "Good for kids" },
  { field: "goodForGroups", slug: "good_for_groups", label: "Good for groups" },
  { field: "goodForWatchingSports", slug: "good_for_watching_sports", label: "Good for watching sports" },
  { field: "allowsDogs", slug: "allows_dogs", label: "Dogs allowed" },
  { field: "restroom", slug: "restroom", label: "Restroom" },
];

/** Stable slugs for the booleans Google set true, in catalog order. */
export function googleTagsFromAtmosphere(details: object): string[] {
  const row = details as Record<string, unknown>;
  const tags: string[] = [];
  for (const field of GOOGLE_ATMOSPHERE_FIELDS) {
    if (row[field.field] === true) tags.push(field.slug);
  }
  return tags;
}
