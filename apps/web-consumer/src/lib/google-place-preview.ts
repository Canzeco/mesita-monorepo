// Google-only Search preview. Places API (New) Details + the first photo,
// billed only when the guest opens GooglePlaceSheet — never for map pins
// or the nearby 50. Pato-directed exception to the EF-only rule: this is
// Google's API, not our DB, nothing persisted, display-only.

export type GooglePlacePreview = {
  photoUrl?: string;
  formattedAddress?: string;
  googleMapsUri?: string;
};

export const GOOGLE_PREVIEW_FIELD_MASK =
  "photos,formattedAddress,googleMapsUri";

const DETAILS_BASE = "https://places.googleapis.com/v1/places";

function mediaUrl(photoName: string, apiKey: string, skipRedirect: boolean): string {
  const extra = skipRedirect ? "&skipHttpRedirect=true" : "";
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1200${extra}&key=${apiKey}`;
}

async function firstPhotoUrl(
  photoName: string,
  apiKey: string,
  get: typeof fetch,
): Promise<string | undefined> {
  try {
    const media = await get(
      `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1200&skipHttpRedirect=true`,
      { headers: { "X-Goog-Api-Key": apiKey } },
    );
    if (media.ok) {
      const body = (await media.json()) as { photoUri?: string };
      if (typeof body.photoUri === "string" && body.photoUri.startsWith("https://")) {
        return body.photoUri;
      }
    }
  } catch {
    // CORS or a network blip — the img-src media URL still works without a
    // JSON body (Google 302s to googleusercontent).
  }
  return mediaUrl(photoName, apiKey, false);
}

export async function fetchGooglePlacePreview(
  placeId: string,
  apiKey: string,
  get: typeof fetch = fetch,
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
  return {
    photoUrl: photoName ? await firstPhotoUrl(photoName, apiKey, get) : undefined,
    formattedAddress: data.formattedAddress,
    googleMapsUri: data.googleMapsUri,
  };
}
