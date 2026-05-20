import { NextRequest, NextResponse } from "next/server";
import { SUPER_ADMIN_QUERY_PARAM } from "@/lib/super-admin";

// Super-admin deep-link entry point (legacy compat).
//
// Old admin-web links looked like
//   https://manager.mesita.ai/super-admin/enter?token=<KEY>&unitId=<venueId>
// and set HttpOnly cookies. The current convention is URL-as-truth: the
// superkey lives in `?superkey=` on every venue URL. This handler keeps the
// legacy URLs working by redirecting them onto the new shape — no cookies,
// no server state. Anyone updating the admin web should link directly to
// `/unit/<id>/home?superkey=<key>` and skip this hop.

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const unitId = url.searchParams.get("unitId") ?? "";

  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Missing token query parameter." },
      { status: 400 },
    );
  }
  if (!unitId) {
    return NextResponse.json(
      { ok: false, error: "Missing unitId query parameter." },
      { status: 400 },
    );
  }

  const dest = new URL(`/unit/${encodeURIComponent(unitId)}/home`, req.url);
  dest.searchParams.set(SUPER_ADMIN_QUERY_PARAM, token);
  return NextResponse.redirect(dest);
}
