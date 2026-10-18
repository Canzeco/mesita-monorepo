// Google's own photo for a profile Mesita does not hold yet (MESITA-2307).
// decision: Pato — this is Google's API, not our DB: nothing persisted,
// display-only, one Details call per opened profile, never for a card or a
// pin. The URL must be a googleusercontent one: an <img> of a
// places.googleapis.com media URL 403s without the key, and a fetch of it
// is CORS-blocked (the pre-#2305 preview learned both).

type PlacePhotoLike = {
  getURI?: (opts: { maxWidth: number }) => string;
};

type PlaceLike = {
  fetchFields: (opts: { fields: string[] }) => Promise<unknown>;
  photos?: PlacePhotoLike[] | null;
  displayName?: string | null;
  formattedAddress?: string | null;
};

/** The slice of Maps JS `google.maps.PlacesLibrary` this module reads. */
export type PlacesLibraryLike = {
  Place: new (opts: { id: string }) => PlaceLike;
};

export type GooglePlaceFacts = {
  name: string | null;
  address: string | null;
  photoUrl: string | null;
};

export const NO_GOOGLE_PLACE_FACTS: GooglePlaceFacts = {
  name: null,
  address: null,
  photoUrl: null,
};

export const GOOGLE_PLACE_FACT_FIELDS = [
  "displayName",
  "formattedAddress",
  "photos",
] as const;

export function isDisplayablePlacePhoto(url: unknown): url is string {
  return typeof url === "string" && url.startsWith("https://") &&
    !url.includes("places.googleapis.com");
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function fetchGooglePlaceFacts(
  places: PlacesLibraryLike,
  placeId: string,
): Promise<GooglePlaceFacts> {
  const place = new places.Place({ id: placeId });
  await place.fetchFields({ fields: [...GOOGLE_PLACE_FACT_FIELDS] });
  const uri = place.photos?.[0]?.getURI?.({ maxWidth: 1200 });
  return {
    name: text(place.displayName),
    address: text(place.formattedAddress),
    photoUrl: isDisplayablePlacePhoto(uri) ? uri : null,
  };
}
