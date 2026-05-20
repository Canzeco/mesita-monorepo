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
// We deliberately don't validate the token here — the Supabase Edge
// Functions are the source of truth and they re-check the token against
// the ADMIN_ACCESS_KEY secret on every call. If the cookie value is wrong
// the EF returns 401 and the page renders an error; the manager web
// itself never needs to know the secret.

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
