import {
  GOOGLE_PLACES_TEXT_SEARCH_URL,
  googleErrorFromResponse,
} from "../_shared/google-places.ts";
import { applyPlacesCallerRegion } from "../_shared/sourcing.ts";

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
