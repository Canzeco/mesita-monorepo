// Route contract for the (shell) console — every href comes from here, and
// a test asserts each entry maps to a route file on disk.
//
// THE ORGANIZATION IS IN THE PATH (MESITA-1807). It used to ride every href
// as `?org=<id>`: a query parameter every link had to carry, every page had to
// re-resolve, and the layout above the rail could not read at all (a layout
// has no searchParams). Dropping it on ONE link switched a multi-org operator's
// context out from under them. Pato, 2026-09-13: "rethink the routing of the
// business app, more routes." So the URL says whose console this is:
//
//   /                        the resolver — your current place, else your
//                            organization, else Create (a 307, never cached)
//   /account                 the person
//   /orgs/new                Create organization — the ceremony
//   /orgs/<id>               the organization: Stripe Account, Partner,
//                            Members and Places on ONE page (MESITA-1810 —
//                            Pato, on seeing them split: "organization all
//                            in the same page")
//   /orgs/<id>/places        what it holds and what it can claim (?owned=)
//   /orgs/<id>/places/new    Add place — search Google; on Mesita claim
//                            into the org; not on Mesita create then claim
//   /places/<id>/<view>      the ONE place console, five views. Global, not
//                            under the org: the place id names its holder.
//
// `orgs/[orgId]/layout.tsx` resolves membership ONCE, server-side; a foreign
// id and a nonexistent id both answer 404, so the path is never an oracle for
// which organizations exist. The rail derives its scope from the pathname
// (lib/rail-scope.ts) — nothing to carry, nothing to lose.
//
// THE OLD ADDRESSES FORWARD from next.config.ts: `/organization?org=` →
// `/orgs/<id>`, `/places?org=` → `/orgs/<id>/places`, `/places/new?org=` →
// `/orgs/<id>/places/new`, `/organization/new` → `/orgs/new`, `/pool` → `/`,
// and the no-org forms → `/`. Stripe stores an Account Link's return_url when
// the link is MINTED, so links minted before this shipped still arrive at
// `/organization?org=&connect=return` and at `/?org=&connect=return`; both
// forward with the query intact to the organization page, where the notice
// lives.
//
// `/` is a TEMPORARY redirect, never a permanent one: a 308 would be cached by
// browsers forever, and where `/` lands depends on which place you opened
// last. Every legacy forward is permanent — those moves are not coming back.

// THE SIX PAGES (MESITA-1832, Pato 2026-09-13: "make the frontend web
// routes /account /profile /reviews /payments /activity /settings"), plus
// /admin for a super-admin. No id in any of them: the page is about THE
// SELECTED place and organization (lib/selected-place.ts server-side,
// lib/rail-scope.ts client-side). The old addresses SELECT and FORWARD —
// `/places/<id>/<view>` writes the place cookie and 307s to `/<view>`,
// `/orgs/<id>` writes the org cookie and 307s to `/payments` (or `?to=`).
export const SHELL_ROUTES = {
  root: "/",
  account: "/account",
  profile: "/profile",
  reviews: "/reviews",
  payments: "/payments",
  activity: "/activity",
  settings: "/settings",
  admin: "/admin",
  orgNew: "/orgs/new",
} as const;

/** The flat pages a forwarder may land on. */
export const FLAT_ROUTES: readonly string[] = [
  SHELL_ROUTES.account,
  SHELL_ROUTES.profile,
  SHELL_ROUTES.reviews,
  SHELL_ROUTES.payments,
  SHELL_ROUTES.activity,
  SHELL_ROUTES.settings,
  SHELL_ROUTES.admin,
];
export function isFlatRoute(pathname: string): boolean {
  return FLAT_ROUTES.includes(pathname);
}

/** A place view's flat address: /profile, /reviews, … */
export function viewHref(tab: "profile" | "reviews" | "activity" | "settings" | "admin"): string {
  return `/${tab}`;
}

/** Which place view a FLAT pathname is, or null. The forwarders
 *  (`/places/<id>/<view>`) are not views: they are in flight. */
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
// The organization itself is the bare `/orgs/<id>`: opening an organization
// means landing on its page, the same way opening a place means landing on
// Profile. Places is its one subpage — the list, where Claim lives (`/new`
// beneath it), and the Places row in the rail lights on both.

export const ORG_PAGES = ["overview", "places"] as const;
export type OrgPage = (typeof ORG_PAGES)[number];

export const ORG_PAGE_LABEL: Record<OrgPage, string> = {
  overview: "Organization",
  places: "Places",
};

const ORGS = "/orgs";

/** An organization page's address. The organization is the bare `/orgs/<id>`. */
export function orgHref(orgId: string, page: OrgPage = "overview"): string {
  const base = `${ORGS}/${encodeURIComponent(orgId)}`;
  return page === "overview" ? base : `${base}/${page}`;
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
  if (!second) return "overview";
  if (second === "places") return third === undefined || third === "new" ? "places" : null;
  return null;
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
