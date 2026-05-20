import { NextRequest, NextResponse } from "next/server";
import { SUPER_ADMIN_QUERY_PARAM } from "@/lib/super-admin";

// Client-side mutation proxy for super-admin mode.
//
// EditVenueForm + PromosClient run in the browser; in super-admin mode
// they hold the superkey in `window.location.search` (URL = source of
// truth) and POST here with `?superkey=<value>` on the URL. This handler
// reads the key out of the request URL, forwards the body to the
// manager-update-unit EF with `x-super-admin-key` — the EF accepts that
// header in lieu of a bearer JWT and skips the venue_members check.

export async function POST(req: NextRequest) {
  const key = req.nextUrl.searchParams.get(SUPER_ADMIN_QUERY_PARAM);
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Missing superkey query parameter." },
      { status: 401 },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return NextResponse.json(
      { ok: false, error: "Server is missing NEXT_PUBLIC_SUPABASE_URL." },
      { status: 500 },
    );
  }

  const bodyText = await req.text();
  const upstream = await fetch(`${supabaseUrl}/functions/v1/manager-update-unit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-super-admin-key": key,
    },
    body: bodyText,
    cache: "no-store",
  });

  const responseText = await upstream.text();
  return new NextResponse(responseText, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
