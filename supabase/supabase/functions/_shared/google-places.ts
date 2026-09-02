// Shared helpers for Google Places API (New) calls. Every Mesita EF that
// hits Google Places does the same three things — read the GMP_KEY
// secret, classify the response body into an error code, and translate
// that code into operator-friendly copy. Error classification lives in
// google-places-errors.ts; re-exported here so existing imports keep working.
//
// Autocomplete / Text Search / Place Details live in `_shared/suggest-places.ts`,
// `supabase-edgefunc-discover-places`, and related product EFs that import here.

import { json } from "./http.ts";

export {
  classifyGoogleError,
  friendlyGoogleError,
  googleErrorFromResponse,
} from "./google-places-errors.ts";

// Cloud secret is GMP_KEY; SUPA_GMP_KEY is the legacy name, kept as a fallback
// for environments that haven't been renamed yet.
const GOOGLE_PLACES_KEY_ENVS = ["GMP_KEY", "SUPA_GMP_KEY"] as const;

// Endpoint URLs for the Places (New) surfaces we use.
export const GOOGLE_PLACES_AUTOCOMPLETE_URL =
  "https://places.googleapis.com/v1/places:autocomplete";
export const GOOGLE_PLACES_TEXT_SEARCH_URL =
  "https://places.googleapis.com/v1/places:searchText";
export const GOOGLE_PLACES_NEARBY_SEARCH_URL =
  "https://places.googleapis.com/v1/places:searchNearby";
export const GOOGLE_PLACES_NEARBY_URL = GOOGLE_PLACES_NEARBY_SEARCH_URL;
export const GOOGLE_PLACES_DETAILS_BASE =
  "https://places.googleapis.com/v1/places";

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

// % and _ are wildcards in ILIKE — escape so user input doesn't accidentally
// match everything. Lives here because every Places fallback EF needs it.
export function escapeIlike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// Location-shaped Place Details read (MESITA-1403): coordinates + viewport,
// nothing else. Fired once per PICK of a Location row in the searchbar —
// never per keystroke — so the map anchor (MESITA-1405) knows where to land
// and how wide the camera should open. A city has no rating, primaryType or
// businessStatus to ask for; the venue-shaped mask below would bill a higher
// SKU for fields that do not exist on a locality.
export async function fetchLocationAnchor(
  placeId: string,
  apiKey: string,
): Promise<{
  lat: number;
  lng: number;
  viewport: {
    low: { lat: number; lng: number };
    high: { lat: number; lng: number };
  } | null;
} | null> {
  try {
    const r = await fetch(
      `${GOOGLE_PLACES_DETAILS_BASE}/${encodeURIComponent(placeId)}`,
      {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "location,viewport",
        },
      },
    );
    if (!r.ok) return null;
    const d = (await r.json()) as {
      location?: { latitude?: number; longitude?: number };
      viewport?: {
        low?: { latitude?: number; longitude?: number };
        high?: { latitude?: number; longitude?: number };
      };
    };
    const lat = d.location?.latitude;
    const lng = d.location?.longitude;
    if (typeof lat !== "number" || typeof lng !== "number") return null;
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
    return { lat, lng, viewport };
  } catch {
    return null;
  }
}

// Minimal Place Details fetch for sourcing search gates — primaryType +
// rating + review count + businessStatus. Autocomplete doesn't return these,
// so search paths batch-fetch them for Google-only ("not_in_mesita")
// predictions. businessStatus feeds Discovery › General's post-Google wipe
// (discovery-general-gate.ts); it rides the mask the call already pays for.
export async function fetchPlaceSignals(
  placeId: string,
  apiKey: string,
): Promise<{
  primaryType: string | null;
  rating: number | null;
  reviewCount: number | null;
  businessStatus: string | null;
  lat: number | null;
  lng: number | null;
  country: string | null;
} | null> {
  try {
    const r = await fetch(`${GOOGLE_PLACES_DETAILS_BASE}/${encodeURIComponent(placeId)}`, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "primaryType,rating,userRatingCount,businessStatus,location,addressComponents",
      },
    });
    if (!r.ok) return null;
    const d = (await r.json()) as {
      primaryType?: string;
      rating?: number;
      userRatingCount?: number;
      businessStatus?: string;
      location?: { latitude?: number; longitude?: number };
      addressComponents?: Array<{
        shortText?: string;
        types?: string[];
      }>;
    };
    const country =
      d.addressComponents?.find((c) => c.types?.includes("country"))?.shortText ??
      null;
    return {
      primaryType: d.primaryType ?? null,
      rating: typeof d.rating === "number" ? d.rating : null,
      reviewCount: typeof d.userRatingCount === "number" ? d.userRatingCount : null,
      businessStatus: typeof d.businessStatus === "string" ? d.businessStatus : null,
      lat: typeof d.location?.latitude === "number" ? d.location.latitude : null,
      lng: typeof d.location?.longitude === "number" ? d.location.longitude : null,
      country,
    };
  } catch {
    return null;
  }
}
