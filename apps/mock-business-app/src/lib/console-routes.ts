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
  // TWO DESTINATIONS AGAIN, AND THEY ARE SCOPED DIFFERENTLY (MESITA-1937).
  // `account` is the PERSON — You, your places, Sign out — and it is what the
  // rail's foot links. `settings` is the flat twin of a PLACE's settings, which
  // resolves onto `/places/<id>/settings` through `(shell)/[flat]`; the rail
  // links that canonical address, never this one.
  account: "/account",
  settings: "/settings",
  places: "/places",
  placesNew: "/places/new",
} as const;

/** The segments BENEATH `/places/<id>` that are PAGES rather than views. */
export const PLACE_PAGES = [
  "settings",
  "products",
  "customers",
  "activity",
] as const;
export type PlacePage = (typeof PLACE_PAGES)[number];

export const PLACE_PAGE_LABEL: Record<PlacePage, string> = {
  settings: "Settings",
  products: "Products",
  customers: "Customers",
  activity: "Activity",
};

/** A rail row names a place PAGE or a place VIEW.
 *
 *  TWO KINDS FOR FIVE ROWS, not one. A page and a view are different ADDRESS
 *  SHAPES — `/places/<id>/products` is a static segment, `/places/<id>/profile`
 *  goes through the `[view]` gate — and they light from different readers. A
 *  single string kind would make the rail GUESS which, and guessing wrong is a
 *  404 three files from its cause.
 *
 *  `kind: "home"` and `kind: "product"` are gone (MESITA-1933). See below. */
export type RailRow =
  | { kind: "page"; target: PlacePage }
  | { kind: "place"; view: PlaceRailView };

/** The place views that keep a rail row OF THEIR OWN — NOT `PLACE_TABS`.
 *  Profile is the only one, and the eight beside it are products: a product is
 *  reached from the catalogue now, never from a row. */
export const PLACE_RAIL_VIEWS = ["profile"] as const;
export type PlaceRailView = (typeof PLACE_RAIL_VIEWS)[number];

/** THE RAIL — FIVE ROWS, in Pato's order (MESITA-1937).
 *
 *  Pato, 2026-09-16, with the shipped rail on screen: *"Noooo — make it like
 *  this: Logo / Place Explorer-Selector / Products / Profile / Customers /
 *  Activity / Settings / (gap) / Account. keep congruent simple design."*
 *
 *  EVERY ROW HERE IS PLACE-SCOPED, and that is what makes the list one list.
 *  Products, Profile, Customers, Activity and Settings are all things you do TO
 *  the venue named in the band above them. The PERSON is not in this array —
 *  Account is a pinned band in `Sidebar.tsx` — and neither is the venue itself.
 *
 *  CUSTOMERS IS BACK, reversing its removal in MESITA-1933. It left with the
 *  eight products because it read as a ninth; it is not one. A product is
 *  something a place turns on, and the people who walk in are not. It keeps its
 *  Soon card in the catalogue, because the catalogue names every product this
 *  place could have and says which ones this caller may open — a card that
 *  states a fact and a row that is a door are not the same drawing twice.
 *
 *  SETTINGS IS BACK IN THE SCROLLER, reversing MESITA-1935. That issue folded
 *  Account into Settings on the grounds that two rows both meaning
 *  configuration is a thing a reader has to disambiguate. The answer here is
 *  that they do not both mean configuration: one configures the PLACE (Team,
 *  Developers) and one is the PERSON. Scoping them apart is what makes them
 *  legible, not merging them.
 *
 *  AND THE EXIT SURVIVES ANYWAY. MESITA-1935's real objection was that
 *  `showRows` draws this array only in the `solo` and `multi` shapes, so a
 *  Settings row holding Sign out would strand the console's only exit in
 *  `unknown` and `zero`. It does not apply: Sign out is on ACCOUNT, and Account
 *  is the pinned foot, which renders in all four. The band that must never
 *  disappear is still a band.
 *
 *  HOME KEEPS THE SCREEN AND LOSES THE ROW (MESITA-1933, unchanged). The VENUE
 *  row above this list is its door — the one thing in the column that is
 *  unambiguously THIS PLACE, at the place's own bare address.
 *
 *  THE ORDER IS PRODUCTS FIRST, and that is the argument: the catalogue is
 *  where an operator turns the place on. Settings is last of the five because
 *  it is the only one you visit to change how the console behaves rather than
 *  to read what the place did. */
export const RAIL_ROWS: readonly RailRow[] = [
  { kind: "page", target: "products" },
  { kind: "place", view: "profile" },
  { kind: "page", target: "customers" },
  { kind: "page", target: "activity" },
  { kind: "page", target: "settings" },
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

/** Mesita Payments' Stripe account is a SUB-STEP of the catalogue, not a
 *  ninth card: `products/pay`. */
export function placePayHref(placeId: string): string {
  return `${placePageHref(placeId, "products")}/pay`;
}

export function placePageFromPathname(pathname: string): PlacePage | null {
  const parts = pathname.split("/");
  if (parts[1] !== "places") return null;
  const seg = parts[3];
  return (PLACE_PAGES as readonly string[]).includes(seg ?? "")
    ? (seg as PlacePage)
    : null;
}

export function isPlacePayPathname(pathname: string): boolean {
  const parts = pathname.split("/");
  return parts[1] === "places" && parts[3] === "products" && parts[4] === "pay";
}

/** THE FLAT NAMES. One file — `(shell)/[flat]` — resolves all of them onto the
 *  canonical address. A name NOT in this list 404s on purpose, so that a typo
 *  never renders a generic page. */
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
  // `/settings` IS A FLAT NAME AGAIN (MESITA-1937), and it means the PLACE's:
  // it resolves onto `/places/<id>/settings` like every other page twin.
  // MESITA-1935 briefly gave this address to the person and stood a real
  // `(shell)/settings/page.tsx` on it — a static segment shadows `[flat]` in
  // Next's router, so that file WON the address whatever this list said. The
  // file is gone with it, and the person is back at `/account`, which is the
  // one the rail's foot links.
  settings: "/settings",
  products: "/products",
  customers: "/customers",
  activity: "/activity",
} as const;
export type FlatRoute = (typeof FLAT_ROUTES)[keyof typeof FLAT_ROUTES];
export const FLAT_ROUTE_LIST: readonly string[] = Object.values(FLAT_ROUTES);

export function isFlatRoute(pathname: string): boolean {
  return FLAT_ROUTE_LIST.includes(pathname);
}

/** The place VIEW a flat name resolves to, or null when the flat name is a
 *  PAGE (`/settings`, `/products`, `/customers`, `/activity`) or not flat. */
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
