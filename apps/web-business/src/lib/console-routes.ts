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
//   /orgs/<id>                 THE ORGANIZATION itself — its name, Members,
//                              Places. Stripe's return_url is minted against
//                              `/orgs/<id>?connect=`, and this page hands that
//                              query on to Payments.
//   /orgs/<id>/payments        Stripe · Partner
//            /credits          Prepaid Credits
//            /activity         the organization's numbers, by place
//            /members          who may sign in, and at what role
//            /places           what it holds and can claim (?owned=)
//            /places/new       Add place
//            /switch?to=       NOT a page: the org switcher's mechanism —
//                              writes the org cookie, clears the place cookie,
//                              forwards. A page cannot set a cookie on the way
//                              through, which is the only reason it exists.
//
//   /places/<id>/profile       THE PLACE, five views
//              /reviews
//              /capabilities   what a guest CAN do here
//              /rewards        what a guest EARNS here
//              /admin          super-admin only
//
//   /profile /reviews /capabilities /rewards /admin
//   /organization /payments /credits /activity /members
//                              307 onto the address above, resolving the
//                              remembered place/organization. With nothing
//                              selected they render the one next step
//                              (NoPlaceYet) rather than forwarding nowhere.
//                              ALL TEN ARE ONE ROUTE FILE (`(shell)/[flat]`):
//                              Next resolves static segments first, so every
//                              real route still wins and an unknown name 404s.
//
// `/orgs/<id>/organization` IS GONE (MESITA-1842). The segment said the word
// twice, and the bare address was a forwarder only because a page cannot write
// a cookie mid-flight. Moving that one job to `/switch` freed the natural
// address for the page it was always about.
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
// The organization ITSELF is `/orgs/<id>` — named `"organization"` in this
// contract so one vocabulary covers the bare address and the five segments
// beneath it. Activity and Places are the rail's other two rows; Members,
// Payments and Credits have addresses and no row (MESITA-1844), because the
// Organization page is their door — and each lights the Organization row,
// which is the row you would go back through.

/** The segments BENEATH `/orgs/<id>`. */
export const ORG_PAGES = [
  "payments",
  "credits",
  "activity",
  "members",
  "places",
] as const;
export type OrgPage = (typeof ORG_PAGES)[number];

/** Everything the organization addresses, the bare page included. */
export const ORG_TARGETS = ["organization", ...ORG_PAGES] as const;
export type OrgTarget = (typeof ORG_TARGETS)[number];

export const ORG_TARGET_LABEL: Record<OrgTarget, string> = {
  organization: "Organization",
  payments: "Payments",
  credits: "Credits",
  activity: "Activity",
  members: "Members",
  places: "Places",
};

/** The THREE the rail lists, in the drawing's order (MESITA-1844).
 *
 *  PAYMENTS AND CREDITS LEFT IT. Pato, 2026-09-14: *"payments inside org."*
 *  They are pages an operator SETS UP — a Stripe account is connected once, a
 *  credit balance is topped up now and then — and the rail is for what you
 *  check. The Organization page is their door, exactly as it already was for
 *  Members and Places, and both keep every address they had. What changed is
 *  only which rows a glance down the column has to read past.
 *
 *  PLACES GAINED ONE. It is the bridge between the organization and the
 *  storefronts, it is where an operator holding none meets Add place, and it
 *  is the row the place's five views now sit under. */
export const ORG_RAIL_TARGETS = ["organization", "activity", "places"] as const;
export type OrgRailTarget = (typeof ORG_RAIL_TARGETS)[number];

/** The organization addresses with NO row of their own — each reached from
 *  the Organization page, and each lighting ITS row while you are there. A
 *  page in neither list is a page nothing in the rail can light, which is the
 *  drift `sidebar-render.test.tsx` counts as a second pill or none. */
export const ORG_DOOR_TARGETS = ["members", "payments", "credits"] as const;
export type OrgDoorTarget = (typeof ORG_DOOR_TARGETS)[number];

const ORGS = "/orgs";

/** An organization address. The default is the organization ITSELF — the page
 *  Stripe returns to and the row the rail lights for every door beneath it. */
export function orgHref(orgId: string, target: OrgTarget = "organization"): string {
  const base = `${ORGS}/${encodeURIComponent(orgId)}`;
  return target === "organization" ? base : `${base}/${target}`;
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
 *  The BARE `/orgs/<id>` is the Organization page itself (MESITA-1842), so it
 *  answers `"organization"` — it used to answer null, because it was a
 *  forwarder in flight and nothing in the rail could light for it.
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
  if (!second) return "organization";
  if (second === "switch") return null;
  if (second === "places") return third === undefined || third === "new" ? "places" : null;
  if (third !== undefined) return null;
  return (ORG_PAGES as readonly string[]).includes(second)
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
  // The place's five
  profile: "/profile",
  reviews: "/reviews",
  capabilities: "/capabilities",
  rewards: "/rewards",
  admin: "/admin",
  // The organization's five
  organization: "/organization",
  payments: "/payments",
  credits: "/credits",
  activity: "/activity",
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
): "profile" | "reviews" | "capabilities" | "rewards" | "admin" | null {
  const seg = pathname.replace(/\/$/, "");
  const views = ["profile", "reviews", "capabilities", "rewards", "admin"] as const;
  for (const v of views) if (seg === `/${v}`) return v;
  return null;
}

/** Which ORGANIZATION address a flat pathname is, or null — the same courtesy
 *  for the four rows above the place group. */
export function flatOrgTargetFromPathname(pathname: string): OrgTarget | null {
  const seg = pathname.replace(/\/$/, "");
  for (const target of ORG_TARGETS) {
    if (seg === `/${target}` && seg !== "/places") return target;
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
