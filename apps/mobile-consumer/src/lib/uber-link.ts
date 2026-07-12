/**
 * Uber universal deep link with place as dropoff — port of
 * apps/web-consumer/src/lib/uber-link.ts.
 */
export function buildUberDropoffUrl(place: {
  name: string;
  address: string;
  lat?: number | null;
  lng?: number | null;
}): string {
  const drop: Record<string, string | number> = {
    addressLine1: place.name.trim() || 'Destination',
    addressLine2: place.address.trim(),
  };

  if (
    typeof place.lat === 'number' &&
    Number.isFinite(place.lat) &&
    typeof place.lng === 'number' &&
    Number.isFinite(place.lng)
  ) {
    drop.latitude = place.lat;
    drop.longitude = place.lng;
  }

  const params = new URLSearchParams();
  params.set('drop[0]', JSON.stringify(drop));
  return `https://m.uber.com/looking?${params.toString()}`;
}
