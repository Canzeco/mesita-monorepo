// Place families — the Atlas Super Categories (seven real + Other).
// THE LAW: the CATEGORY side is multi-parent — a Mesita category belongs
// to one or TWO supers (breakfast is restaurants AND cafés), so a place
// may match two pills. The GOOGLE side is exclusive: each Table A type
// maps to exactly one super (or `other`, not a guest pill). Search map
// Filters cut on these keys only. Super `undefined` (label "Other", ❓)
// is the leftover/create-path bucket — ALWAYS rendered last — not Google
// `other` (hotels, shops, schools stay ineligible).
//
// NOT mock data: the family KEYS are a live product contract, mirrored in
//   · public.place_super_categories
//   · supabase/functions/_shared/place-taxonomy.ts
//   · supabase/functions/_shared/google-type-super.ts  (Google type map)
// This is a HARDCODED copy in §1 table order — keep it in lock-step by
// hand (single-source codegen is a deferred issue). Pills render
// TEXT-ONLY; the emoji lives in the vocabulary and the consoles.
//
// Family membership is stored on places.family_keys after enrichment and
// shipped on consumer payloads (MESITA-679). This module only owns the UI
// labels for the Super Category pills.

export type FamilyKey =
  | "restaurants"
  | "cafes_bakeries"
  | "bars_nightlife"
  | "experiences"
  | "culture_arts"
  | "sports_fitness"
  | "wellness_beauty"
  | "undefined";

type PlaceFamily = {
  key: FamilyKey;
  label: string;
  emoji: string;
};

export const PLACE_FAMILIES: PlaceFamily[] = [
  { key: "restaurants", label: "Restaurants", emoji: "🍽️" },
  { key: "cafes_bakeries", label: "Cafés & Desserts", emoji: "☕" },
  { key: "bars_nightlife", label: "Bars & Nightlife", emoji: "🍸" },
  { key: "experiences", label: "Experiences", emoji: "🎟️" },
  { key: "culture_arts", label: "Culture & Arts", emoji: "🎭" },
  { key: "sports_fitness", label: "Sports & Fitness", emoji: "⚽" },
  { key: "wellness_beauty", label: "Wellness & Beauty", emoji: "💆" },
  { key: "undefined", label: "Other", emoji: "❓" },
];
