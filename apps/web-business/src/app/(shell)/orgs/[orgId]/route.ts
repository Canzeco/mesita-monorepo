// /orgs/<id> FORWARDS to that organization's Payments (MESITA-1839).
//
// The bare organization address has never been a page of its own since
// MESITA-1832 dissolved the Organization screen. It stays alive because Stripe
// stored it: an Account Link's return_url is minted against
// `/orgs/<id>?connect=return` when the link is created, so links minted months
// ago still arrive here and must reach the notice that reads `?connect=`.
// Payments is where that notice lives.
//
// `?to=` names a different landing when the caller has one — the org switcher
// uses it to keep you on the page you were on while changing organization.
// Only a flat address is accepted there: an arbitrary `to` would make this an
// open redirect.
//
// TEMPORARY (307), never permanent: where the organization opens is a product
// decision that has already changed twice, and a 308 would cache the answer in
// every browser forever.
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
  const target = to && isFlatRoute(to) ? to : orgHref(orgId, "payments");
  const url = new URL(target, req.url);
  url.search = search.toString();
  const res = NextResponse.redirect(url, 307);
  // SELECT the organization on the way through. This is the switcher's whole
  // mechanism, and it is why `?to=` may be a FLAT address: the flat resolver
  // reads these cookies, so `/orgs/<new>?to=/profile` lands on the new
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
