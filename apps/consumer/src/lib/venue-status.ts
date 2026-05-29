import type { Venue } from "@/lib/api/venues";

// Shared opening-status label for venue cards and overlays.
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
  venue: Pick<Venue, "open_now" | "opens_at" | "closes_at">,
): string | null {
  if (venue.open_now === true && venue.closes_at) {
    return `Open · until ${venue.closes_at}`;
  }
  if (venue.open_now === false && venue.opens_at) {
    return `Closed · opens ${venue.opens_at}`;
  }
  if (venue.closes_at) return `Until ${venue.closes_at}`;
  return null;
}
