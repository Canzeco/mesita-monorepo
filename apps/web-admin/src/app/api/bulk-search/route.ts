import { NextRequest, NextResponse } from "next/server";
import { efInvoke } from "@/lib/supabase-ef";
import type { SearchResponse } from "@/lib/places-types";

type RequestBody = {
  queries?: unknown;
  placeIds?: unknown;
  regionCode?: unknown;
  maxResultsPerQuery?: unknown;
};

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const queries = Array.isArray(body.queries)
    ? body.queries
        .filter((q): q is string => typeof q === "string")
        .map((q) => q.trim())
        .filter((q) => q.length > 0)
    : [];
  const placeIds = Array.isArray(body.placeIds)
    ? body.placeIds
        .filter((q): q is string => typeof q === "string")
        .map((q) => q.trim())
        .filter((q) => q.length >= 18)
    : [];
  const regionCode =
    typeof body.regionCode === "string" ? body.regionCode.trim().toUpperCase() : "";
  const maxResultsPerQuery =
    typeof body.maxResultsPerQuery === "number" ? body.maxResultsPerQuery : 60;

  // Quality floors are Discovery › Map. This route
  // never forwards client minRating / minUserRatingCount.
  const result = await efInvoke<SearchResponse>("admin-web-discover-places", {
    queries,
    placeIds,
    regionCode,
    maxResultsPerQuery,
  });

  if (!result.ok) {
    // efInvoke reports status 0 for transport errors without a usable
    // Response and for 2xx bodies that aren't { ok: true } — Response only
    // accepts 200–599, so anything outside 400–599 becomes a 502.
    const status =
      result.status >= 400 && result.status <= 599 ? result.status : 502;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json(result.data);
}
