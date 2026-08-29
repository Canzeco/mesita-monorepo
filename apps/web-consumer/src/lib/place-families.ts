// Place families — the seven Atlas Super Categories. Super Categories
// PARTITION Mesita Categories and Google Table A types: each Category
// maps to exactly one Super; each Google type maps to exactly one Super
// (or `other`, not a guest pill). Search map Filters cut on these keys
// only. A place matches the one Super its category belongs to.
// Super `undefined` is the leftover/create-path bucket (❓), not Google
// `other` (hotels, shops, schools stay ineligible).
//
// NOT mock data: the family KEYS are a live product contract, mirrored in
//   · public.place_super_categories
//   · supabase/functions/_shared/place-taxonomy.ts
//   · supabase/functions/_shared/google-type-super.ts  (Google type map)
// Keep those in lock-step. Anything outside these families is ineligible
// for Mesita altogether — hotels, schools, shops, transit are `other`.
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
  | "culture_arts"
  | "undefined";

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
  { key: "undefined", label: "Undefined", emoji: "❓" },
];
