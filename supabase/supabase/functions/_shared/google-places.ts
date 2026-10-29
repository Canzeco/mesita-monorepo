// Shared helpers for Google Places API (New) calls. Every Mesita EF that
// hits Google Places does the same three things — read the GMP_KEY
// secret, classify the response body into an error code, and translate
// that code into operator-friendly copy. Error classification lives in
// google-places-errors.ts; re-exported here so existing imports keep working.
//
// Autocomplete / Text Search / Place Details live in `_shared/suggest-places.ts`,
// `supabase-edgefunc-discover-places`, and related product EFs that import here.

import { json } from "./http.ts";
import { googleFetch } from "./google-fetch.ts";
import { errorMessage } from "./errors.ts";

export {
  classifyGoogleError,
  friendlyGoogleError,
  googleErrorFromResponse,
} from "./google-places-errors.ts";

// Cloud secret is GMP_KEY; SUPA_GMP_KEY is the legacy name, kept as a fallback
// for environments that haven't been renamed yet.
const GOOGLE_PLACES_KEY_ENVS = ["GMP_KEY", "SUPA_GMP_KEY"] as const;

/**
 * The Google Places key from GMP_KEY (SUPA_GMP_KEY fallback), trimmed, or
 * null when neither is set. For callers that shape their own "no key" reply;
 * request handlers that want the standard envelope use readGooglePlacesKey.
 */
export function googlePlacesKeyOrNull(
  env: { get(name: string): string | undefined } = Deno.env,
): string | null {
  return (env.get("GMP_KEY") ?? env.get("SUPA_GMP_KEY") ?? "").trim() || null;
}

// Endpoint URLs for the Places (New) surfaces we use.
export const GOOGLE_PLACES_AUTOCOMPLETE_URL =
  "https://places.googleapis.com/v1/places:autocomplete";
export const GOOGLE_PLACES_TEXT_SEARCH_URL =
  "https://places.googleapis.com/v1/places:searchText";
export const GOOGLE_PLACES_DETAILS_BASE =
  "https://places.googleapis.com/v1/places";

/** Places (New) ids may arrive as the resource name `places/ChIJ…`; keep the id. */
export function stripPlacesPrefix(id: string): string {
  return id.startsWith("places/") ? id.slice("places/".length) : id;
}

// Reads GMP_KEY (SUPA_GMP_KEY fallback), returning a typed error envelope when
// missing so the EF can early-return. Wire status is always 200 — supabase-js's
// invoke helper swallows non-2xx bodies and surfaces a generic message, hiding
// the real problem from operators.
export function readGooglePlacesKey():
  | { ok: true; key: string }
  | { ok: false; response: Response } {
  let key: string | undefined;
  for (const env of GOOGLE_PLACES_KEY_ENVS) {
    key = Deno.env.get(env);
    if (key) break;
  }
  if (!key) {
    return {
      ok: false,
      response: json({
        ok: false,
        code: "server_missing_key",
        error:
          "Mesita backend isn't configured for Google Places. Tell support — they need to set GMP_KEY.",
      }),
    };
  }
  return { ok: true, key };
}

// Location-shaped Place Details read (MESITA-1403): coordinates + viewport,
// nothing else. Fired once per PICK of a Location row in the searchbar —
// never per keystroke — so the map anchor (MESITA-1405) knows where to land
// and how wide the camera should open. A city has no rating, primaryType or
// businessStatus to ask for; the place-shaped mask below would bill a higher
// SKU for fields that do not exist on a locality.
//
// The miss is tagged (MESITA-2855): `not_found` when Google rejects or has no
// such id (400 INVALID_ARGUMENT, 404) or the place has no coordinates — a
// retry can't help — and `upstream` for any other failure, which can.
export type LocationAnchor = {
  lat: number;
  lng: number;
  viewport: {
    low: { lat: number; lng: number };
    high: { lat: number; lng: number };
  } | null;
};

export type LocationAnchorResult =
  | { ok: true; anchor: LocationAnchor }
  | { ok: false; reason: "not_found" | "upstream" };

export async function fetchLocationAnchor(
  placeId: string,
  apiKey: string,
): Promise<LocationAnchorResult> {
  try {
    const r = await googleFetch(
      `${GOOGLE_PLACES_DETAILS_BASE}/${encodeURIComponent(placeId)}`,
      { apiKey, fieldMask: "location,viewport" },
    );
    if (!r.ok) {
      return { ok: false, reason: r.status === 400 || r.status === 404 ? "not_found" : "upstream" };
    }
    const d = (await r.json()) as {
      location?: { latitude?: number; longitude?: number };
      viewport?: {
        low?: { latitude?: number; longitude?: number };
        high?: { latitude?: number; longitude?: number };
      };
    };
    const lat = d.location?.latitude;
    const lng = d.location?.longitude;
    if (typeof lat !== "number" || typeof lng !== "number") {
      return { ok: false, reason: "not_found" };
    }
    const vp = d.viewport;
    const viewport = typeof vp?.low?.latitude === "number" &&
        typeof vp?.low?.longitude === "number" &&
        typeof vp?.high?.latitude === "number" &&
        typeof vp?.high?.longitude === "number"
      ? {
        low: { lat: vp.low.latitude, lng: vp.low.longitude },
        high: { lat: vp.high.latitude, lng: vp.high.longitude },
      }
      : null;
    return { ok: true, anchor: { lat, lng, viewport } };
  } catch (err) {
    console.error(
      "[google-places] location anchor unreachable:",
      errorMessage(err),
    );
    return { ok: false, reason: "upstream" };
  }
}

// The Generate dialog's preview (MESITA-2941, Pato: "pull google details and
// display hero image … i don't want false positives, people adding the wrong
// place"). ONE Details call when the dialog opens, plus one photo media call
// for the first photo, never per keystroke. Nothing is stored: the photo URI
// is Google's own short-lived link and its author rides along for the credit
// line Google requires.
export type PlacePreview = {
  name: string;
  address: string | null;
  category: string | null;
  rating: number | null;
  reviewCount: number | null;
  photoUrl: string | null;
  photoAuthor: string | null;
  mapsUrl: string | null;
};

export type PlacePreviewResult =
  | { ok: true; preview: PlacePreview }
  | { ok: false; reason: "not_found" | "upstream" };

const PREVIEW_FIELD_MASK = [
  "displayName",
  "formattedAddress",
  "shortFormattedAddress",
  "primaryTypeDisplayName",
  "rating",
  "userRatingCount",
  "photos",
  "googleMapsUri",
].join(",");

export async function fetchPlacePreview(
  placeId: string,
  apiKey: string,
): Promise<PlacePreviewResult> {
  try {
    const r = await googleFetch(
      `${GOOGLE_PLACES_DETAILS_BASE}/${encodeURIComponent(placeId)}`,
      { apiKey, fieldMask: PREVIEW_FIELD_MASK },
    );
    if (!r.ok) {
      return { ok: false, reason: r.status === 400 || r.status === 404 ? "not_found" : "upstream" };
    }
    const d = (await r.json()) as {
      displayName?: { text?: string };
      formattedAddress?: string;
      shortFormattedAddress?: string;
      primaryTypeDisplayName?: { text?: string };
      rating?: number;
      userRatingCount?: number;
      googleMapsUri?: string;
      photos?: {
        name?: string;
        authorAttributions?: { displayName?: string }[];
      }[];
    };
    const name = d.displayName?.text?.trim();
    if (!name) return { ok: false, reason: "not_found" };
    const first = d.photos?.[0];
    let photoUrl: string | null = null;
    if (first?.name) {
      // A failed photo still answers the preview: the facts are the point.
      try {
        const pr = await googleFetch(
          `https://places.googleapis.com/v1/${first.name}/media?maxWidthPx=1200&skipHttpRedirect=true`,
          { apiKey },
        );
        if (pr.ok) {
          photoUrl = ((await pr.json()) as { photoUri?: string }).photoUri ?? null;
        }
      } catch {
        photoUrl = null;
      }
    }
    return {
      ok: true,
      preview: {
        name,
        address: d.formattedAddress || d.shortFormattedAddress || null,
        category: d.primaryTypeDisplayName?.text ?? null,
        rating: typeof d.rating === "number" ? d.rating : null,
        reviewCount: typeof d.userRatingCount === "number" ? d.userRatingCount : null,
        photoUrl,
        photoAuthor: photoUrl
          ? first?.authorAttributions?.[0]?.displayName ?? null
          : null,
        mapsUrl: d.googleMapsUri ?? null,
      },
    };
  } catch (err) {
    console.error(
      "[google-places] place preview unreachable:",
      errorMessage(err),
    );
    return { ok: false, reason: "upstream" };
  }
}
