import type { Place, PlacePrediction } from '@/lib/api/places';

function normalizeName(name: string | null | undefined): string {
  return (name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Accent-insensitive exact name join of a Memo prediction to the catalog. */
export function matchPredictionToPlace(
  prediction: PlacePrediction,
  places: Place[],
): Place | null {
  const target = normalizeName(prediction.mainText);
  if (!target) return null;
  for (const place of places) {
    if (normalizeName(place.name) === target) return place;
  }
  return null;
}
