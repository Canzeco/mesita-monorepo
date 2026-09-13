// /places/<id>/<view> SELECTS the place and forwards to /<view> (MESITA-1832).
//
// Every old address — a bookmark, the list's rows, a link in a message —
// still works: the place becomes the console's selected place (the same
// cookie the rail writes) and the flat page renders it. A pool place selects
// too; the (place) layout then shows it read-only, as /places/<id> did.
import { NextResponse, type NextRequest } from "next/server";
import { PLACE_TABS } from "@/lib/place-tabs";
import { viewHref } from "@/lib/console-routes";
import { RAIL_PLACE_COOKIE, isPlausibleId } from "@/lib/sidebar-prefs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; view: string }> },
) {
  const { id, view } = await params;
  const tab = (PLACE_TABS as readonly string[]).includes(view) ? (view as (typeof PLACE_TABS)[number]) : "profile";
  const url = new URL(viewHref(tab), req.url);
  url.search = req.nextUrl.search;
  const res = NextResponse.redirect(url, 307);
  if (isPlausibleId(id)) {
    res.cookies.set(RAIL_PLACE_COOKIE, id, { path: "/", maxAge: 31536000, sameSite: "lax" });
  }
  return res;
}
