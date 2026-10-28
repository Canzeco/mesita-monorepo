// The guest Reserve CTA gate (Description → Actions). The Create-door profile
// model answers `reservations_likely` (create-door-profile.ts); this reads it.
// Fast food, taquerías, street food → false. Sit-down restaurants, clubs with
// tables, tasting menus → true. A missing or junk answer offers Reserve
// (MESITA-1799: fail open so a miss cannot padlock Reserve).

/** Explicit false is a confirmed walk-in; anything else offers Reserve. */
export function reservationsLikelyFromInference(
  parsed: { reservations_likely?: unknown } | null | undefined,
): boolean {
  return parsed?.reservations_likely !== false;
}
