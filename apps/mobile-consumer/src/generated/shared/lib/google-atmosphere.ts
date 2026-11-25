// Display twin of supabase/supabase/functions/_shared/google-atmosphere.ts.
// The slug is what place_profiles.google_tags stores. The label is the chip.

const LABELS: Record<string, string> = {
  takeout: "Takeout",
  delivery: "Delivery",
  dine_in: "Dine-in",
  curbside_pickup: "Curbside pickup",
  reservable: "Reservations",
  serves_breakfast: "Breakfast",
  serves_brunch: "Brunch",
  serves_lunch: "Lunch",
  serves_dinner: "Dinner",
  serves_dessert: "Dessert",
  serves_coffee: "Coffee",
  serves_beer: "Beer",
  serves_wine: "Wine",
  serves_cocktails: "Cocktails",
  serves_vegetarian_food: "Vegetarian",
  outdoor_seating: "Outdoor seating",
  live_music: "Live music",
  menu_for_children: "Kids' menu",
  good_for_children: "Good for kids",
  good_for_groups: "Good for groups",
  good_for_watching_sports: "Good for watching sports",
  allows_dogs: "Dogs allowed",
  restroom: "Restroom",
};

export function googleTagLabel(slug: string): string {
  const known = LABELS[slug];
  if (known) return known;
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function googleTagChips(raw: unknown): { slug: string; label: string; facet: string }[] {
  if (!Array.isArray(raw)) return [];
  const chips: { slug: string; label: string; facet: string }[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const slug = item.trim();
    if (!slug) continue;
    chips.push({ slug, label: googleTagLabel(slug), facet: "google" });
  }
  return chips;
}
