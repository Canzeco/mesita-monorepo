import {
  GOOGLE_PLACES_DETAILS_BASE,
  GOOGLE_PLACES_TEXT_SEARCH_URL,
  googleErrorFromResponse,
} from "../_shared/google-places.ts";
import { applyPlacesCallerRegion } from "../_shared/sourcing.ts";
import type { NearbyHit } from "../_shared/nearby-places.ts";

const PAGE_SIZE = 20;
const MAX_PAGES = 3;
export const MAX_RESULTS_PER_QUERY = PAGE_SIZE * MAX_PAGES; // 60

export type PlaceLite = {
  id: string;
  displayName: string;
  formattedAddress: string;
  lat: number | null;
  lng: number | null;
  // Google quality signals from the Text Search Pro SKU. null when Google
  // returns the place without the field (rare, but e.g. brand-new listings
  // have no rating yet).
  rating: number | null;
  userRatingCount: number | null;
  primaryType: string | null;
  // Mesita-side enrichment, populated after the Google round-trip by
  // looking each Place ID up against public.places.google_place_id.
  // Defaults to (false, null, null); the top-level mesitaLookupError
  // signals when the lookup couldn't run.
  existsInMesita: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export async function searchTextWithPagination(
  textQuery: string,
  maxResults: number,
  apiKey: string,
  regionCodeOverride?: string,
): Promise<PlaceLite[]> {
  const out: PlaceLite[] = [];
  let pageToken: string | undefined;
  let pagesFetched = 0;
  const wantedPages = Math.ceil(maxResults / PAGE_SIZE);

  while (pagesFetched < wantedPages && out.length < maxResults) {
    const body: Record<string, unknown> = {
      textQuery,
      pageSize: Math.min(PAGE_SIZE, maxResults - out.length),
    };
    applyPlacesCallerRegion(body, regionCodeOverride, "text");
    if (pageToken) body.pageToken = pageToken;

    const r = await fetch(GOOGLE_PLACES_TEXT_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.primaryType,nextPageToken",
      },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      throw await googleErrorFromResponse(r);
    }

    const data = (await r.json()) as {
      places?: Array<{
        id?: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
        rating?: number;
        userRatingCount?: number;
        primaryType?: string;
      }>;
      nextPageToken?: string;
    };

    for (const p of data.places ?? []) {
      if (!p.id) continue;
      out.push({
        id: p.id,
        displayName: p.displayName?.text ?? "",
        formattedAddress: p.formattedAddress ?? "",
        lat: typeof p.location?.latitude === "number" ? p.location.latitude : null,
        lng: typeof p.location?.longitude === "number" ? p.location.longitude : null,
        rating: typeof p.rating === "number" ? p.rating : null,
        userRatingCount:
          typeof p.userRatingCount === "number" ? p.userRatingCount : null,
        primaryType: typeof p.primaryType === "string" ? p.primaryType : null,
        existsInMesita: false,
        createdAt: null,
        updatedAt: null,
      });
      if (out.length >= maxResults) break;
    }

    pageToken = data.nextPageToken;
    pagesFetched++;
    if (!pageToken) break;
  }

  return out;
}

const PLACE_LITE_FIELD_MASK =
  "id,displayName,formattedAddress,location,rating,userRatingCount,primaryType";

/** Resolve one Google Place ID via Place Details — Text Search cannot. */
export async function fetchPlaceLiteById(
  placeId: string,
  apiKey: string,
): Promise<PlaceLite> {
  const r = await fetch(
    `${GOOGLE_PLACES_DETAILS_BASE}/${encodeURIComponent(placeId)}`,
    {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": PLACE_LITE_FIELD_MASK,
      },
    },
  );
  if (!r.ok) throw await googleErrorFromResponse(r);
  const p = (await r.json()) as {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    rating?: number;
    userRatingCount?: number;
    primaryType?: string;
  };
  const id = p.id ?? placeId;
  return {
    id,
    displayName: p.displayName?.text ?? "",
    formattedAddress: p.formattedAddress ?? "",
    lat: typeof p.location?.latitude === "number" ? p.location.latitude : null,
    lng: typeof p.location?.longitude === "number" ? p.location.longitude : null,
    rating: typeof p.rating === "number" ? p.rating : null,
    userRatingCount:
      typeof p.userRatingCount === "number" ? p.userRatingCount : null,
    primaryType: typeof p.primaryType === "string" ? p.primaryType : null,
    existsInMesita: false,
    createdAt: null,
    updatedAt: null,
  };
}

// ── Nearby (Single Place › Find, MESITA-2117) ────────────────────────────

/** The optional `nearby` point a request may carry, or null when it is
 *  absent or not a real coordinate. Nearby Search takes a point, never a
 *  name, so a malformed one is dropped rather than guessed at. */
export function parseNearbyCenter(
  raw: unknown,
): { lat: number; lng: number } | null {
  if (!raw || typeof raw !== "object") return null;
  const { lat, lng } = raw as { lat?: unknown; lng?: unknown };
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** A Nearby hit in the shape Text Search hits already have, so the Map gate
 *  and the Mesita join treat both the same. */
export function nearbyHitToPlaceLite(hit: NearbyHit): PlaceLite {
  return {
    id: hit.placeId,
    displayName: hit.name,
    formattedAddress: hit.address,
    lat: hit.lat,
    lng: hit.lng,
    rating: hit.rating,
    userRatingCount: hit.reviewCount,
    primaryType: hit.primaryType,
    existsInMesita: false,
    createdAt: null,
    updatedAt: null,
  };
}
