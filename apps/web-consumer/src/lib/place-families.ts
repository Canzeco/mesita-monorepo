// Place families — the eight Atlas families (seven guest pills + Undefined).
// THE LAW: the CATEGORY side is multi-parent — a Mesita category belongs
// to one or TWO families (breakfast is restaurants AND cafés), so a place
// may match two pills. The GOOGLE side is exclusive: each Table A type
// maps to exactly one of these eight. Types outside the seven land on
// Undefined, which is not a guest pill (hotels, shops, schools stay
// ineligible). Search map Filters cut on these keys only. Family
// `undefined` (label "Undefined", ❓) is the leftover bucket — ALWAYS
// rendered last.
//
// NOT mock data: the family KEYS are a live product contract, mirrored in
//   · public.place_families
//   · supabase/functions/_shared/place-taxonomy.ts
//   · supabase/functions/_shared/google-type-super.ts  (Google type map)
// This is a HARDCODED copy in catalog order — keep it in lock-step by hand
// (single-source codegen is a deferred issue). The pin that catches drift is
// `supabase/functions/_shared/place-families-parity.test.ts`. Pills render
// TEXT-ONLY; the emoji lives in the vocabulary and the consoles.
//
// Family membership is stored on place_profiles.family_keys after enrichment
// and shipped on consumer payloads (MESITA-679). This module only owns the UI
// labels for the family pills.

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
  { key: "undefined", label: "Undefined", emoji: "❓" },
];

/**
 * The families a guest may FILTER on — the seven real ones (Pato,
 * 2026-08-29). ❓ Undefined is a bookkeeping bucket, not an appetite:
 * nobody goes out looking for an unclassified place, and an empty
 * selection already shows them. It stays in PLACE_FAMILIES for every
 * other surface (consoles, badges, vocabulary) — this list is the
 * Filters sheet only.
 */
export const FILTERABLE_PLACE_FAMILIES: PlaceFamily[] = PLACE_FAMILIES.filter(
  (family) => family.key !== "undefined",
);
