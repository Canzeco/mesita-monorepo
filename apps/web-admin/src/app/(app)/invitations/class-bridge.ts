// What a stored class key means, for the one console surface that writes one
// by hand.
//
// DIAMOND (MESITA-2044, MESITA-2046). A guest is Diamond or not — nothing in
// between. Pato: "either you are diamond or you are not. its more like a
// List." So an operator reads exactly two states, never a metal.
//
// Storage did NOT move: `consumers.class_key` and
// `consumers.invitation_class_key` still FK to `public.classes`, and a stray
// `silver`/`gold` row (or a legacy `standard`/`influencer`/`premium` one) can
// still be read. Those all mean "not Diamond"; only `diamond` and its
// legacy `aura` mean "Diamond".
const DIAMOND_KEYS = new Set(["diamond", "aura"]);
const NOT_DIAMOND_KEYS = new Set([
  "bronze",
  "silver",
  "gold",
  "standard",
  "influencer",
  "premium",
]);

/** Whether a stored key makes the guest Diamond. */
export function isDiamondKey(key: string | null): boolean {
  return key != null && DIAMOND_KEYS.has(key);
}

/** How a stored key reads to an operator: Diamond or not. An
 *  unrecognised key prints as itself — never silently as "not Diamond". */
export function diamondLabel(key: string | null): string {
  if (key == null || NOT_DIAMOND_KEYS.has(key)) return "Not Diamond";
  if (DIAMOND_KEYS.has(key)) return "Diamond";
  return key;
}

// The one key an invitation may grant. The list is the only thing an
// invitation puts a guest on, so there is nothing to choose between.
export const DIAMOND_KEY = "diamond";
