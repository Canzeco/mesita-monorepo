import type { Place } from "@/lib/api/places";

// Shared opening-status label for place cards and overlays.
//
//   open_now === true  + closes_at → "Open · until 02:00"
//   open_now === false + opens_at  → "Closed · opens 18:00"
//   only closes_at present         → "Until 02:00" (partial info)
//   nothing usable                 → null
//
// Two-fact phrasing keeps the binary state legible at a glance
// without making the user parse the time. Day-aware copy
// ("opens tomorrow at 18:00") drops in once the EF returns a real
// date instead of just an HH:MM.
export function getOpeningStatusLabel(
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
