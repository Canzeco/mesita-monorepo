// Place families — the six Atlas Super Categories. A Super Category is
// a SET of categories; a category may sit in two (intersections) — it
// is not a partition. Search map Filters cut on these keys only. A
// place matches every Super Category its category belongs to.
//
// NOT mock data: the family KEYS are a live product contract, mirrored in
//   · public.place_super_categories
//   · supabase/functions/_shared/place-taxonomy.ts
//   · supabase/functions/_shared/sourcing.ts  (Google type expansion)
// Keep those in lock-step. Anything outside these families is ineligible for
// Mesita altogether — that's how hotels, schools, shops and transit stay out.
//
// Family membership is stored on places.family_keys after enrichment and
// shipped on consumer payloads (MESITA-679). This module only owns the UI
// labels for the Super Category pills.

export type FamilyKey =
  | "restaurants"
  | "bars_nightlife"
  | "cafes_bakeries"
  | "wellness_spa"
  | "experiences"
  | "culture_arts";

type PlaceFamily = {
  key: FamilyKey;
  label: string;
  emoji: string;
};

export const PLACE_FAMILIES: PlaceFamily[] = [
  { key: "restaurants", label: "Restaurants", emoji: "🍽️" },
  { key: "bars_nightlife", label: "Bars & Nightlife", emoji: "🍸" },
  { key: "cafes_bakeries", label: "Cafés, Bakeries & Dessert", emoji: "☕" },
  { key: "wellness_spa", label: "Wellness & Spa", emoji: "🧖" },
  { key: "experiences", label: "Experiences & Activities", emoji: "🎟️" },
  { key: "culture_arts", label: "Culture & Arts", emoji: "🎭" },
];
