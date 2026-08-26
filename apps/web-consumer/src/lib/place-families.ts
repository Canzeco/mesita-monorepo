// Place families — the six "super categories" every Mesita place rolls up to.
//
// NOT mock data: the family KEYS are a live product contract, mirrored in
//   · supabase/functions/_shared/sourcing.ts  (Table A type expansion)
// Keep those in lock-step. Anything outside these families is ineligible for
// Mesita altogether — that's how hotels, schools, shops and transit stay out.
//
// Family membership for a place is computed server-side and shipped as
// `family_keys` on consumer place payloads (MESITA-679). This module only
// owns the UI labels for the discovery "What" pills.

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
