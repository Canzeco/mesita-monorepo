import { NextResponse } from "next/server";

// Live deployment identity. A route handler always executes on the CURRENT
// production deployment the domain routes to, so a stale client (old JS held in
// memory by an open tab / installed PWA) that polls this receives the NEW sha
// and can self-refresh. Never cached, always dynamic.
export const dynamic = "force-dynamic";

export function GET() {
  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_BUILD_SHA ??
    "dev";
  return NextResponse.json(
    { sha },
    { headers: { "cache-control": "no-store, max-age=0" } },
  );
}
