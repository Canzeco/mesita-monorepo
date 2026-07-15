// Place families — the six "super categories" every Mesita place rolls up to.
//
// NOT mock data: the family KEYS are a live product contract, mirrored in
//   · apps/web-admin/src/app/(app)/sourcing-config/catalog.ts  (FAMILIES — authoring UI)
//   · supabase/functions/_shared/sourcing.ts                   (the enforcement gate)
//   · supabase/migrations/20260708120000_sourcing_config.sql   (the default policy)
// Keep all four in lock-step. Anything outside these families is ineligible for
// Mesita altogether — that's how hotels, schools, shops and transit stay out.
//
// Only the consumer-facing bits (key/label/emoji) are mirrored here; the
// family → Google primaryType expansion is enforcement-side and has no business
// in a client bundle.

export type FamilyKey =
  | "restaurants"
  | "bars_nightlife"
  | "cafes_bakeries"
  | "wellness_spa"
  | "experiences"
  | "culture_arts";

export type PlaceFamily = {
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

export function placeFamilyByKey(key: FamilyKey): PlaceFamily | undefined {
  return PLACE_FAMILIES.find((f) => f.key === key);
}
