// /orgs/<id> SELECTS the organization and forwards (MESITA-1832).
//
// The organization's page is gone: its money boxes are /payments, its
// Members are on /settings, its places and switchers on /account. The
// address stays alive because Stripe stored it — an Account Link's
// return_url is minted against `/orgs/<id>?connect=return` — and because
// the org switcher and old bookmarks name it. It writes the org cookie the
// rail reads, drops the place cookie (a place of the OLD organization must
// not stay selected under the new one), and lands on /payments with the
// query intact, or on `?to=` when that names one of the six pages.
import { NextResponse, type NextRequest } from "next/server";
import { SHELL_ROUTES, isFlatRoute } from "@/lib/console-routes";
import { RAIL_ORG_COOKIE, RAIL_PLACE_COOKIE, isPlausibleId } from "@/lib/sidebar-prefs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const search = new URLSearchParams(req.nextUrl.search);
  const to = search.get("to");
  search.delete("to");
  const target = to && isFlatRoute(to) ? to : SHELL_ROUTES.payments;
  const url = new URL(target, req.url);
  url.search = search.toString();
  const res = NextResponse.redirect(url, 307);
  if (isPlausibleId(orgId)) {
    res.cookies.set(RAIL_ORG_COOKIE, orgId, { path: "/", maxAge: 31536000, sameSite: "lax" });
    res.cookies.set(RAIL_PLACE_COOKIE, "", { path: "/", maxAge: 0 });
  }
  return res;
}
