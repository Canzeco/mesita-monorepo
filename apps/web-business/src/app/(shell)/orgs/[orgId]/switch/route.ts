// /orgs/<id>/switch — THE ORGANIZATION SWITCHER'S MECHANISM, and nothing else
// (MESITA-1842).
//
// It was the bare `/orgs/<id>`, which meant the organization's own address was
// a redirect rather than the page about the organization. The only reason it
// had to be a route handler is this file's whole job: it SELECTS the
// organization by writing a cookie, and a React Server Component cannot set a
// cookie on the way through. So the job moved to its own address and the
// natural one went to the page.
//
// `?to=` names where to land — the switcher uses it to keep you on the page
// you were on while changing organization. Only a FLAT address is accepted:
// an arbitrary `to` would make this an open redirect. With none, it lands on
// the organization itself.
//
// TEMPORARY (307), never permanent: a 308 would cache the landing in every
// browser forever, and the answer depends on a cookie this very request
// writes.
import { NextResponse, type NextRequest } from "next/server";
import { isFlatRoute, orgHref } from "@/lib/console-routes";
import { RAIL_ORG_COOKIE, RAIL_PLACE_COOKIE, isPlausibleId } from "@/lib/sidebar-prefs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const search = new URLSearchParams(req.nextUrl.search);
  const to = search.get("to");
  search.delete("to");
  // A flat `to` resolves the NEW organization's copy of that page on arrival,
  // which is exactly the switcher's intent.
  const target = to && isFlatRoute(to) ? to : orgHref(orgId);
  const url = new URL(target, req.url);
  url.search = search.toString();
  const res = NextResponse.redirect(url, 307);
  // SELECT the organization on the way through. This is the switcher's whole
  // mechanism, and it is why `?to=` may be a FLAT address: the flat resolver
  // reads these cookies, so `/orgs/<new>/switch?to=/profile` lands on the new
  // organization's first place rather than bouncing back to the old one.
  //
  // The place cookie is CLEARED, never carried: a place of the OLD
  // organization must not stay selected under the new one.
  if (isPlausibleId(orgId)) {
    res.cookies.set(RAIL_ORG_COOKIE, orgId, { path: "/", maxAge: 31536000, sameSite: "lax" });
    res.cookies.set(RAIL_PLACE_COOKIE, "", { path: "/", maxAge: 0 });
  }
  return res;
}
