// The bare /places/<id>: select the place, land on Profile (MESITA-1832).
import { NextResponse, type NextRequest } from "next/server";
import { viewHref } from "@/lib/console-routes";
import { RAIL_PLACE_COOKIE, isPlausibleId } from "@/lib/sidebar-prefs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(viewHref("profile"), req.url);
  url.search = req.nextUrl.search;
  const res = NextResponse.redirect(url, 307);
  if (isPlausibleId(id)) {
    res.cookies.set(RAIL_PLACE_COOKIE, id, { path: "/", maxAge: 31536000, sameSite: "lax" });
  }
  return res;
}
