// Google-only Search preview. Details + the first photo, billed only when
// the guest opens GooglePlaceSheet — never for map pins or the nearby 50.
// Pato-directed exception to the EF-only rule: this is Google's API, not
// our DB, nothing persisted, display-only.
//
// The hero must be a googleusercontent URL. Browser fetch of
// places.googleapis.com/.../media is CORS-blocked, and an <img> of that
// same URL with ?key= 403s — that's the pink MapPinPlus placeholder.
// Prefer Maps JS (new Place, then legacy PlacesService already on the
// Search map) so getURI/getUrl can mint a displayable photo in-page.

export type GooglePlacePreview = {
  photoUrl?: string;
  formattedAddress?: string;
  googleMapsUri?: string;
};

export const GOOGLE_PREVIEW_FIELD_MASK =
  "photos,formattedAddress,googleMapsUri";

const DETAILS_BASE = "https://places.googleapis.com/v1/places";
const MAPS_WAIT_MS = 1500;

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

type LegacyPlaceResult = {
  photos?: PlacePhotoLike[];
  formatted_address?: string;
  url?: string;
};

export type PlacesServiceCtor = new (attrContainer: HTMLElement) => {
  getDetails: (
    request: { placeId: string; fields: string[] },
    callback: (
      result: LegacyPlaceResult | null,
      status: string,
    ) => void,
  ) => void;
};

export type PlacesServiceLoader = () => PlacesServiceCtor | null;

type MapsGlobal = {
  google?: {
    maps?: {
      importLibrary?: (name: string) => Promise<unknown>;
      places?: {
        Place?: PlacesLibraryLike["Place"];
        PlacesService?: PlacesServiceCtor;
      };
    };
  };
};

export function isDisplayablePlacePhoto(
  url: string | undefined,
): url is string {
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

function mapsApi(): NonNullable<MapsGlobal["google"]>["maps"] | undefined {
  return (globalThis as MapsGlobal).google?.maps;
}

async function waitForGoogleMaps(ms = MAPS_WAIT_MS): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const maps = mapsApi();
    if (typeof maps?.importLibrary === "function" || maps?.places) return;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
}

function loadPlacesService(): PlacesServiceCtor | null {
  const ctor = mapsApi()?.places?.PlacesService;
  return typeof ctor === "function" ? ctor : null;
}

async function loadPlacesLibrary(): Promise<PlacesLibraryLike | null> {
  await waitForGoogleMaps();
  const maps = mapsApi();
  if (typeof maps?.importLibrary === "function") {
    const lib = (await maps.importLibrary("places")) as PlacesLibraryLike;
    if (lib?.Place) return lib;
  }
  const Place = maps?.places?.Place;
  return Place ? { Place } : null;
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

async function previewFromPlacesService(
  placeId: string,
  loadService: PlacesServiceLoader,
): Promise<GooglePlacePreview | null> {
  const Service = loadService();
  if (!Service) return null;
  const node =
    typeof document !== "undefined"
      ? document.createElement("div")
      : ({} as HTMLElement);
  const service = new Service(node);
  return new Promise((resolve) => {
    service.getDetails(
      { placeId, fields: ["photos", "formatted_address", "url"] },
      (result, status) => {
        if (status !== "OK" || !result) {
          resolve(null);
          return;
        }
        resolve({
          photoUrl: result.photos?.[0]
            ? photoUriFromJs(result.photos[0])
            : undefined,
          formattedAddress: result.formatted_address,
          googleMapsUri: result.url,
        });
      },
    );
  });
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

export function mergeGooglePlacePreview(
  ...parts: Array<GooglePlacePreview | null | undefined>
): GooglePlacePreview {
  const merged: GooglePlacePreview = {};
  for (const part of parts) {
    if (!part) continue;
    if (!merged.photoUrl && isDisplayablePlacePhoto(part.photoUrl)) {
      merged.photoUrl = part.photoUrl;
    }
    merged.formattedAddress ??= part.formattedAddress;
    merged.googleMapsUri ??= part.googleMapsUri;
  }
  return merged;
}

export function isEmptyGooglePlacePreview(
  preview: GooglePlacePreview | null | undefined,
): boolean {
  return !preview ||
    (!isDisplayablePlacePhoto(preview.photoUrl) &&
      !preview.formattedAddress &&
      !preview.googleMapsUri);
}

/** Re-read the cache after the fetch so a richer in-flight write is kept. */
export function settleGooglePlaceCache(
  cache: Map<string, GooglePlacePreview>,
  id: string,
  fetched: GooglePlacePreview | null,
): GooglePlacePreview {
  const latest = cache.get(id);
  const next = mergeGooglePlacePreview(fetched, latest);
  if (!isEmptyGooglePlacePreview(next)) cache.set(id, next);
  else if (!latest) cache.set(id, {});
  return next;
}

export async function fetchGooglePlacePreview(
  placeId: string,
  apiKey: string,
  get: typeof fetch = fetch,
  loadPlaces: PlacesLoader = loadPlacesLibrary,
  loadService: PlacesServiceLoader = loadPlacesService,
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

  let fromService: GooglePlacePreview | null = null;
  try {
    fromService = await previewFromPlacesService(placeId, loadService);
  } catch {
    fromService = null;
  }
  if (fromService && isDisplayablePlacePhoto(fromService.photoUrl)) {
    return mergeGooglePlacePreview(fromService, fromJs);
  }

  let fromRest: GooglePlacePreview = {};
  try {
    fromRest = await previewFromRest(placeId, apiKey, get);
  } catch {
    // REST Details is a fallback. A throw here must not wipe a Maps
    // address or URI we already have.
  }
  return mergeGooglePlacePreview(fromJs, fromService, fromRest);
}
