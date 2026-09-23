import type { Place } from "@/lib/api/places";

// Shared opening-state label for place cards and overlays.
//
//   open_now === true  + closes_at → "Open · until 02:00"
//   open_now === false + opens_at  → "Closed · opens 18:00" (later today)
//                                    "Closed · opens tomorrow 08:30"
//                                    "Closed · opens Wed 08:30"
//   only closes_at present         → "Until 02:00" (partial info)
//   nothing usable                 → null
//
// Two-fact phrasing keeps the binary state legible at a glance
// without making the user parse the time. The day rides inside
// `opens_at` (computeOpenState's opensOnDay, MESITA-2047).
export function getOpeningStateLabel(
  place: Pick<Place, "open_now" | "opens_at" | "closes_at">,
): string | null {
  if (place.open_now === true && place.closes_at) {
    return `Open · until ${place.closes_at}`;
  }
  if (place.open_now === false && place.opens_at) {
    return `Closed · opens ${place.opens_at}`;
  }
  if (place.closes_at) return `Until ${place.closes_at}`;
  return null;
}
