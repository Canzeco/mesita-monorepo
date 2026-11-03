import { NextResponse } from "next/server";

// Live deployment identity (MESITA-3181, as web-consumer). A route handler runs
// on the production deployment the domain routes to now, so a window holding
// old JS gets the NEW sha and DeploymentWatcher can refresh it. Never cached.
export const dynamic = "force-dynamic";

export function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev";
  return NextResponse.json({ sha }, { headers: { "cache-control": "no-store, max-age=0" } });
}
