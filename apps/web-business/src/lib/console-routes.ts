// Route contract for the (shell) console — every href comes from here, and
// a test asserts each entry maps to a route file on disk.
//
// THE SUBJECT IS IN THE PATH (MESITA-1807, restored MESITA-1839).
//
// It rode every href as `?org=<id>` once: a query parameter every link had to
// carry, every page had to re-resolve, and the layout above the rail could not
// read at all. Dropping it on ONE link switched a multi-org operator's context
// out from under them. MESITA-1807 moved it into the path and that stopped.
//
// MESITA-1832 then moved it OUT of the path again, into two cookies, so the
// six pages could be flat (`/profile`, `/reviews`, …) for the one-place owner
// the console is optimized for. The one-place UI was right and is kept. The
// addressing was the `?org=` bug wearing a disguise, and three things broke:
//
//   - a link to a place could not be sent to anyone: no address named one,
//     and `/places/<id>/<view>` merely rewrote the RECIPIENT's cookie;
//   - two tabs could not hold two places, a cookie being per-browser — the
//     second navigation in either tab rendered the other tab's place, which
//     on Profile is an edit against the wrong record;
//   - Back replayed a path whose meaning had since changed.
//
// So the canonical address names its subject, and the flat name stays live as
// a RESOLVER onto it. Same two addresses as MESITA-1832 shipped; the arrow is
// reversed. The rail links to the canonical one, so a click still costs one
// hop — the flat address is for bookmarks, typed URLs and Stripe's stored
// return links.
//
//   /                          the resolver — your current place, else your
//                              organization, else Create (a 307, never cached)
//   /account                   the person: you, the org switcher, the place
//                              switcher. The one page with no scope.
//   /orgs/new                  Create organization — the ceremony
//
//   /places/<id>/profile       THE PLACE, five views
//              /reviews
//              /activity
//              /settings       the place's switches
//              /admin          super-admin only
//
//   /orgs/<id>/payments        THE ORGANIZATION's money — Stripe · Partner ·
//                              Credits. Stripe's return_url is minted against
//                              `/orgs/<id>?connect=`, which lands here.
//            /members          who may sign in, and at what role
//            /places           what it holds and can claim (?owned=)
//            /places/new       Add place
//
//   /profile /reviews /activity /settings /payments /members
//                              307 onto the address above, resolving the
//                              remembered place/organization. With nothing
//                              selected they render the one next step
//                              (NoPlaceYet) rather than forwarding nowhere.
//
// `orgs/[orgId]/layout.tsx` resolves membership ONCE, server-side; a foreign
// id and a nonexistent id both answer 404, so the path is never an oracle for
// which organizations exist. The rail derives its scope from the pathname
// (lib/rail-scope.ts).
//
// THE OLD ADDRESSES FORWARD from next.config.ts: `/organization?org=` →
// `/orgs/<id>`, `/places?org=` → `/orgs/<id>/places`, `/places/new?org=` →
// `/orgs/<id>/places/new`, `/organization/new` → `/orgs/new`, `/pool` → `/`,
// and the no-org forms → `/`.
//
// NOTHING IN THAT TABLE MAY SHADOW A LIVE ADDRESS. `/settings` did, for a day
// (MESITA-1839): a MESITA-1564-era rule forwarded it to `/account`, config
// redirects run before filesystem routes, and MESITA-1832's Settings page was
// therefore unreachable while CI stayed green. `legacy-redirects.test.ts` now
// walks every address in this file through that table.
//
// `/` is a TEMPORARY redirect, never a permanent one: a 308 would be cached by
// browsers forever, and where `/` lands depends on which place you opened
// last. Every legacy forward is permanent — those moves are not coming back.

export const SHELL_ROUTES = {
  root: "/",
  account: "/account",
  orgNew: "/orgs/new",
} as const;

/** The flat, scope-free addresses. Each 307s onto the canonical address for
 *  the remembered place or organization; with nothing remembered, each renders
 *  the one next step. They are what a bookmark, a typed URL and a Stripe
 *  return link land on — the rail never links to them. */
export const FLAT_ROUTES = {
  profile: "/profile",
  reviews: "/reviews",
  activity: "/activity",
  settings: "/settings",
  admin: "/admin",
  payments: "/payments",
  members: "/members",
} as const;

export type FlatRoute = (typeof FLAT_ROUTES)[keyof typeof FLAT_ROUTES];

export const FLAT_ROUTE_LIST: readonly string[] = Object.values(FLAT_ROUTES);

export function isFlatRoute(pathname: string): boolean {
  return FLAT_ROUTE_LIST.includes(pathname.replace(/\/$/, ""));
}

/** Which place view a FLAT pathname is, or null.
 *
 *  A rail row lights for these as well as for the canonical address: an
 *  operator who typed `/reviews` is on Reviews while the forward is in
 *  flight, and a row that goes dark for that instant reads as a glitch. */
export function flatViewFromPathname(
  pathname: string,
): "profile" | "reviews" | "activity" | "settings" | "admin" | null {
  const seg = pathname.replace(/\/$/, "");
  const views = ["profile", "reviews", "activity", "settings", "admin"] as const;
  for (const v of views) if (seg === `/${v}`) return v;
  return null;
}

// ── The organization's pages ──────────────────────────────────────────────
//
// Payments, Members and Places. The bare `/orgs/<id>` is a FORWARDER onto
// Payments, not a page — the Organization screen it used to name dissolved in
// MESITA-1832, and the address survives because Stripe stored it. Places is
// the list, where Claim lives (`/new` beneath it); the rail lights Account for
// both, because Account is the page that answers "which organization".

export const ORG_PAGES = ["payments", "members", "places"] as const;
export type OrgPage = (typeof ORG_PAGES)[number];

export const ORG_PAGE_LABEL: Record<OrgPage, string> = {
  payments: "Payments",
  members: "Members",
  places: "Places",
};

const ORGS = "/orgs";

/** An organization page's address. Payments is the default because it is
 *  where the bare `/orgs/<id>` forwards and where Stripe returns. */
export function orgHref(orgId: string, page: OrgPage = "payments"): string {
  return `${ORGS}/${encodeURIComponent(orgId)}/${page}`;
}

/** The bare organization address. A forwarder, not a page — Stripe minted
 *  Account Link return_urls against it, so it has to keep resolving. */
export function orgRootHref(orgId: string): string {
  return `${ORGS}/${encodeURIComponent(orgId)}`;
}

/** The organization's places list, optionally pre-filtered. No filter =
 *  both halves, which is the comparison view the merge (MESITA-1614) exists
 *  to protect. */
export function orgPlacesHref(
  orgId: string,
  owned?: PlacesOwned | null,
): string {
  const list = orgHref(orgId, "places");
  return owned ? `${list}?owned=${owned}` : list;
}

/** Add place — the ceremony under the organization's list. */
export function orgPlacesNewHref(orgId: string): string {
  return `${orgHref(orgId, "places")}/new`;
}

/** Which organization a pathname is scoped to, or null. `/orgs/new` is the
 *  ceremony, not an id. */
export function orgIdFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/orgs\/([^/]+)(?:\/.*)?$/);
  if (!match) return null;
  const id = decodeURIComponent(match[1]);
  return id === "new" ? null : id;
}

/** Which organization page a pathname is, or null when it is not one. The
 *  Add place ceremony (`/orgs/<id>/places/new`) reads as Places: it is the
 *  list's own sub-step, and the rail lights the Places row for both. */
export function orgPageFromPathname(pathname: string): OrgPage | null {
  const match = pathname.match(
    /^\/orgs\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?\/?$/,
  );
  if (!match || match[1] === "new") return null;
  const [, , second, third] = match;
  // The bare `/orgs/<id>` is a forwarder in flight, not a page.
  if (!second) return null;
  if (second === "places") return third === undefined || third === "new" ? "places" : null;
  if (third !== undefined) return null;
  return (ORG_PAGES as readonly string[]).includes(second)
    ? (second as OrgPage)
    : null;
}

// ── The list's two filters (MESITA-1710) ──────────────────────────────────
//
// `Org Places` and `Public Places` are SAVED FILTERS on the one merged list:
// `?owned=org` and `?owned=public` against `/orgs/<id>/places`. MESITA-1614
// survives every change since untouched — the split is still a filter, the
// Owned column is still the fact, and the unfiltered list still shows both
// halves together so they can be compared.

export const PLACES_OWNED = ["org", "public"] as const;
export type PlacesOwned = (typeof PLACES_OWNED)[number];

/** Read `?owned=` off a search param. Anything unrecognised is null — an
 *  unknown value must show the full list, never an empty one. */
export function ownedFromParam(value: unknown): PlacesOwned | null {
  return typeof value === "string" &&
    (PLACES_OWNED as readonly string[]).includes(value)
    ? (value as PlacesOwned)
    : null;
}

// ── The place ─────────────────────────────────────────────────────────────

/** A place's address — Profile's, because Profile IS the place's canonical
 *  URL: opening a place means landing on its profile. Every view got its own
 *  segment in MESITA-1732, and the bare `/places/<id>` is a 307 onto this one.
 *
 *  The segment is written literally rather than by calling placeTabHref:
 *  lib/place-tabs imports from this module, so reaching back would be a
 *  cycle. shell-chrome.test.ts pins the two in sync instead. */
export function placeHref(placeId: string): string {
  return `/places/${encodeURIComponent(placeId)}/profile`;
}

/** Is this pathname a Place screen? The nav needs to know, because a place
 *  route is the one route that is neither an organization page nor Account. */
export function placeIdFromPathname(pathname: string): string | null {
  // One OPTIONAL view segment (MESITA-1537): /places/<id> and
  // /places/<id>/<view> are all the Place screen. The segment is optional
  // because the bare URL still resolves — it is a 307 onto Profile
  // (MESITA-1732) and a bookmark can still land on it. `new` is refused by
  // name: `/places/new` was the claim ceremony until MESITA-1807 and still
  // forwards from next.config.ts; it was never a place id.
  const match = pathname.match(/^\/places\/([^/]+)(?:\/[^/]+)?\/?$/);
  if (!match) return null;
  const id = decodeURIComponent(match[1]);
  return id === "new" ? null : id;
}

/** Re-attach a page's whole query string to another path.
 *
 *  Used by the console root and by the bare place URL, both of which forward.
 *  The query is not decoration there: Stripe stores an Account Link's
 *  return_url when the link is minted, so a link created before MESITA-1727
 *  shipped still points at `/?org=<id>&connect=return`. Drop the query and
 *  the operator finishes Stripe onboarding on a screen that knows neither
 *  which organization they onboarded nor that they just came back.
 *
 *  Repeated keys are preserved in order, because Next types a repeated param
 *  as an array and dropping the extras would silently change what the
 *  destination reads. */
export function withQuery(
  href: string,
  params: Record<string, string | string[] | undefined>,
): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") qs.set(key, value);
    else if (Array.isArray(value)) for (const v of value) qs.append(key, v);
  }
  const query = qs.toString();
  return query ? `${href}?${query}` : href;
}
