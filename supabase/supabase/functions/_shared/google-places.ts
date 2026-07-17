// Shared helpers for Google Places API (New) calls. Every Mesita EF that
// hits Google Places does the same three things — read the GMP_KEY
// secret, classify the response body into an error code, and translate
// that code into operator-friendly copy. Error classification lives in
// google-places-errors.ts; re-exported here so existing imports keep working.
//
// The actual endpoint calls (Autocomplete, Text Search, Place Details)
// live in the artificial-caller `places-*` EFs that import from here.

import { json } from "./http.ts";

export {
  classifyGoogleError,
  friendlyGoogleError,
  googleErrorFromResponse,
} from "./google-places-errors.ts";

// Cloud secret is GMP_KEY; SUPA_GMP_KEY is the legacy name, kept as a fallback
// for environments that haven't been renamed yet.
const GOOGLE_PLACES_KEY_ENVS = ["GMP_KEY", "SUPA_GMP_KEY"] as const;

// Restrict Google autocomplete + text-search to F&B / nightlife primary
// types so non-hospitality matches (tire shops, mechanics, pharmacies,
// hardware stores…) don't pollute the picker. Google caps this at 5 from
// Table A; we pick the broadest 5 that cover Mesita's universe. Trade-off:
// cuisine-specific Table A types (italian_restaurant, mexican_restaurant,
// sushi_restaurant, …) get filtered out because each place has exactly one
// primary type. The Mesita-side ILIKE fallback in _shared/suggest-places.ts (absorbed from enricher suggest-places, MESITA-55)
// still surfaces them once they've been onboarded.
export const MESITA_PRIMARY_TYPES = [
  "restaurant",
  "bar",
  "cafe",
  "night_club",
  "bakery",
];

// Endpoint URLs for the three Places (New) surfaces we use.
export const GOOGLE_PLACES_AUTOCOMPLETE_URL =
  "https://places.googleapis.com/v1/places:autocomplete";
export const GOOGLE_PLACES_TEXT_SEARCH_URL =
  "https://places.googleapis.com/v1/places:searchText";
export const GOOGLE_PLACES_DETAILS_BASE =
  "https://places.googleapis.com/v1/places";

// Reads SUPA_GMP_KEY, returning a typed error envelope when missing so the
// EF can early-return. Wire status is always 200 — supabase-js's invoke
// helper swallows non-2xx bodies and surfaces a generic message, hiding
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
): Promise<{ primaryType: string | null; rating: number | null; reviewCount: number | null } | null> {
  try {
    const r = await fetch(`${GOOGLE_PLACES_DETAILS_BASE}/${encodeURIComponent(placeId)}`, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "primaryType,rating,userRatingCount",
      },
    });
    if (!r.ok) return null;
    const d = (await r.json()) as {
      primaryType?: string;
      rating?: number;
      userRatingCount?: number;
    };
    return {
      primaryType: d.primaryType ?? null,
      rating: typeof d.rating === "number" ? d.rating : null,
      reviewCount: typeof d.userRatingCount === "number" ? d.userRatingCount : null,
    };
  } catch {
    return null;
  }
}
