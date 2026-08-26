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

// Minimal Place Details fetch for sourcing search gates — primaryType +
// rating + review count only. Autocomplete doesn't return these, so search
// paths batch-fetch them for Google-only ("not_in_mesita") predictions.
export async function fetchPlaceSignals(
  placeId: string,
  apiKey: string,
): Promise<{
  primaryType: string | null;
  rating: number | null;
  reviewCount: number | null;
  lat: number | null;
  lng: number | null;
  country: string | null;
} | null> {
  try {
    const r = await fetch(`${GOOGLE_PLACES_DETAILS_BASE}/${encodeURIComponent(placeId)}`, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "primaryType,rating,userRatingCount,location,addressComponents",
      },
    });
    if (!r.ok) return null;
    const d = (await r.json()) as {
      primaryType?: string;
      rating?: number;
      userRatingCount?: number;
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
      lat: typeof d.location?.latitude === "number" ? d.location.latitude : null,
      lng: typeof d.location?.longitude === "number" ? d.location.longitude : null,
      country,
    };
  } catch {
    return null;
  }
}

export type NearbyGoogleHit = {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  primaryType: string | null;
  address: string | null;
};

function stripPlacesPrefix(id: string): string {
  return id.startsWith("places/") ? id.slice("places/".length) : id;
}

/** Places API (New) Nearby Search. First page only — maxResultCount caps at 20. */
export async function searchNearbyPlaces(
  apiKey: string,
  lat: number,
  lng: number,
  radiusM: number,
  maxCount: number,
): Promise<NearbyGoogleHit[]> {
  try {
    const r = await fetch(GOOGLE_PLACES_NEARBY_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.location,places.primaryType,places.formattedAddress",
      },
      body: JSON.stringify({
        maxResultCount: Math.min(20, Math.max(1, maxCount)),
        rankPreference: "DISTANCE",
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: Math.min(50_000, Math.max(1, radiusM)),
          },
        },
      }),
    });
    if (!r.ok) return [];
    const body = (await r.json()) as {
      places?: Array<{
        id?: string;
        displayName?: { text?: string };
        location?: { latitude?: number; longitude?: number };
        primaryType?: string;
        formattedAddress?: string;
      }>;
    };
    const hits: NearbyGoogleHit[] = [];
    for (const place of body.places ?? []) {
      const rawId = place.id?.trim();
      const latN = place.location?.latitude;
      const lngN = place.location?.longitude;
      const name = place.displayName?.text?.trim();
      if (!rawId || !name) continue;
      if (typeof latN !== "number" || typeof lngN !== "number") continue;
      hits.push({
        placeId: stripPlacesPrefix(rawId),
        name,
        lat: latN,
        lng: lngN,
        primaryType: place.primaryType ?? null,
        address: place.formattedAddress ?? null,
      });
    }
    return hits;
  } catch {
    return [];
  }
}
