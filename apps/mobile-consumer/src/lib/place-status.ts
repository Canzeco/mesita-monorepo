import type { Place } from '@/lib/api/places';

export function getOpeningStatusLabel(
  place: Pick<Place, 'open_now' | 'opens_at' | 'closes_at'>,
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
