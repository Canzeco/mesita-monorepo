import { NextRequest, NextResponse } from "next/server";
import { readVerifiedSuperAdminKey } from "@/lib/super-admin";

// Client-side mutation proxy for super-admin mode.
//
// EditVenueForm runs in the browser and can't read the HttpOnly cookie
// that holds the super-admin token. So when the form notices it's in
// super-admin mode (via the non-HttpOnly flag cookie), it POSTs the
// same body to this route instead of calling Supabase directly. This
// handler reads the HttpOnly cookie server-side, then forwards to the
// manager-update-unit EF with `x-super-admin-key` — the EF accepts that
// header in lieu of a bearer JWT and skips the venue_members check.

export async function POST(req: NextRequest) {
  const key = await readVerifiedSuperAdminKey();
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Not in super-admin mode." },
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
