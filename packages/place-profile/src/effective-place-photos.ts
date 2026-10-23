// Keep in sync with supabase/supabase/functions/_shared/effective-place-photos.ts

export type PlacePhotoSourcesRow = {
  photos?: string[] | null;
  google_photos?: unknown;
  mesita_photos?: unknown;
};

function normalizeUrlList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const s = item.trim();
    if (s) out.push(s);
  }
  return out;
}

export function effectivePlacePhotos(row: PlacePhotoSourcesRow): string[] {
  const mesita = normalizeUrlList(row.mesita_photos);
  if (mesita.length > 0) return mesita;
  const google = normalizeUrlList(row.google_photos);
  if (google.length > 0) return google;
  return normalizeUrlList(row.photos);
}
