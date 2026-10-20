// The place on Google Maps: the saved Maps link, else a search by address.
export function placeMapsUrl(place: {
  address: string;
  reviews_maps: { google_maps_url?: string };
}): string {
  return (
    place.reviews_maps.google_maps_url ??
    `https://maps.google.com/?q=${encodeURIComponent(place.address)}`
  );
}
