// Opening-state label for the profile summary chip. Same phrases as the
// consumer card helper. Typed structurally so this package does not import
// the consumer place API.

export function getOpeningStateLabel(place: {
  open_now?: boolean | null;
  opens_at?: string | null;
  closes_at?: string | null;
}): string | null {
  if (place.open_now === true && place.closes_at) {
    return `Open · until ${place.closes_at}`;
  }
  if (place.open_now === false && place.opens_at) {
    return `Closed · opens ${place.opens_at}`;
  }
  if (place.closes_at) return `Until ${place.closes_at}`;
  return null;
}
