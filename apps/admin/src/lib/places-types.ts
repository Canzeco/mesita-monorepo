export type PlaceLite = {
  id: string;
  displayName: string;
  formattedAddress: string;
  lat: number | null;
  lng: number | null;
};

export type QueryResult = {
  query: string;
  places: PlaceLite[];
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
};

export type SearchErrorResponse = { ok: false; error: string };
