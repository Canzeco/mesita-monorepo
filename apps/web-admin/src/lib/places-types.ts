export type PlaceLite = {
  id: string;
  displayName: string;
  formattedAddress: string;
  lat: number | null;
  lng: number | null;
  // Google quality signals (Text Search Pro SKU). null when Google returns
  // the place without them — e.g. a brand-new listing with no rating yet.
  rating: number | null;
  userRatingCount: number | null;
  // Mesita-side enrichment. When the bulk-search edge function looks the
  // Place ID up against public.places.google_place_id, these fields say
  // whether we already onboarded the place and when. ISO timestamps come
  // straight from Postgres timestamptz columns; null when the place
  // either isn't in Mesita or the lookup couldn't run.
  existsInMesita: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type QueryResult = {
  query: string;
  places: PlaceLite[];
  // Total places Google returned before the quality filters ran.
  // places.length ≤ rawCount; the gap is what the filters removed.
  rawCount: number;
  truncated: boolean;
  error: string | null;
};

export type SearchResponse = {
  ok: true;
  queries: QueryResult[];
  uniquePlaces: PlaceLite[];
  uniqueCount: number;
  regionCode: string;
  maxResultsPerQuery: number;
  // Discovery › Map floors the backend applied (0 = off),
  // echoed so the UI can label results. filteredOutCount is the pre-dedupe
  // tally of places those floors removed across all queries.
  minRating: number;
  minUserRatingCount: number;
  filteredOutCount: number;
  // Number of uniquePlaces that already exist in public.places.
  mesitaMatchCount: number;
  // Non-null when the Supabase lookup failed — the search still succeeds
  // (Google results stand on their own), but existsInMesita / createdAt /
  // updatedAt will be false / null for every place. Surface in the UI so
  // the operator knows the dedupe column is unreliable for this run.
  mesitaLookupError: string | null;
};

export type SearchErrorResponse = { ok: false; error: string };
