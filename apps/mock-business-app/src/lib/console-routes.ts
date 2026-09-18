// The route contract — every href in the mock console comes from here.
//
// Snapshot of `apps/web-business/src/lib/console-routes.ts`, carrying the two
// laws that file exists to hold and none of its legacy:
//
//   THE ADDRESS NAMES ITS SUBJECT, and the PLACE is the only subject.
//   `/places/<id>/<view>` is canonical; the flat twin (`/profile`, `/orders`)
//   is a RESOLVER onto it, for bookmarks and typed URLs. The rail links
//   canonical, so a click costs one hop.
//
//   THE RAIL IS ONE ARRAY. `RAIL_ROWS` is the only row list, in Pato's order.
//   Moving a row is an edit to one line here.
//
// The import is TYPE-ONLY and vocabulary-only, deliberately: nothing in this
// file may reach the data layer, and in this app there is no data layer to
// reach.
import type { PlaceTab } from "@/lib/place-tabs";

export const SHELL_ROUTES = {
  root: "/",
  // ONE DESTINATION NOW, AND IT IS NOT PLACE-SCOPED (MESITA-1973). `/settings`
  // is the fourth tab: the person, what they owe, and the open place's own
  // config, on one screen. MESITA-1937 split this into `/account` (the person)
  // and `/places/<id>/settings` (the place) on the argument that scoping them
  // apart is what makes each legible. Four tabs overrule it — Pato put
  // *"Settings, Account also here"* in the same breath — and the split's real
  // job survives the merge: this address needs NO place, so the exit still
  // renders in the `unknown` and `zero` shapes, which is the one constraint
  // MESITA-1935 actually broke when it tried this before.
  //
  // IT IS A REAL PAGE, NOT A FLAT TWIN, so it is gone from `FLAT_ROUTES`: a
  // static segment shadows `[flat]` in Next's router, and a name in both lists
  // is a resolver that never runs.
  settings: "/settings",
  places: "/places",
  placesNew: "/places/new",
} as const;

/** The segments BENEATH `/places/<id>` that are PAGES rather than views.
 *
 *  TWO, SINCE MESITA-1973. `products` became `setup`, `customers` went back to
 *  being a future product with a row in Setup and no page of its own, and
 *  `settings` left the place entirely for `/settings`. */
export const PLACE_PAGES = ["setup", "activity"] as const;
export type PlacePage = (typeof PLACE_PAGES)[number];

export const PLACE_PAGE_LABEL: Record<PlacePage, string> = {
  // THE SHOP AND THE CONFIG ARE ONE LIST (MESITA-1973). `products` named a
  // catalogue that only stated facts, while every switch lived on a product's
  // own view — so a product existed twice and the two could disagree, which is
  // the bug MESITA-1953 had to work around on the Visits card. Setup is the
  // one list: Off says what a product does, On says how it is set.
  setup: "Setup",
  activity: "Activity",
};

/** A rail row names a place PAGE, and that is the only kind left.
 *
 *  `kind: "place"` IS GONE WITH THE PRODUCT ROWS (MESITA-1973). Four tabs means
 *  four destinations — the venue, Setup, Activity, Settings — and a product is
 *  reached by drilling in from Setup, never by a row. `kind: "home"` never came
 *  back either: the VENUE BAND is Home's door, which is the one thing in the
 *  column that unambiguously says which place these rows are about.
 *
 *  The discriminant survives a one-member union on purpose. Adding a second
 *  kind later is then an edit to this type and a branch in the rail, not a
 *  refactor of every row literal. */
export type RailRow = { kind: "page"; target: PlacePage } & {
  /** Draw a hairline ABOVE this row. Unused at four rows and kept for the same
   *  reason as the discriminant: the seam is a property of a row, never a
   *  second list. */
  seam?: true;
};

/** THE RAIL — TWO ROWS, because the console has FOUR DESTINATIONS and the
 *  other two are bands (MESITA-1973).
 *
 *  Pato, 2026-09-18, after three days of rearranging this column: *"Place,
 *  Setup, Activity, Settings"* — *"FOUR SCREENS EASY."*
 *
 *      Place      the VENUE BAND, which has been Home's door since MESITA-1933
 *      Setup      ─┐ this array
 *      Activity   ─┘
 *      Settings   the pinned FOOT
 *
 *  THE TWO THAT ARE NOT HERE ARE NOT MISSING. Place is the venue band because
 *  the band already names the subject and links its bare address; a row saying
 *  "Place" under a band saying which place would be the same door drawn twice.
 *  Settings is the foot because `showRows` draws this array only in the `solo`
 *  and `multi` shapes, and Sign out lives on Settings now — a row here would
 *  strand the console's only exit in `unknown` and `zero`, which is exactly the
 *  defect MESITA-1937 called out when it moved the exit to Account.
 *
 *  WHY THE PRODUCT ROWS WENT. Nine rows do not port to a phone, and
 *  mobile-business was never going to inherit them. Four tabs are the same IA
 *  at both widths, which is the rule consumer web and mobile already live by.
 *  A product is reached by drilling in from Setup; its view, its address and
 *  its key are all unchanged.
 *
 *  THE ORDER IS READ BEFORE BUY. Activity is opened daily and Setup monthly,
 *  so Setup sitting first would put the shop above the work. It is first here
 *  anyway for one reason: a place that has just been claimed has nothing in
 *  Activity and everything to do in Setup, and the console's first week is the
 *  only week this order is load-bearing. Revisit once an operator has used it. */
export const RAIL_ROWS: readonly RailRow[] = [
  { kind: "page", target: "setup" },
  { kind: "page", target: "activity" },
];

export function placePageHref(placeId: string, page: PlacePage): string {
  return `/places/${encodeURIComponent(placeId)}/${page}`;
}

export function placeRootHref(placeId: string): string {
  return `/places/${encodeURIComponent(placeId)}`;
}

/** Is this pathname HOME — the place's bare address, `/places/<id>` and
 *  nothing after it? A fourth segment is a view or a page, and the rail's Home
 *  row must not stay lit underneath one of those. */
export function isPlaceHomePathname(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  return parts.length === 2 && parts[0] === "places" && parts[1] !== "new";
}

export function placesHref(owned?: PlacesOwned | null): string {
  return owned ? `${SHELL_ROUTES.places}?owned=${owned}` : SHELL_ROUTES.places;
}

export function placesNewHref(): string {
  return SHELL_ROUTES.placesNew;
}

/** Online Payments' Stripe account, ON THE PAYMENTS VIEW (MESITA-1973).
 *
 *  It was `products/pay` — config living inside the shop, which is the same
 *  duplication Setup exists to end, and the one product whose switch was not
 *  where the product was. The literal is written out rather than read through
 *  `placeTabHref`: `place-tabs.ts` imports a VALUE from this file, so a value
 *  import back would close a cycle in a permission matrix, and a cycle there
 *  evaluates to undefined, which reads as "allowed". */
export function placePayHref(placeId: string): string {
  return `/places/${encodeURIComponent(placeId)}/pay`;
}

export function placePageFromPathname(pathname: string): PlacePage | null {
  const parts = pathname.split("/");
  if (parts[1] !== "places") return null;
  const seg = parts[3];
  return (PLACE_PAGES as readonly string[]).includes(seg ?? "")
    ? (seg as PlacePage)
    : null;
}

/** THE FLAT NAMES. One file — `(shell)/[flat]` — resolves all of them onto the
 *  canonical address. A name NOT in this list 404s on purpose, so that a typo
 *  never renders a generic page.
 *
 *  `/settings` IS NOT HERE ANY MORE (MESITA-1973): it is a real page on its own
 *  static segment, and a static segment shadows `[flat]`, so a name in both
 *  lists is a resolver that can never run. `/products` and `/customers` went
 *  with the pages they resolved onto. */
export const FLAT_ROUTES = {
  home: "/home",
  profile: "/profile",
  visits: "/visits",
  orders: "/orders",
  reservations: "/reservations",
  rewards: "/rewards",
  pay: "/pay",
  credits: "/credits",
  // The ninth product owes a flat twin like every other view (MESITA-1929).
  capital: "/capital",
  admin: "/admin",
  setup: "/setup",
  activity: "/activity",
} as const;
export type FlatRoute = (typeof FLAT_ROUTES)[keyof typeof FLAT_ROUTES];
export const FLAT_ROUTE_LIST: readonly string[] = Object.values(FLAT_ROUTES);

export function isFlatRoute(pathname: string): boolean {
  return FLAT_ROUTE_LIST.includes(pathname);
}

/** The place VIEW a flat name resolves to, or null when the flat name is a
 *  PAGE (`/setup`, `/activity`) or not flat. */
export function flatViewFromPathname(pathname: string): PlaceTab | null {
  const name = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  if (!isFlatRoute(`/${name}`) || isFlatHome(pathname)) return null;
  return (PLACE_PAGES as readonly string[]).includes(name)
    ? null
    : (name as PlaceTab);
}

/** `/home` is the ONE flat name that resolves to neither a view nor a page: it
 *  means the place's bare address. Both readers around it end in "anything
 *  that is not a page is a view", so without this guard `/home` would resolve
 *  to a `PlaceTab` called "home" that no matrix, label or route has ever heard
 *  of — and it would surface as a 404 three files from its cause. */
export function isFlatHome(pathname: string): boolean {
  const name = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  return `/${name}` === FLAT_ROUTES.home;
}

export function flatPlacePageFromPathname(pathname: string): PlacePage | null {
  const name = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  if (!isFlatRoute(`/${name}`) || isFlatHome(pathname)) return null;
  return (PLACE_PAGES as readonly string[]).includes(name)
    ? (name as PlacePage)
    : null;
}

export const PLACES_OWNED = ["mine", "public"] as const;
export type PlacesOwned = (typeof PLACES_OWNED)[number];

export function ownedFromParam(value: unknown): PlacesOwned | null {
  return typeof value === "string" &&
    (PLACES_OWNED as readonly string[]).includes(value)
    ? (value as PlacesOwned)
    : null;
}

/** The place id a pathname names, or null. Reads `/places/<id>/…` only. */
export function placeIdFromPathname(pathname: string): string | null {
  const parts = pathname.split("/");
  if (parts[1] !== "places") return null;
  const id = parts[2];
  if (!id || id === "new") return null;
  return decodeURIComponent(id);
}
