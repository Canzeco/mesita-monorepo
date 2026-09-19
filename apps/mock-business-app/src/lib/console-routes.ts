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
export const PLACE_PAGES = ["products", "activity"] as const;
export type PlacePage = (typeof PLACE_PAGES)[number];

export const PLACE_PAGE_LABEL: Record<PlacePage, string> = {
  // THE SHOP AND THE CONFIG ARE ONE LIST (MESITA-1973). `products` named a
  // catalogue that only stated facts, while every switch lived on a product's
  // own view — so a product existed twice and the two could disagree, which is
  // the bug MESITA-1953 had to work around on the Visits card. Setup is the
  // one list: Off says what a product does, On says how it is set.
  // PRODUCTS AGAIN (MESITA-1986). Pato: *"rename setup to products"*, which
  // reverses MESITA-1973's `products` → `setup`. That rename was made on the
  // argument that Setup is the ONE list where Off says what a product does and
  // On says how it is set; the list did not change, but what you open from it
  // did — every row now leads to that product's own screen, and a screen per
  // product is a catalogue of products rather than a page of settings.
  //
  // SETUP, A THIRD TIME (MESITA-2001). Pato: *"rename products to setup"*.
  // What settles it is what MESITA-1986 leaned on and what has happened
  // since: a screen per product was going to make this a catalogue, and the
  // panes did not become catalogue pages. Every one of them is a form, a
  // dial, or a stated absence — the Bookings table left for Activity in
  // MESITA-1986 itself. The sibling tab is Activity, and Setup / Activity is
  // the pair an operator can hold: how it is configured, and what it did.
  // Products / Activity is a noun beside a verb.
  //
  // THE LABEL ONLY. The route segment stays `/products`: renaming it touches
  // `product-routes.ts`, every `productHref` caller and the Activity twin,
  // and a pasted link is written down in blocker rows.
  products: "Setup",
  activity: "Activity",
};

/** THE MENU'S ROWS LEFT THIS FILE (MESITA-2004). `NavRow` and `NAV_ROWS` held
 *  the four destinations MESITA-1975 drew across one ink line; the menu is a
 *  COLUMN again and it holds fifteen, so its list lives in `lib/sidebar-rows.ts`
 *  beside `PRODUCT_ORDER`, which is where ten of those fifteen come from.
 *
 *  THIS FILE IS THE ROUTE VOCABULARY AGAIN, and only that. The reason it is
 *  worth keeping the two apart is written a few lines up: `place-tabs.ts`
 *  imports a VALUE from here and this file imports only a TYPE back, because a
 *  value import in the other direction closes a cycle in a permission matrix
 *  and a cycle there evaluates to `undefined`, which reads as "allowed". A menu
 *  that needs `PRODUCT_ORDER` would have dragged that risk into this file. */

/** The two labels that are not a `PlacePage`.
 *
 *  Kept because `[flat]` and the screen-title reader still name them. The menu
 *  reads `SIDEBAR_*_LABEL` in `sidebar-rows.ts`. */
export const NAV_HOME_LABEL = "Place";
export const NAV_SETTINGS_LABEL = "Settings";

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
  products: "/products",
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
