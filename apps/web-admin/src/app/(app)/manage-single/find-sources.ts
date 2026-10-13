import {
  autocompleteGooglePlaces,
  listAllPlaces,
  searchMesitaNames,
  type PlaceHit,
  type SuggestHit,
} from "@/app/(app)/manage-multiple/actions";
import type { SearchErrorResponse, SearchResponse } from "@/lib/places-types";
import type { SourceResult, TextSearchResult } from "./find-results";
import { GOOGLE_NAME_RESULTS } from "./single-place-lookup";

// The four sources Find asks for a name (MESITA-2124). Each resolves to a
// SourceResult and never throws, so one failing source becomes its own
// column's "—" and a note line instead of sinking the other three.

function failed(err: unknown): { status: "error"; error: string } {
  return { status: "error", error: err instanceof Error ? err.message : String(err) };
}

/** The whole catalogue: the Catalogue column matches inside it, and it is
 *  how a held row learns its Mesita id and name. */
export async function loadCatalogSource(): Promise<SourceResult<PlaceHit[]>> {
  const r = await loadCatalogueWithTotal();
  return r.status === "ok" ? { status: "ok", data: r.data.places } : r;
}

export async function loadCatalogueWithTotal(): Promise<
  SourceResult<{ places: PlaceHit[]; total: number }>
> {
  try {
    const r = await listAllPlaces();
    return r.ok
      ? { status: "ok", data: { places: r.data.places, total: r.data.total } }
      : { status: "error", error: r.error };
  } catch (err) {
    return failed(err);
  }
}

/** Mesita Places Name Search. Its own session token: the lane wants one even
 *  though this mode bills no Google session. */
export async function searchNameSource(query: string): Promise<SourceResult<SuggestHit[]>> {
  try {
    const r = await searchMesitaNames(query, crypto.randomUUID());
    return r.ok ? { status: "ok", data: r.data } : { status: "error", error: r.error };
  } catch (err) {
    return failed(err);
  }
}

/** Google Places Autocomplete Search. One session token per Find — Google
 *  bills an Autocomplete session, not a keystroke, and Find asks once. */
export async function searchAutocompleteSource(
  query: string,
): Promise<SourceResult<SuggestHit[]>> {
  try {
    const r = await autocompleteGooglePlaces(query, crypto.randomUUID());
    return r.ok ? { status: "ok", data: r.data } : { status: "error", error: r.error };
  } catch (err) {
    return failed(err);
  }
}

/** Google Places Text Search: one page through the route Multiple Places ›
 *  Google Search uses, so Discovery › Map's floors apply here as everywhere
 *  and the note line can say how many they hid. */
export async function searchTextSource(query: string): Promise<SourceResult<TextSearchResult>> {
  try {
    const res = await fetch("/api/bulk-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        queries: [query],
        placeIds: [],
        regionCode: "",
        maxResultsPerQuery: GOOGLE_NAME_RESULTS,
      }),
    });
    const data: SearchResponse | SearchErrorResponse = await res.json();
    if (!data.ok) {
      return { status: "error", error: data.error || `HTTP ${res.status}` };
    }
    const q = data.queries[0];
    if (q?.error) return { status: "error", error: q.error };
    return {
      status: "ok",
      data: {
        places: q?.places ?? data.uniquePlaces,
        minRating: data.minRating,
        minUserRatingCount: data.minUserRatingCount,
        filteredOutCount: data.filteredOutCount,
        mesitaLookupError: data.mesitaLookupError,
      },
    };
  } catch (err) {
    return failed(err);
  }
}
