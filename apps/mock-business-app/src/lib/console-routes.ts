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
//   THE RAIL IS ONE ARRAY. `RAIL_ROWS` is the only row list, in Pato's order
//   and his three groups. Moving a row is an edit to one line here.
//
// The import is TYPE-ONLY and vocabulary-only, deliberately: nothing in this
// file may reach the data layer, and in this app there is no data layer to
// reach.
import type { PlaceTab } from "@/lib/place-tabs";

export const SHELL_ROUTES = {
  root: "/",
  // THE PERSON'S PAGE IS CALLED SETTINGS NOW (MESITA-1935). `/account` survives
  // only as a redirect onto it: the address shipped, and a deleted address is a
  // 404 for anyone who reached it once.
  settings: "/settings",
  account: "/account",
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
 *  TWO KINDS FOR FOUR ROWS, not one. A page and a view are different ADDRESS
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

/** THE RAIL — FOUR ROWS, in Pato's order (MESITA-1933).
 *
 *  Pato, 2026-09-16, with a drawing: *"this must be the sidebar menu, super
 *  simple… the sidebarmenu must only have that. almost all the setup will be
 *  in products, easy peasy. since almost all is passive."*
 *
 *  It was TWELVE. What left, and why none of it lost an address:
 *
 *    THE NINE PRODUCTS  Visits, Rewards, Orders, Reservations, Payments,
 *      Credits, Capital and Customers left with Profile staying. Eight of the
 *      nine are passive at a typical place, so nine rows earned one click
 *      between them. The catalogue at `/places/<id>/products` already links
 *      every card to its own view — that is the door, and it always was.
 *    HOME  keeps the screen and loses the row. The VENUE row above this list
 *      is its door: the one thing in the column that is unambiguously THIS
 *      PLACE, at the place's own bare address. MESITA-1914's rule holds — the
 *      console still opens on Home — without a fifth row for an address the
 *      venue already names.
 *    ALL PLACES  was a `multi`-only row. The venue row's caret is that door at
 *      every mode now, and `/account` has carried a second one all along.
 *    THE TWO SECTION HEADS  had two rows and two rows to separate. A title
 *      over a pair is a label pretending to be a taxonomy.
 *
 *  ACCOUNT IS NOT HERE, and neither is the venue: one is the PERSON and one is
 *  the SUBJECT, and this array is the list of places you GO. Both are pinned
 *  bands in `Sidebar.tsx`, which is why the scroller holds exactly what Pato
 *  drew.
 *
 *  ACTIVITY IS BACK, reversing MESITA-1924. It left because every product page
 *  had grown its own Activity half, which made a place-level row a second
 *  answer. With the product rows gone there are no halves to be second to, and
 *  this feed is the whole place's — every kind of event, which no one
 *  product's half covers.
 *
 *  THE ORDER IS PRODUCTS FIRST, and that is the argument: the catalogue is
 *  where an operator turns the place on. It is a bet on passivity — the day a
 *  place works Orders every service, two clicks per lookup is what brings a
 *  row back. */
export const RAIL_ROWS: readonly RailRow[] = [
  { kind: "page", target: "products" },
  { kind: "place", view: "profile" },
  { kind: "page", target: "activity" },
  // SETTINGS LEFT THE SCROLLER FOR THE FOOT (MESITA-1935). Pato: *"put accounts
  // in setting. make it clearer. check instagram sidebar as reference."*
  // Instagram pins the entry that holds Settings AND Log out at the BOTTOM,
  // below a gap, which is the band this rail already had — so the two
  // configuration destinations became one, and it is the pinned one.
  //
  // It could not simply absorb Account where it stood. These rows render in
  // only two of the rail's four shapes (`showRows` needs solo|multi AND a place
  // id); in `unknown` and `zero` the scroller is a single button. Only the foot
  // renders in every state, and Sign out lives on that page and nowhere else,
  // so a Settings row inside THIS array would have taken the console's only
  // exit away from a failed read — the same objection that refused the literal
  // sketch in MESITA-1933.
  //
  // `/places/<id>/settings` keeps its address, its `pagesForAccess` gate and
  // its `notFound`. The gate is called by the PAGE and never derived from this
  // array, so leaving here costs it nothing; it is reached from the Places
  // section of `/settings`, which lists every place you hold.
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
  // `/settings` IS NOT A FLAT NAME ANY MORE (MESITA-1935). It used to resolve
  // onto `/places/<id>/settings` like every other page twin. It is now a REAL
  // page — the person's Settings, which the rail's foot links — and a static
  // segment shadows `[flat]` in Next's router, so leaving the entry here would
  // have been a dead line claiming an address it no longer wins.
  //
  // The reassignment is deliberate, not collateral: the rail says Settings and
  // means the person, so a typed `/settings` that meant a VENUE's team would
  // contradict the only Settings a reader can see. The place's own page keeps
  // its canonical `/places/<id>/settings` and is reached from the Places
  // section of `/settings`.
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
