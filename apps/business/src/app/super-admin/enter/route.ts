import { NextRequest, NextResponse } from "next/server";
import {
  SUPER_ADMIN_KEY_COOKIE,
  SUPER_ADMIN_MODE_COOKIE,
  SUPER_ADMIN_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/super-admin";

// Super-admin deep-link entry point.
//
// The admin web generates URLs of the form
//   https://manager.mesita.ai/super-admin/enter?token=<ADMIN_ACCESS_KEY>&unitId=<venueId>
// and this handler turns that one-shot URL into an HttpOnly cookie session
// so the rest of the manager web can recognise the operator. The redirect
// strips the token from the URL bar before the venue page paints, which
// keeps the secret out of browser history and outbound Referer headers.
//
// We deliberately don't accept a Place ID here: resolving placeId →
// venueId requires service-role privileges that the manager web doesn't
// have. The admin web does the resolution via admin-find-venue and
// embeds the venueId in the link.

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const unitId = url.searchParams.get("unitId") ?? "";

  const expected = process.env.ADMIN_ACCESS_KEY;
  if (!expected) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Manager web is missing ADMIN_ACCESS_KEY env var. Set it in Vercel (Settings → Environment Variables, server only).",
      },
      { status: 500 },
    );
  }
  if (!token || token !== expected) {
    return NextResponse.json(
      { ok: false, error: "Invalid or missing super-admin token." },
      { status: 401 },
    );
  }
  if (!unitId) {
    return NextResponse.json(
      { ok: false, error: "Missing unitId query parameter." },
      { status: 400 },
    );
  }

  const dest = new URL(`/unit/${encodeURIComponent(unitId)}/place`, req.url);
  const res = NextResponse.redirect(dest);

  const isProd = process.env.NODE_ENV === "production";
  res.cookies.set(SUPER_ADMIN_KEY_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: SUPER_ADMIN_COOKIE_MAX_AGE_SECONDS,
  });
  res.cookies.set(SUPER_ADMIN_MODE_COOKIE, "1", {
    httpOnly: false,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: SUPER_ADMIN_COOKIE_MAX_AGE_SECONDS,
  });
  return res;
}
