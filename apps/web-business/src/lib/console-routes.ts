// Route contract for the (shell) console — every href comes from here, and
// a test asserts each entry maps to a route file on disk.
//
// THE TWO IMPORTS ARE TYPE-ONLY AND VOCABULARY-ONLY, deliberately.
// `product-keys.ts` has no imports at all; `PlaceTab` is erased at compile
// time, so it cannot make the cycle `placeHref` below is written literally to
// avoid. Nothing here may reach the data layer — `shell-contract.test.ts`
// walks this file for exactly that.
import type { ProductKey } from "@/lib/product-keys";
import type { PlaceTab } from "@/lib/place-tabs";
//
// THE ADDRESS NAMES ITS SUBJECT (MESITA-1807, restored MESITA-1839).
//
// It rode every href as `?org=<id>` once: a query parameter every link had to
// carry, every page had to re-resolve, and the layout above the rail could not
// read at all. Dropping it on ONE link switched a multi-place operator's
// context out from under them. MESITA-1807 moved it into the path and that
// stopped.
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
// ── ONE SUBJECT (MESITA-1892) ─────────────────────────────────────────────
//
// There were two, and half this file was about the other one. `/orgs/<id>/…`
// held the organization's settings, its catalogue of products, its Stripe
// account, its customers and its numbers; `/places/<id>/…` held the venue's
// own views. The organization is gone — `partnered`, `legal_name`, `rfc`, the
// payment account and the members all live on `places` now — so every one of
// those addresses became the PLACE's, at the same segment under a different
// parent. Nothing was merged and nothing was invented; the layer was removed
// and the addresses fell one level:
//
//   /                          the resolver — your current place, else the
//                              catalogue (a 307, never cached)
//   /account                   the person: you, and the way out. The one page
//                              with no scope, and now the only switcher-free
//                              one there is.
//
//   /places                    THE CATALOGUE — the states matrix, the
//                              ?owned= filters, Claim and Release. It is not
//                              about ONE place, which is exactly why it sits
//                              above them all rather than under one.
//   /places/new                Add place — the search-and-claim ceremony
//
//   /places/<id>               NOT a page: a 307 onto Profile, and the one
//                              address that catches Stripe's stored
//                              `?connect=` and hands the query to Pay.
//   /places/<id>/settings      THE PLACE's own setup — who may touch it, and
//                              how an agent drives it. What you SET.
//             /products        THE CATALOGUE of products — the Mesita Partner
//                              banner and the eight product cards
//             /products/pay    Mesita Pay's own controls: the Stripe account,
//                              a seam, the switch. A SUB-STEP of the
//                              catalogue, never a rail row
//             /products/terminal  Mesita Terminal's Soon page
//             /customers       who keeps coming back (Soon)
//             /activity        this place's numbers
//
//   /places/<id>/profile       THE PLACE's nine views
//             /menus /reviews /visits /orders /reservations /pay /credits
//             /admin           super-admin only
//
//   /profile /menus /reviews /visits /orders /reservations /pay /credits
//   /admin /settings /products /customers /activity
//                              307 onto the address above, resolving the
//                              remembered place. With nothing selected they
//                              render the one next step (NoPlaceYet) rather
//                              than forwarding nowhere. ALL THIRTEEN ARE ONE
//                              ROUTE FILE (`(shell)/[flat]`): Next resolves
//                              static segments first, so every real route
//                              still wins and an unknown name 404s.
//
// WHAT WENT WITH THE LAYER. `/orgs/new` (there is no legal person to create),
// `/orgs/<id>/switch` (the switcher's cookie mechanism — one cookie left, and
// the place switcher is a plain link), and `/accept-org-invite` (its twin
// `/accept-invite` already existed and takes a `place_invites` token). Every
// `/orgs/…` address forwards from `next.config.ts`.
//
// `/places` AND `/places/new` ARE LIVE ADDRESSES AGAIN, and freeing them cost
// two PERMANENT redirect rules. Both forwarded to `/` from MESITA-1807, and a
// config rule runs BEFORE filesystem routes — so leaving either would make the
// catalogue and the ceremony unreachable with every check green, which is
// `/settings` in MESITA-1839 exactly. `legacy-redirects.test.ts` walks every
// address in this file through that table.
//
// `/places/<id>/settings` AND `/places/<id>/activity` COST TWO MORE, for the
// same reason and in the same commit: both were redirect sources (a retired
// place view, and Activity's move up to the organization), and both are the
// place's own pages now.
//
// `places/[id]/layout.tsx` resolves the 404 verdict ONCE, server-side; a place
// you do not hold and one that does not exist both answer 404, so the path is
// never an oracle for which places exist. The rail derives its scope from the
// pathname (lib/rail-scope.ts).
//
// `/` is a TEMPORARY redirect, never a permanent one: a 308 would be cached by
// browsers forever, and where `/` lands depends on which place you opened last.

export const SHELL_ROUTES = {
  root: "/",
  account: "/account",
  places: "/places",
  placesNew: "/places/new",
} as const;

// ── The place's pages ─────────────────────────────────────────────────────
//
// The pages a place has BESIDES its views, in the order the rail lists them.
// `PLACE_PAGES`, the contract's targets and the rail's targets are ONE list:
// every page address is a rail row and every rail row is a real address, so
// the two cannot drift. Members is not among them — it is CONTENT on Settings
// (MESITA-1847), not a door.
//
// `places` LEFT THIS LIST (MESITA-1892) and did not become a place page. The
// catalogue is the states matrix over every place you hold AND every place
// you could claim; scoping it under one place would be asking a venue to list
// its siblings. It is `SHELL_ROUTES.places`, above them all.
//
// `credits` IS NOT ONE EITHER (MESITA-1845, and it is a place VIEW since
// MESITA-1885) — `/places/<id>/credits` is a product view, and this list is
// the pages that are not views.

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

// ── THE RAIL, AS ONE ARRAY (MESITA-1879) ──────────────────────────────────
//
// ONE PLACE, and the ontology goes quiet. Pato, 2026-09-15: *"You can now only
// manage one place for organization … we still have the ontological structure
// for orgs and places in the future … so hidden keep the org and place it. but
// i only see it like simpler."*
//
// MESITA-1892 took the last step he was describing: the organization is not
// hidden any more, it is gone, and every row in this column is about the one
// place. The rows did not move and the seams did not move — the only thing
// that changed is that `{ kind: "org" }` became `{ kind: "page" }`, because
// Settings, Products, Customers and Activity are the PLACE's pages now.
//
// WHY SEVEN AND NOT FIVE. Pato drew five, with Products holding everything
// configurable. At the review gate he took seven: Menus and Reviews came back
// as rows because neither is configuration. Reviews is the read an independent
// venue opens daily, and *"configure all shit here"* excludes it by name;
// folding four jobs into one broad container moves them a click deeper without
// making the work smaller, which is how Pay › Wallet and business `/account`
// each ate two extra passes.
//
// CAPABILITIES, REWARDS, THE CATALOGUE AND ADMIN KEEP THEIR ADDRESSES AND
// LOSE THEIR ROWS. Capabilities and Rewards are reached from the product cards
// that already link into the place (`lib/products.ts`, `PRODUCT_VIEW`); the
// catalogue from Add place and the zero-place empty state; Admin by typing it.
// Hiding a row changes NOTHING about access: `tabsForAccess` is still the one
// matrix and `PlaceTabGate` still 404s a withheld tab.
//
// THIS ARRAY IS THE ONLY STATEMENT OF THE ROW LIST. The rail renders it, the
// contract test walks it, and every other mention in a docblock or a plan is
// prose about it. Two lists is how the rail ended up meaning three different
// things in one document.

/** A rail row names a place PAGE, a place VIEW, or a PRODUCT. The three
 *  spaces do not overlap, so the union is unambiguous and one lookup serves
 *  the whole column.
 *
 *  A PRODUCT ROW IS NOT A VIEW ROW EVEN WHEN IT OPENS A VIEW (MESITA-1885).
 *  Six of the eight products are configured on a view and two are not —
 *  Customers is a place page, Terminal is a Soon page — so "product" is the
 *  subject and `productRowHref` is the one function that knows which address
 *  each one actually has. Keying them by `PlaceRailView` would have forced the
 *  exceptions into a shape that does not fit them. */
export type RailRow =
  | { kind: "page"; target: PlacePage }
  | { kind: "place"; view: PlaceRailView }
  | { kind: "product"; product: ProductKey };

/** The place views that keep a rail row OF THEIR OWN. NOT `PLACE_TABS` —
 *  that is the full matrix of what a place HAS; this is what the column LISTS
 *  as a place view rather than as a product.
 *
 *  MENUS AND REVIEWS LEFT IT (MESITA-1885). They are Profile — the place's
 *  own description, split into three addresses in MESITA-1848 and given rows
 *  at the MESITA-1879 review gate — and Pato's product rail has room for the
 *  place ONCE. They keep their addresses and their access; only the row goes,
 *  and hidden is never protected: `tabsForAccess` is still the one matrix and
 *  `PlaceTabGate` still 404s a withheld tab. */
export const PLACE_RAIL_VIEWS = ["profile"] as const;
export type PlaceRailView = (typeof PLACE_RAIL_VIEWS)[number];

// ── THE RAIL IS THE PRODUCT LIST NOW (MESITA-1885) ────────────────────────
//
// Pato, 2026-09-15, drawing the sidebar:
//
//     Settings          Profile          Visits          Payments
//     Activity          Costumers        Orders          Credits
//     Products                           Reservations    Terminal
//
// ELEVEN ROWS IN FOUR GROUPS, and the groups are HIS blank lines. The console
// stops being a set of rooms and becomes the thing it sells: three rows about
// the business itself, then the eight products, grouped free · at the table ·
// money.
//
// THE SEAMS ARE HAIRLINES AND CARRY NO NAMES. MESITA-1842 headed the rail's
// groups by name and MESITA-1844 deleted the headers two issues later; the
// rule that survived is one row shape, no indent, one glyph. A blank line is
// not a heading, so `group` renders as the seam Account already wears and
// never as a label.
//
// MENUS AND REVIEWS LEFT. They are the place's own description — Profile —
// and this rail has room for the place once. Both keep their addresses and
// every viewer who could open them still can.

/** THE RAIL, in Pato's order and his groups. Account is not here: it is the
 *  person, it sits below the last seam, and it is the one row every state
 *  renders — including the failed read. */
export const RAIL_ROWS: readonly RailRow[] = [
  // The business itself. Products stays a row of its own: the catalogue is
  // where an operator COMPARES the eight and buys one, which is a different
  // job from configuring the one they already have.
  { kind: "page", target: "settings" },
  { kind: "page", target: "activity" },
  { kind: "page", target: "products" },
  // Free, and always on. Profile is the venue; Customers is its guests.
  { kind: "product", product: "profile" },
  { kind: "product", product: "customers" },
  // At the table.
  { kind: "product", product: "visits" },
  { kind: "product", product: "orders" },
  { kind: "product", product: "reservations" },
  // Money.
  { kind: "product", product: "pay" },
  { kind: "product", product: "credits" },
  { kind: "product", product: "terminal" },
];

/** Where the seam falls, as the INDEX of each row that opens a group. Derived
 *  from the array above rather than written twice — a hand-kept list of
 *  indices is a list that survives exactly one row move. */
export const RAIL_GROUP_STARTS: readonly number[] = RAIL_ROWS.reduce<number[]>(
  (acc, row, i) => {
    const prev = RAIL_ROWS[i - 1];
    if (!prev) return acc;
    // A group opens where the SUBJECT changes (pages → products), and
    // again inside the products at Pato's two blank lines.
    const changed = prev.kind !== row.kind;
    const productBreak =
      row.kind === "product" && (row.product === "visits" || row.product === "pay");
    if (changed || productBreak) acc.push(i);
    return acc;
  },
  [],
);

// ── WHERE A PRODUCT ROW LANDS (MESITA-1885) ───────────────────────────────
//
// Eight products, THREE kinds of address, and this is the only place that
// knows which is which:
//
//   the place's own view   visits · orders · reservations · pay · credits, and
//                          profile. Five of them are `ZONE_ROWS` zones — the
//                          ladder re-cut by product — and Profile is the place
//                          description it always was.
//   a place PAGE           customers. It is about the guests, which is a
//                          reading of the venue rather than a switch on it,
//                          so it has a page and not a view.
//   a product sub-page     terminal. No engine, no column, no switch: a
//                          SoonStrip under `products/`.
//
// PAY IS STILL SPLIT ACROSS TWO SCREENS AND THE ROW TAKES THE VIEW. The Stripe
// account and the Mesita Pay switch are at `/places/<id>/products/pay` — the
// SETUP, reached from the product card; the rung an operator flips day to day
// is the `pay` view. Both are the place's now (MESITA-1892), so the split is
// no longer org-versus-place: it is buying a product versus running it, which
// is the same split every other card makes. The row points where the work is,
// and the view links up to the setup.
//
// `placeHref` is the caller's, because only the rail knows which place is
// selected — and what to do when none is (the flat twin, which renders the
// next step rather than forwarding nowhere).
export function productRowHref(
  product: ProductKey,
  placeId: string,
  placeHref: (tab: PlaceTab) => string,
): string {
  if (product === "customers") return placePageHref(placeId, "customers");
  if (product === "terminal") return placeTerminalHref(placeId);
  // Every other product IS a place tab, and shares its spelling with one —
  // `PLACE_TABS` and `PRODUCT_KEYS` agree on all six by construction, which
  // `console-routes.test.ts` asserts in both directions rather than trusting.
  return placeHref(product as PlaceTab);
}

/** Mesita Terminal's page: a Soon strip under `products/`, and a real landing
 *  for the one row that has nothing else to open. */
export function placeTerminalHref(placeId: string): string {
  return `${placePageHref(placeId, "products")}/terminal`;
}

/** Is this Terminal's page? ONE reader for the rule, like every other
 *  segment→row question in this file.
 *
 *  It has to be asked separately because `placePageFromPathname` answers
 *  `null` here ON PURPOSE: `/products/terminal` is not the catalogue, so the
 *  Products row must not light for it. Without this the address would light
 *  NOTHING, which reads as a page outside the console. */
export function isPlaceTerminalPathname(pathname: string): boolean {
  return /^\/places\/[^/]+\/products\/terminal\/?$/.test(pathname);
}

/** The zero-place console: the rail is a FILTER over `RAIL_ROWS`, never a
 *  second array — and with the organization gone it keeps nothing.
 *
 *  It used to keep every ORGANIZATION row, because each was a real page that
 *  worked with no place at all. There is no such row any more: a page of a
 *  place, a view of a place and a product configured on a place all need one,
 *  and a row with no subject opens a page about nothing, which is the "a row
 *  lands somewhere real" law (MESITA-1833) failing quietly.
 *
 *  So the predicate changed and the shape did not — still a filter, still one
 *  array. The door a new operator needs is the Add place row the rail renders
 *  above these (`SHELL_ROUTES.placesNew`), which is where the pool and the
 *  ceremony both are. A rail with no door to the one thing a new operator came
 *  to do is a worse empty state than a muted row ever was. */
export const ZERO_PLACE_ROWS: readonly RailRow[] = RAIL_ROWS.filter(
  (r) => r.kind !== "page" && r.kind !== "place" && r.kind !== "product",
);

// THERE ARE NO DOORS LEFT (MESITA-1847). `members` was the last address with
// no rail row, reached through a chevron — and Pato: *"members and places in
// organization i mean, fuck nested things display shit there."* The people are
// ON Settings now, so the address has nothing left to be, and `PLACE_PAGES` is
// the whole vocabulary again. `/members` and `/orgs/<id>/members` forward.

const PLACES = SHELL_ROUTES.places;

/** A place PAGE's address. EVERY page is a named segment (MESITA-1846), so
 *  the rail draws its rows as siblings and their addresses look alike. The
 *  bare `${PLACES}/<id>` is a forwarder onto Profile, and the one thing that
 *  catches Stripe's stored `?connect=`. */
export function placePageHref(placeId: string, page: PlacePage): string {
  return `${PLACES}/${encodeURIComponent(placeId)}/${page}`;
}

/** The bare `/places/<id>`: not a page, and not a row the rail can light. It
 *  is the place's natural URL, where Stripe's months-old Account Links land,
 *  and a 307 onto Profile. */
export function placeRootHref(placeId: string): string {
  return `${PLACES}/${encodeURIComponent(placeId)}`;
}

/** The catalogue, optionally pre-filtered. No filter = both halves, which is
 *  the comparison view the merge (MESITA-1614) exists to protect. */
export function placesHref(owned?: PlacesOwned | null): string {
  return owned ? `${PLACES}?owned=${owned}` : PLACES;
}

/** Add place — the ceremony beside the catalogue. */
export function placesNewHref(): string {
  return SHELL_ROUTES.placesNew;
}

/** Mesita Pay's controls — the Stripe account, a seam, the switch
 *  (MESITA-1872). A SUB-STEP of the catalogue, exactly the shape Add place
 *  already is: an address beneath the page it belongs to, reached from that
 *  page, lighting that page's rail row. It is deliberately NOT in
 *  PLACE_PAGES — the rail must not grow a fifth page row for one product's
 *  setup.
 *
 *  It replaces a `#mesita-pay` anchor into a Section at the foot of the
 *  catalogue. Pato took that Section off the page (*"just leave the 8 boxes
 *  and the 1 partnership box shit"*), and an anchor into a box that no longer
 *  exists scrolls nowhere SILENTLY, which is the worst kind of dead link. A
 *  link that navigates cannot fail that way, and it is shareable, which the
 *  anchor never was. It is also where Stripe's stored `?connect=` lands. */
export function placePayHref(placeId: string): string {
  return `${placePageHref(placeId, "products")}/pay`;
}

/** Which PAGE of a place a pathname is, or null when it is not one.
 *
 *  A SUB-STEP READS AS ITS PAGE. Mesita Pay's controls
 *  (`/places/<id>/products/pay`, MESITA-1872) read as Products: it is the
 *  page's own next step, and a rail that went dark while an operator stood in
 *  one would be saying they had left the section they were plainly still in.
 *
 *  THE BARE `/places/<id>` ANSWERS NULL, which is the one difference from the
 *  organization's version of this reader. That address is a 307 onto PROFILE,
 *  a view — so the row that must not go dark in flight is Profile's, and
 *  `placeTabFromPathname` is the reader that answers for it. Claiming
 *  "settings" here would light the wrong row for the whole forward. */
export function placePageFromPathname(pathname: string): PlacePage | null {
  const match = pathname.match(
    /^\/places\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?\/?$/,
  );
  if (!match || match[1] === "new") return null;
  const [, , second, third] = match;
  if (!second) return null;
  if (second === "products") return third === undefined || third === "pay" ? "products" : null;
  if (third !== undefined) return null;
  return (PLACE_PAGES as readonly string[]).includes(second)
    ? (second as PlacePage)
    : null;
}

// ── The flat addresses ────────────────────────────────────────────────────

/** The scope-free names, all served by ONE route file (`(shell)/[flat]`).
 *
 *  `places` is deliberately NOT among them, and for the opposite reason it
 *  used to be: `/places` is now a LIVE page of its own — the catalogue — so a
 *  flat `places` would not merely fail to resolve, it would be shadowed by a
 *  real route. Next resolves static segments before dynamic ones. */
export const FLAT_ROUTES = {
  // The place's nine views. Capabilities and Rewards left with their views
  // (MESITA-1885) and the five PRODUCT views arrived in their place; both old
  // names are in the redirect table now, and a contract name a config rule
  // shadows is the MESITA-1839 trap, so neither may come back here.
  profile: "/profile",
  menus: "/menus",
  reviews: "/reviews",
  visits: "/visits",
  orders: "/orders",
  reservations: "/reservations",
  pay: "/pay",
  credits: "/credits",
  admin: "/admin",
  // The place's four PAGES. `payments` has no flat twin: it is not an address
  // at all any more (MESITA-1869), and the redirect table owns the name — a
  // contract name a config rule shadows is the MESITA-1839 trap.
  //
  // `settings` HAS one again (MESITA-1871): the permanent rule that claimed
  // `/settings` for `/capabilities` is deleted, so the name resolves instead
  // of being shadowed. That rule is why MESITA-1852 had to call the page
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
export function flatViewFromPathname(pathname: string): PlaceTab | null {
  const seg = pathname.replace(/\/$/, "");
  // DERIVED FROM `FLAT_ROUTES`, not written a second time (MESITA-1885). The
  // list used to be typed out here as well, and the two copies had to be kept
  // in step by hand across a nine-name rename — which is how a flat twin ends
  // up resolving while no row lights for it. Every place tab has a flat twin
  // and only place tabs do, so the entry's own key is the answer.
  for (const [tab, route] of Object.entries(FLAT_ROUTES)) {
    if (seg !== route) continue;
    return (PLACE_TAB_NAMES as readonly string[]).includes(tab)
      ? (tab as PlaceTab)
      : null;
  }
  return null;
}

/** The place tabs, spelled here so `flatViewFromPathname` can tell a view's
 *  twin from a page's without importing `PLACE_TABS` as a VALUE —
 *  `lib/place-tabs` is the module that may import this one, never the reverse
 *  (`placeHref` below is written literally for the same reason).
 *  `console-routes.test.ts` asserts the two lists are the same set. */
const PLACE_TAB_NAMES = [
  "profile",
  "menus",
  "reviews",
  "visits",
  "orders",
  "reservations",
  "pay",
  "credits",
  "admin",
] as const;

/** Which PAGE a flat pathname is, or null — the same courtesy for the four
 *  rows that are not views. */
export function flatPlacePageFromPathname(pathname: string): PlacePage | null {
  const seg = pathname.replace(/\/$/, "");
  for (const page of PLACE_PAGES) {
    if (seg === `/${page}`) return page;
  }
  return null;
}

// ── The catalogue's two filters (MESITA-1710) ─────────────────────────────
//
// `My Places` and `Public Places` are SAVED FILTERS on the one merged list:
// `?owned=mine` and `?owned=public` against `/places`. MESITA-1614 survives
// every change since untouched — the split is still a filter, the Owned column
// is still the fact, and the unfiltered list still shows both halves together
// so they can be compared.
//
// `org` WAS THE FIRST VALUE'S NAME until MESITA-1892, and it had to change
// with the fact underneath it: Owned used to mean "an organization holds this"
// and means "you hold this" now. A stale `?owned=org` in a bookmark is
// unrecognised, and `ownedFromParam` answers null for anything unrecognised —
// which shows the FULL list. That is the safe direction and the reason the
// rule is written that way; the dangerous one is a filter that empties a
// non-empty catalogue and reads as data loss.

export const PLACES_OWNED = ["mine", "public"] as const;
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

/** Which place a pathname is scoped to, or null. The catalogue (`/places`)
 *  and its ceremony (`/places/new`) name none — `new` is refused by name, and
 *  it was never a place id.
 *
 *  IT READS THROUGH EVERY DEPTH (MESITA-1892). It used to allow one optional
 *  view segment, which was the whole shape the place had; a place has PAGES
 *  under it now, and `/places/<id>/products/pay` is three deep. A reader that
 *  stopped at two would answer null there, and the rail would lose its scope
 *  on the one screen Stripe returns to. */
export function placeIdFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/places\/([^/]+)(?:\/.*)?$/);
  if (!match) return null;
  const id = decodeURIComponent(match[1]);
  return id === "new" ? null : id;
}

/** Re-attach a page's whole query string to another path.
 *
 *  Used by the console root and the bare place URL, both of which forward. The
 *  query is not decoration there: Stripe stores an Account Link's return_url
 *  when the link is minted, so a link created before MESITA-1727 shipped still
 *  points at `/?org=<id>&connect=return`. Drop the query and the operator
 *  finishes Stripe onboarding on a screen that knows neither which place they
 *  onboarded nor that they just came back.
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
