import { NextRequest, NextResponse } from "next/server";
import { efInvoke } from "@/lib/supabase-ef";
import type { SearchResponse } from "@/lib/places-types";

type RequestBody = {
  queries?: unknown;
  regionCode?: unknown;
  maxResultsPerQuery?: unknown;
  minRating?: unknown;
  minUserRatingCount?: unknown;
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
  const regionCode =
    typeof body.regionCode === "string" ? body.regionCode.trim().toUpperCase() : "MX";
  const maxResultsPerQuery =
    typeof body.maxResultsPerQuery === "number" ? body.maxResultsPerQuery : 60;
  // Quality filters. The edge function clamps these too, but keep the wire
  // payload clean: numbers only, 0 = off.
  const minRating =
    typeof body.minRating === "number" && body.minRating > 0 ? body.minRating : 0;
  const minUserRatingCount =
    typeof body.minUserRatingCount === "number" && body.minUserRatingCount > 0
      ? Math.floor(body.minUserRatingCount)
      : 0;

  const result = await efInvoke<SearchResponse>("admin-web-discover-places", {
    queries,
    regionCode,
    maxResultsPerQuery,
    minRating,
    minUserRatingCount,
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
