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

/** A rail row names HOME, a place PAGE, a place VIEW, or a PRODUCT.
 *
 *  Home carries no target because it HAS no target to carry: it is the place
 *  itself, at the place's own bare address, and a field naming which part of
 *  the place it meant would be the beginning of a second Home. */
export type RailRow =
  | { kind: "home" }
  | { kind: "page"; target: PlacePage }
  | { kind: "place"; view: PlaceRailView }
  | { kind: "product"; product: ProductKey };

/** The place views that keep a rail row OF THEIR OWN — NOT `PLACE_TABS`.
 *  Menus, Reviews and Admin keep their addresses and lost their rows. */
export const PLACE_RAIL_VIEWS = ["profile"] as const;
export type PlaceRailView = (typeof PLACE_RAIL_VIEWS)[number];

/** THE RAIL, in Pato's order and his groups. Account is not here: it is the
 *  person, and it renders last in every state including the failed read.
 *
 *  HOME IS FIRST AND ALONE (MESITA-1914). Its seam costs nothing to declare —
 *  `home` is a kind of its own, so `RAIL_GROUP_STARTS` derives the rule under
 *  it exactly as it derives the other three. The console used to open on
 *  Settings, which made an operator's first screen a thing to configure. */
export const RAIL_ROWS: readonly RailRow[] = [
  { kind: "home" },
  { kind: "page", target: "settings" },
  // ACTIVITY LEFT THE RAIL (MESITA-1924). Pato: "remove the activity from
  // sidebar menu" — said once every product page grew its own Activity half,
  // which is what made a place-level Activity row redundant as a DESTINATION.
  // The page keeps its address and its doors (Home, the ask bar): its feed is
  // the whole place's, every kind of event, which no single product's half
  // covers. A row is not the same thing as a page.
  { kind: "page", target: "products" },
  { kind: "product", product: "profile" },
  { kind: "product", product: "customers" },
  { kind: "product", product: "visits" },
  // REWARDS SITS UNDER VISITS (MESITA-1928), which reverses MESITA-1900's
  // filing of it with the money group. A reward is earned by closing a bill at
  // a table and by nothing else — never by an order, which is prepaid and has
  // no table — so the dial belongs beside the container it pays out on rather
  // than beside the Stripe account.
  { kind: "product", product: "rewards" },
  { kind: "product", product: "orders" },
  { kind: "product", product: "reservations" },
  { kind: "product", product: "pay" },
  { kind: "product", product: "credits" },
  // CAPITAL IS LAST, and it is money (MESITA-1929): cash now against meals the
  // place will serve later. A Soon product still gets a LIVE row — the rail
  // never dims, and the PAGE is where a product says it is not here yet.
  { kind: "product", product: "capital" },
];

/** Where the seams fall, as the INDEX of each row that opens a group —
 *  DERIVED from the array above rather than hand-typed beside it, so a row
 *  that moves cannot leave a seam behind where it used to be. */
// ── THE TWO SECTIONS (MESITA-1915) ─────────────────────────────────────────
//
// A rule in this column separates SECTIONS, and there are two of them: what
// you MANAGE about the venue, and the PRODUCTS you run on it. They are not a
// third list bolted beside `RAIL_ROWS` — a row's `kind` already says which
// side of the line it falls on, so the sections are that fact NAMED, and
// `RAIL_GROUP_STARTS` below derives the line from the same fact.
//
// THEY ARE HEADED AGAIN, which reverses MESITA-1844. Pato headed the rail's
// groups in MESITA-1842 and deleted the headers two issues later, because a
// column of eight rows under THREE titles is three lists. It is two titles
// over two sections now — and the eight products sit whole under one of them,
// which is the thing that was actually wrong.
//
// A HEAD IS NOT A ROW. It is an eyebrow: no address, no pill, no hover, no
// glyph column. The one row shape is untouched.
// THE SECOND ONE IS NOT CALLED "PRODUCTS", and the reason is one line above
// it in the column: `Products` is already a ROW — the catalogue, where an
// operator compares the eight and buys one — and it is the LAST row of the
// first section. A head reading "Products", wearing the catalogue's own mark,
// directly under a row reading "Products" wearing the same mark is two
// different things spelled and drawn identically, one line apart. "Your
// products" is the eight this place actually runs; the catalogue is where you
// get them.
export const RAIL_SECTIONS = [
  { key: "manage", label: "Manage" },
  { key: "products", label: "Your products" },
] as const;
export type RailSectionKey = (typeof RAIL_SECTIONS)[number]["key"];

/** Which section a row falls in.
 *
 *  ONE KIND IS NAMED AND THE REST FALL THROUGH, deliberately. Written the
 *  other way round — `kind === "page"` is Manage, everything else is products
 *  — a row kind added later lands silently in the PRODUCTS section, under a
 *  title that does not describe it, and draws a line where nobody asked for
 *  one. That is not hypothetical: `kind: "home"` arrived in the mock one issue
 *  after this rule was written. Products are the closed set; the rest is what
 *  you manage, whatever it is called next. */
export function railSectionOf(row: RailRow): (typeof RAIL_SECTIONS)[number] {
  return row.kind === "product" ? RAIL_SECTIONS[1] : RAIL_SECTIONS[0];
}

export const RAIL_GROUP_STARTS: readonly number[] = RAIL_ROWS.reduce<number[]>(
  (acc, row, i) => {
    const prev = RAIL_ROWS[i - 1];
    if (!prev) return acc;
    // ONE RULE (MESITA-1915): a group opens where the SECTION changes, and
    // nowhere else. It had a second — Pato's two blank lines inside the
    // products, at `visits` and at `rewards` — and he cut them on sight: *"the
    // lines only for to separate section stuff, (products whole products is
    // ONE sections)"*. A rule that sometimes means "new section" and sometimes
    // means "same section, new mood" teaches an operator to read neither, and
    // at eight rows the three sub-groups were three lists.
    //
    // IT ASKS THE SECTION, NOT THE `kind`. Comparing kinds directly drew a
    // line between two rows of the SAME section the moment a third kind
    // existed — `kind: "home"` landed in the mock while this was in review,
    // and would have opened a group above Settings that names nothing.
    if (railSectionOf(prev).key !== railSectionOf(row).key) acc.push(i);
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
