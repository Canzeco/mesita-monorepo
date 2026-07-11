/**
 * Build an Uber universal deep link that prefills the venue as dropoff.
 *
 * Uses the current `m.uber.com/looking` format (not the legacy
 * `m.uber.com/ul/?action=setPickup` path). Opens the Uber app when
 * installed; otherwise falls through to mobile web.
 *
 * @see https://developer.uber.com/docs/riders/ride-requests/tutorials/deep-links/introduction
 */
export function buildUberDropoffUrl(place: {
  name: string;
  address: string;
  lat?: number | null;
  lng?: number | null;
}): string {
  const drop: Record<string, string | number> = {
    // addressLine1 = nickname shown in Uber; addressLine2 = full street address
    addressLine1: place.name.trim() || "Destination",
    addressLine2: place.address.trim(),
  };

  if (
    typeof place.lat === "number" &&
    Number.isFinite(place.lat) &&
    typeof place.lng === "number" &&
    Number.isFinite(place.lng)
  ) {
    drop.latitude = place.lat;
    drop.longitude = place.lng;
  }

  // Encode via URLSearchParams so `drop[0]` brackets become %5B0%5D
  // (matches Uber's documented universal-link examples).
  const params = new URLSearchParams();
  params.set("drop[0]", JSON.stringify(drop));
  return `https://m.uber.com/looking?${params.toString()}`;
}
