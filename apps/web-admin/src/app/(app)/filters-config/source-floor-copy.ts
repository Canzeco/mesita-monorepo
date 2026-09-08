// Shared floor copy, so a mirror can never drift from the box it points at.
// Both source strips import these; changing an owner's title here changes
// every pointer that names it.

/** The box that owns `discovery_config.general`. */
export const GENERAL_FLOOR_OWNER = "Google Places Autocomplete Search";

/** The box that owns `discovery_config.filters`. */
export const FILTERS_FLOOR_OWNER = "Mesita Places Nearby Search";

/** 0 is off everywhere, and the console says so rather than printing a bare 0. */
export function floorNumber(n: number): string {
  return n > 0 ? String(n) : "0 — off";
}
