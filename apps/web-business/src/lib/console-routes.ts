// Route contract for the (shell) console — every href comes from here, and
// a test asserts each entry maps to a route file on disk.
//
// THE ADDRESS NAMES ITS SUBJECT (MESITA-1807, restored MESITA-1839).
//
// It rode every href as `?org=<id>` once: a query parameter every link had to
// carry, every page had to re-resolve, and the layout above the rail could not
// read at all. Dropping it on ONE link switched a multi-org operator's context
// out from under them. MESITA-1807 moved it into the path and that stopped.
//
// MESITA-1832 then moved it OUT of the path again, into two cookies, so the
// pages could be flat (`/profile`, `/reviews`, …) for the one-place owner the
// console is optimized for. The one-place UI was right and is kept. The
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
// a RESOLVER onto it. The rail links to the canonical one, so a click costs
// one hop — the flat address is for bookmarks, typed URLs and Stripe's stored
// return links.
//
// TWO SUBJECTS, AND NEITHER SAYS ITS NAME TWICE (MESITA-1841, MESITA-1842):
//
//   /                          the resolver — your current place, else your
//                              organization, else Create (a 307, never cached)
//   /account                   the person: you, the org switcher, the place
//                              switcher. The one page with no scope.
//   /orgs/new                  Create organization — the ceremony
//
//   /orgs/<id>                 NOT a page: a 307 onto `/settings`, the one
//                              address that catches Stripe's stored
//                              `?connect=` and hands the query to Payments.
//   /orgs/<id>/settings       THE ORGANIZATION's own setup — members and
//                              developers. What you SET, nothing else.
//            /products         THE CATALOGUE — Mesita Partner, the eight
//                              products, and the Stripe account Mesita Pay
//                              rides on
//            /places           the whole catalogue: the states matrix, the
//                              ?owned= filters, Claim and Release
//            /customers        who keeps coming back (Soon)
//            /activity         the organization's numbers, by place
//            /places/new       Add place
//            /switch?to=       NOT a page: the org switcher's mechanism —
//                              writes the org cookie, clears the place cookie,
//                              forwards. A page cannot set a cookie on the way
//                              through, which is the only reason it exists.
//
//   /places/<id>/profile       THE PLACE, six views
//              /menus
//              /reviews
//              /capabilities   what a guest CAN do here
//              /rewards        what a guest EARNS here
//              /admin          super-admin only
//
//   /profile /menus /reviews /capabilities /rewards /admin
//   /settings /products /customers /activity
//                              307 onto the address above, resolving the
//                              remembered place/organization. With nothing
//                              selected they render the one next step
//                              (NoPlaceYet) rather than forwarding nowhere.
//                              ALL TEN ARE ONE ROUTE FILE (`(shell)/[flat]`):
//                              Next resolves static segments first, so every
//                              real route still wins and an unknown name 404s.
//
// `/orgs/<id>/organization` IS `/orgs/<id>/settings` (MESITA-1846 → 1848 →
// 1852 → 1871). The segment existed (MESITA-1846) so that every organization
// row would be a named address rather than one raw uuid among four names —
// that reasoning stands and every rename since has kept it. What kept moving
// is the NAME: `organization` said the group's own noun twice in one column,
// so MESITA-1852 called it `configuration` — and it called it that, rather
// than `settings`, for exactly one reason: `/settings` was owned by a
// PERMANENT legacy redirect onto `/capabilities` (MESITA-1841), so the page it
// named could never carry a flat twin, and a contract name a config rule
// shadows is the MESITA-1839 trap that took a live page down for a day.
//
// MESITA-1871 TAKES THE NAME BACK by removing the cause. Pato: *"rename
// configuration to settings."* The 308 was CHECKED, not assumed —
// `curl -I business.mesita.ai/settings` answered `308` with
// `cache-control: public, max-age=0, must-revalidate`, so every browser
// revalidates before following it and deleting the rule frees the name at
// once. `/places/<id>/settings` → `/places/<id>/capabilities` STAYS: it is a
// different path, and still the retired spelling of a place view.
//
// `/orgs/<id>/credits` IS GONE TOO (MESITA-1845), and this one MERGED rather
// than moved: Payments has a rail row again, and Prepaid Credits is the
// `SoonStrip` at the foot of that page, which is where it lived before
// MESITA-1841 gave it a room of its own. Both spellings forward, TEMPORARILY —
// a 308 would cache an answer that has already moved twice.
//
// `/orgs/<id>/payments` IS GONE NOW TOO (MESITA-1869), and Credits' forward
// follows it onto Products. Payments was a page holding two Soon strips: what
// it was FOR — what guests paid, and what reached the account — is a reading
// of a product that is not built, and the two things on it anybody could act
// on (the Stripe account, the Partner subscription) are PRODUCTS. Pato,
// 2026-09-15, listing the organization's rows: *"Configuration (here have
// members shit) · Products (here have partner and all the products to
// activate, remember that profile is free) · Places · Costumers · Activity."*
// Payments is not on that list. Its address forwards, TEMPORARILY, for the
// same reason every rename on this page does.
//
// `orgs/[orgId]/layout.tsx` resolves membership ONCE, server-side; a foreign
// id and a nonexistent id both answer 404, so the path is never an oracle for
// which organizations exist. The rail derives its scope from the pathname
// (lib/rail-scope.ts).
//
// NOTHING IN next.config.ts MAY SHADOW A LIVE ADDRESS. `/settings` did, for a
// day (MESITA-1839): a MESITA-1564-era rule forwarded it to `/account`, config
// redirects run before filesystem routes, and the Settings page was therefore
// unreachable while CI stayed green. `legacy-redirects.test.ts` walks every
// address in this file — canonical AND flat — through that table.
//
// `/` is a TEMPORARY redirect, never a permanent one: a 308 would be cached by
// browsers forever, and where `/` lands depends on which place you opened last.

export const SHELL_ROUTES = {
  root: "/",
  account: "/account",
  orgNew: "/orgs/new",
} as const;

// ── The organization ──────────────────────────────────────────────────────
//
// The organization's pages, in the order the rail lists them under the
// ORGANIZATION SELECTOR (MESITA-1848). ORG_PAGES, ORG_TARGETS and
// ORG_RAIL_TARGETS are now ONE list: every organization address is a rail row
// and every rail row is a real address, so the two cannot drift. Members is
// not among them — it is CONTENT on Settings (MESITA-1847), not a door.

/** The segments BENEATH `/orgs/<id>`.
 *
 *  `credits` IS NOT ONE (MESITA-1845). Pato, asked where Credits goes once
 *  Payments has a rail row again: *"merge."* It was a `SoonStrip` at the foot
 *  of Payments until MESITA-1841 spent a row on it; the row is gone and the
 *  strip is back where it came from, so the segment forwards instead of
 *  resolving — TEMPORARILY, because this answer has now moved twice. */
export const ORG_PAGES = [
  "settings",
  "products",
  "places",
  "customers",
  "activity",
] as const;
export type OrgPage = (typeof ORG_PAGES)[number];

/** Everything the organization addresses. There is no bare-name target any
 *  more (MESITA-1848): the group is HEADED "Organization" by its selector, so
 *  a page repeating that noun was the redundancy this pass has been deleting.
 *  Its page is `settings`. */
export const ORG_TARGETS = ORG_PAGES;
export type OrgTarget = (typeof ORG_TARGETS)[number];

export const ORG_TARGET_LABEL: Record<OrgTarget, string> = {
  settings: "Settings",
  products: "Products",
  places: "Places",
  customers: "Customers",
  activity: "Activity",
};

/** The FIVE the rail lists, in Pato's order (MESITA-1869).
 *
 *  CUSTOMERS IS NEW, and it is a live row, not a dimmed one: Pato's list
 *  writes it "(Soon)", and MESITA-1833 is his own law that the rail may never
 *  paint a working row as dead. The Soon badge lives on the page.
 *
 *  PRODUCTS TOOK PAYMENTS' PLACE, and its slot in the order — second, right
 *  under Configuration. It is the catalogue: the partnership, the eight
 *  products and the Stripe account. Payments had a row for four issues and
 *  never had a page worth opening.
 *
 *  CREDITS IS NOT HERE, and has no address either: it is a PRODUCT now, a
 *  card in the catalogue. See ORG_PAGES.
 *
 *  PLACES stays the row the place's five views sit under. */
export const ORG_RAIL_TARGETS = ORG_PAGES;
export type OrgRailTarget = (typeof ORG_RAIL_TARGETS)[number];

// THERE ARE NO DOORS LEFT (MESITA-1847). `members` was the last organization
// address with no rail row, reached through a chevron on the Organization
// page — and Pato: *"members and places in organization i mean, fuck nested
// things display shit there."* The people are ON that page now, so the
// address has nothing left to be, and `ORG_RAIL_TARGETS` is the whole
// vocabulary again. `/members` and `/orgs/<id>/members` forward.

const ORGS = "/orgs";

/** An organization address. EVERY target is a named segment (MESITA-1846),
 *  Organization included — the rail draws its five as siblings, so their
 *  addresses look alike. The bare `${ORGS}/<id>` is a forwarder onto the
 *  default, and the one thing that catches Stripe's stored `?connect=`. */
export function orgHref(orgId: string, target: OrgTarget = "settings"): string {
  return `${ORGS}/${encodeURIComponent(orgId)}/${target}`;
}

/** The bare `/orgs/<id>`: not a page, and not a row the rail can light. It is
 *  the organization's natural URL, where Stripe's months-old Account Links
 *  land, and a 307 onto `orgHref(id)`. */
export function orgRootHref(orgId: string): string {
  return `${ORGS}/${encodeURIComponent(orgId)}`;
}

/** The switcher's mechanism: writes the org cookie, clears the place cookie,
 *  forwards to `?to=<flat>`. A route handler, never a page — a page cannot set
 *  a cookie on the way through, which is the whole reason this address exists
 *  instead of the bare one (MESITA-1842). */
export function orgSwitchHref(orgId: string, to: string): string {
  return `${ORGS}/${encodeURIComponent(orgId)}/switch?to=${encodeURIComponent(to)}`;
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

/** Which organization address a pathname is, or null when it is not one.
 *
 *  The Add place ceremony (`/orgs/<id>/places/new`) reads as Places: it is the
 *  list's own sub-step. `/switch` is never an address the rail lights — it is
 *  a redirect that exists for a few milliseconds. */
export function orgTargetFromPathname(pathname: string): OrgTarget | null {
  const match = pathname.match(
    /^\/orgs\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?\/?$/,
  );
  if (!match || match[1] === "new") return null;
  const [, , second, third] = match;
  // The bare `/orgs/<id>` is a 307 onto Configuration; it answers that so
  // the row does not go dark for the instant the forward is in flight, which
  // reads as a glitch — the courtesy every flat resolver already gets.
  if (!second) return "settings";
  if (second === "switch") return null;
  if (second === "places") return third === undefined || third === "new" ? "places" : null;
  if (third !== undefined) return null;
  return (ORG_TARGETS as readonly string[]).includes(second)
    ? (second as OrgTarget)
    : null;
}

// ── The flat addresses ────────────────────────────────────────────────────

/** The scope-free names, all served by ONE route file (`(shell)/[flat]`).
 *
 *  `places` is deliberately NOT among them: `/places` is the place segment's
 *  own root and `next.config.ts` forwards it, so a flat `places` could never
 *  resolve — and a name in the contract that cannot resolve is worse than no
 *  name at all. The organization's list is reached from its page. */
export const FLAT_ROUTES = {
  // The place's six
  profile: "/profile",
  menus: "/menus",
  reviews: "/reviews",
  capabilities: "/capabilities",
  rewards: "/rewards",
  admin: "/admin",
  // The organization's four. `places` has no flat twin: it is the place
  // segment's own root (see below), so a flat `places` could never resolve.
  // `payments` has none either, and for the opposite reason: it is not an
  // address at all any more (MESITA-1869), and the redirect table owns the
  // name — a contract name a config rule shadows is the MESITA-1839 trap.
  //
  // `settings` HAS one again (MESITA-1871): the permanent rule that claimed
  // `/settings` for `/capabilities` is deleted, so the name resolves instead
  // of being shadowed. That rule is why MESITA-1852 had to call this page
  // `configuration` in the first place.
  settings: "/settings",
  products: "/products",
  customers: "/customers",
  activity: "/activity",
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
): "profile" | "menus" | "reviews" | "capabilities" | "rewards" | "admin" | null {
  const seg = pathname.replace(/\/$/, "");
  const views = [
    "profile",
    "menus",
    "reviews",
    "capabilities",
    "rewards",
    "admin",
  ] as const;
  for (const v of views) if (seg === `/${v}`) return v;
  return null;
}

/** Which ORGANIZATION address a flat pathname is, or null — the same courtesy
 *  for the four rows above the place group. */
export function flatOrgTargetFromPathname(pathname: string): OrgTarget | null {
  const seg = pathname.replace(/\/$/, "");
  for (const target of ORG_TARGETS) {
    // `places` has no flat twin — it is the place segment's own root, so a
    // flat `places` could never resolve. A name in FLAT_ROUTES is the only
    // one that does.
    if (!(target in FLAT_ROUTES)) continue;
    if (seg === `/${target}`) return target;
  }
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
 *  route is the one route that is neither an organization address nor Account. */
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
 *  Used by the console root, the bare place URL and the Organization page,
 *  all of which forward. The query is not decoration there: Stripe stores an
 *  Account Link's return_url when the link is minted, so a link created before
 *  MESITA-1727 shipped still points at `/?org=<id>&connect=return`. Drop the
 *  query and the operator finishes Stripe onboarding on a screen that knows
 *  neither which organization they onboarded nor that they just came back.
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
