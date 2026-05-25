import { NextRequest, NextResponse } from "next/server";
import { efInvoke } from "@/lib/supabase-ef";
import type { SearchResponse } from "@/lib/places-types";

type RequestBody = {
  queries?: unknown;
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
  const regionCode =
    typeof body.regionCode === "string" ? body.regionCode.trim().toUpperCase() : "MX";
  const maxResultsPerQuery =
    typeof body.maxResultsPerQuery === "number" ? body.maxResultsPerQuery : 60;

  const result = await efInvoke<SearchResponse>("admin-search-places", {
    queries,
    regionCode,
    maxResultsPerQuery,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status === 200 ? 400 : result.status },
    );
  }

  return NextResponse.json(result.data);
}
