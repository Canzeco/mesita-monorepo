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
// Both imports are TYPE-ONLY and vocabulary-only, deliberately: nothing in
// this file may reach the data layer, and in this app there is no data layer
// to reach.
import type { ProductKey } from "@/lib/product-keys";
import type { PlaceTab } from "@/lib/place-tabs";

export const SHELL_ROUTES = {
  root: "/",
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

/** A rail row names a place PAGE, a place VIEW, or a PRODUCT. */
export type RailRow =
  | { kind: "page"; target: PlacePage }
  | { kind: "place"; view: PlaceRailView }
  | { kind: "product"; product: ProductKey };

/** The place views that keep a rail row OF THEIR OWN — NOT `PLACE_TABS`.
 *  Menus, Reviews and Admin keep their addresses and lost their rows. */
export const PLACE_RAIL_VIEWS = ["profile"] as const;
export type PlaceRailView = (typeof PLACE_RAIL_VIEWS)[number];

/** THE RAIL, in Pato's order and his groups. Account is not here: it is the
 *  person, and it renders last in every state including the failed read. */
export const RAIL_ROWS: readonly RailRow[] = [
  { kind: "page", target: "settings" },
  { kind: "page", target: "activity" },
  { kind: "page", target: "products" },
  { kind: "product", product: "profile" },
  { kind: "product", product: "customers" },
  { kind: "product", product: "visits" },
  { kind: "product", product: "orders" },
  { kind: "product", product: "reservations" },
  { kind: "product", product: "rewards" },
  { kind: "product", product: "pay" },
  { kind: "product", product: "credits" },
];

/** Where the seams fall, as the INDEX of each row that opens a group —
 *  DERIVED from the array above rather than hand-typed beside it, so a row
 *  that moves cannot leave a seam behind where it used to be. */
export const RAIL_GROUP_STARTS: readonly number[] = RAIL_ROWS.reduce<number[]>(
  (acc, row, i) => {
    const prev = RAIL_ROWS[i - 1];
    if (!prev) return acc;
    const changed = prev.kind !== row.kind;
    const productBreak =
      row.kind === "product" &&
      (row.product === "visits" || row.product === "rewards");
    if (changed || productBreak) acc.push(i);
    return acc;
  },
  [],
);

/** Every product has a place address. Customers is the exception and the only
 *  one: it is a PAGE under the place, not a view of it. */
export function productRowHref(
  product: ProductKey,
  placeId: string,
  placeHref: (tab: PlaceTab) => string,
): string {
  if (product === "customers") return placePageHref(placeId, "customers");
  return placeHref(product as PlaceTab);
}

/** The zero-place console: the rail is a FILTER over `RAIL_ROWS`, never a
 *  second list — at zero places every row names a place that does not exist,
 *  so the filter keeps none of them and the rail is Add place and Account. */
export const ZERO_PLACE_ROWS: readonly RailRow[] = RAIL_ROWS.filter(
  () => false,
);

export function placePageHref(placeId: string, page: PlacePage): string {
  return `/places/${encodeURIComponent(placeId)}/${page}`;
}

export function placeRootHref(placeId: string): string {
  return `/places/${encodeURIComponent(placeId)}`;
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
  profile: "/profile",
  menus: "/menus",
  reviews: "/reviews",
  visits: "/visits",
  orders: "/orders",
  reservations: "/reservations",
  rewards: "/rewards",
  pay: "/pay",
  credits: "/credits",
  admin: "/admin",
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
  if (!isFlatRoute(`/${name}`)) return null;
  return (PLACE_PAGES as readonly string[]).includes(name)
    ? null
    : (name as PlaceTab);
}

export function flatPlacePageFromPathname(pathname: string): PlacePage | null {
  const name = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  if (!isFlatRoute(`/${name}`)) return null;
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
