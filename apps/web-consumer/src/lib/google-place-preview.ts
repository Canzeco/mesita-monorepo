// Google-only Search preview. Details + the first photo, billed only when
// the guest opens GooglePlaceSheet — never for map pins or the nearby 50.
// Pato-directed exception to the EF-only rule: this is Google's API, not
// our DB, nothing persisted, display-only.
//
// The hero must be a googleusercontent URL. Browser fetch of
// places.googleapis.com/.../media is CORS-blocked, and an <img> of that
// same URL with ?key= 403s — that's the pink MapPinPlus placeholder.

export type GooglePlacePreview = {
  photoUrl?: string;
  formattedAddress?: string;
  googleMapsUri?: string;
};

export const GOOGLE_PREVIEW_FIELD_MASK =
  "photos,formattedAddress,googleMapsUri";

const DETAILS_BASE = "https://places.googleapis.com/v1/places";

type PlacePhotoLike = {
  getURI?: (opts: { maxWidth: number }) => string;
  getUrl?: (opts: { maxWidth: number }) => string;
};

type PlaceLike = {
  fetchFields: (opts: { fields: string[] }) => Promise<void>;
  photos?: PlacePhotoLike[];
  formattedAddress?: string | null;
  googleMapsURI?: string | null;
};

export type PlacesLibraryLike = {
  Place: new (opts: { id: string }) => PlaceLike;
};

export type PlacesLoader = () => Promise<PlacesLibraryLike | null>;

export function isDisplayablePlacePhoto(url: string | undefined): boolean {
  return typeof url === "string" && url.startsWith("https://") &&
    !url.includes("places.googleapis.com");
}

function photoUriFromJs(photo: PlacePhotoLike): string | undefined {
  const raw =
    (typeof photo.getURI === "function" && photo.getURI({ maxWidth: 1200 })) ||
    (typeof photo.getUrl === "function" && photo.getUrl({ maxWidth: 1200 })) ||
    "";
  return isDisplayablePlacePhoto(raw) ? raw : undefined;
}

export async function loadPlacesLibrary(): Promise<PlacesLibraryLike | null> {
  const maps = (
    globalThis as {
      google?: { maps?: { importLibrary?: (name: string) => Promise<unknown> } };
    }
  ).google?.maps;
  if (typeof maps?.importLibrary !== "function") return null;
  const lib = (await maps.importLibrary("places")) as PlacesLibraryLike;
  return lib?.Place ? lib : null;
}

async function previewFromPlacesLibrary(
  placeId: string,
  loadPlaces: PlacesLoader,
): Promise<GooglePlacePreview | null> {
  const lib = await loadPlaces();
  if (!lib) return null;
  const place = new lib.Place({ id: placeId });
  await place.fetchFields({
    fields: ["photos", "formattedAddress", "googleMapsURI"],
  });
  const photoUrl = place.photos?.[0]
    ? photoUriFromJs(place.photos[0])
    : undefined;
  return {
    photoUrl,
    formattedAddress: place.formattedAddress ?? undefined,
    googleMapsUri: place.googleMapsURI ?? undefined,
  };
}

async function firstPhotoUri(
  photoName: string,
  apiKey: string,
  get: typeof fetch,
): Promise<string | undefined> {
  const media = await get(
    `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1200&skipHttpRedirect=true`,
    { headers: { "X-Goog-Api-Key": apiKey } },
  );
  if (!media.ok) return undefined;
  const body = (await media.json()) as { photoUri?: string };
  return isDisplayablePlacePhoto(body.photoUri) ? body.photoUri : undefined;
}

async function previewFromRest(
  placeId: string,
  apiKey: string,
  get: typeof fetch,
): Promise<GooglePlacePreview> {
  const res = await get(`${DETAILS_BASE}/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": GOOGLE_PREVIEW_FIELD_MASK,
    },
  });
  if (!res.ok) throw new Error(`places details ${res.status}`);
  const data = (await res.json()) as {
    photos?: Array<{ name?: string }>;
    formattedAddress?: string;
    googleMapsUri?: string;
  };
  const photoName = data.photos?.[0]?.name;
  let photoUrl: string | undefined;
  if (photoName) {
    try {
      photoUrl = await firstPhotoUri(photoName, apiKey, get);
    } catch {
      // CORS on /media — the Maps JS path already ran; leave photo empty.
    }
  }
  return {
    photoUrl,
    formattedAddress: data.formattedAddress,
    googleMapsUri: data.googleMapsUri,
  };
}

export async function fetchGooglePlacePreview(
  placeId: string,
  apiKey: string,
  get: typeof fetch = fetch,
  loadPlaces: PlacesLoader = loadPlacesLibrary,
): Promise<GooglePlacePreview> {
  let fromJs: GooglePlacePreview | null = null;
  try {
    fromJs = await previewFromPlacesLibrary(placeId, loadPlaces);
  } catch {
    fromJs = null;
  }
  if (fromJs && isDisplayablePlacePhoto(fromJs.photoUrl)) {
    return fromJs;
  }
  const fromRest = await previewFromRest(placeId, apiKey, get);
  return {
    photoUrl: fromJs?.photoUrl ?? fromRest.photoUrl,
    formattedAddress: fromJs?.formattedAddress ?? fromRest.formattedAddress,
    googleMapsUri: fromJs?.googleMapsUri ?? fromRest.googleMapsUri,
  };
}
