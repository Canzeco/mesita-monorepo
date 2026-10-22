/**
 * Build the Google Maps directions link for a place (MESITA-2619, Pato:
 * "add button for location for maps, like google maps. super important").
 *
 * The documented Maps URL: `maps/dir/?api=1&destination=…` opens Google
 * Maps (the app when installed) already routing to the place. The
 * destination is the coordinates when the row has them, else the name and
 * address; `travelmode` is left to the guest's default.
 *
 * @see https://developers.google.com/maps/documentation/urls/get-started#directions-action
 */
export function buildDirectionsUrl(place: {
  name: string;
  address: string;
  lat?: number | null;
  lng?: number | null;
}): string {
  const hasGeo =
    typeof place.lat === "number" &&
    Number.isFinite(place.lat) &&
    typeof place.lng === "number" &&
    Number.isFinite(place.lng);
  const destination = hasGeo
    ? `${place.lat},${place.lng}`
    : [place.name.trim(), place.address.trim()].filter(Boolean).join(", ");
  const params = new URLSearchParams({ api: "1", destination });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
