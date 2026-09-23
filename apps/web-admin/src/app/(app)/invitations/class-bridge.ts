// What a stored class key means, for the one console surface that writes one
// by hand.
//
// THE DIAMOND LIST (MESITA-2044). A guest is on it or not — nothing in
// between. Pato: "either you are diamond or you are not. its more like a
// List." So an operator reads exactly two states, never a metal.
//
// Storage did NOT move: `consumers.class_key` and
// `consumers.invitation_class_key` still FK to `public.classes`, and a stray
// `silver`/`gold` row (or a legacy `standard`/`influencer`/`premium` one) can
// still be read. Those all mean "not on the list"; only `diamond` and its
// legacy `aura` mean "on it".
const ON_THE_LIST = new Set(["diamond", "aura"]);
const OFF_THE_LIST = new Set([
  "bronze",
  "silver",
  "gold",
  "standard",
  "influencer",
  "premium",
]);

/** Whether a stored key puts the guest on the Diamond List. */
export function isOnDiamondList(key: string | null): boolean {
  return key != null && ON_THE_LIST.has(key);
}

/** How a stored key reads to an operator: on the list or not. An
 *  unrecognised key prints as itself — never silently as "not on the list". */
export function diamondListLabel(key: string | null): string {
  if (key == null || OFF_THE_LIST.has(key)) return "Not on the list";
  if (ON_THE_LIST.has(key)) return "On the Diamond List";
  return key;
}

// The one key an invitation may grant. The list is the only thing an
// invitation puts a guest on, so there is nothing to choose between.
export const DIAMOND_LIST_KEY = "diamond";
