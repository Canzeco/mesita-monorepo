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
//            /products         THE CATALOGUE — the Mesita Partner banner and
//                              the eight product cards, and nothing else
//            /products/pay     Mesita Pay's own controls: the Stripe account,
//                              a seam, the switch. A SUB-STEP of the
//                              catalogue, never a rail row
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

// ── THE RAIL, AS ONE ARRAY (MESITA-1879) ──────────────────────────────────
//
// ONE PLACE PER ORGANIZATION, and the ontology goes quiet. Pato, 2026-09-15:
// *"You can now only manage one place for organization … we still have the
// ontological structure for orgs and places in the future … so hidden keep the
// org and place it. but i only see it like simpler."*
//
// So the two selectors go and the rows flatten into one column at one depth.
// The organization is still what most of these addresses are ABOUT — Settings,
// Products, Customers and Activity are all `/orgs/<id>/…` — but an operator
// who holds exactly one place has no question the word "Organization" answers,
// and a selector with one option to select is a control over nothing.
//
// WHY SEVEN AND NOT FIVE. Pato drew five, with Products holding everything
// configurable. At the review gate he took seven: Menus and Reviews came back
// as rows because neither is configuration. Reviews is the read an independent
// venue opens daily, and *"configure all shit here"* excludes it by name;
// folding four jobs into one broad container moves them a click deeper without
// making the work smaller, which is how Pay › Wallet and business `/account`
// each ate two extra passes.
//
// CAPABILITIES, REWARDS, PLACES AND ADMIN KEEP THEIR ADDRESSES AND LOSE THEIR
// ROWS. Capabilities and Rewards are reached from the product cards that
// already link into the place (`lib/products.ts`, `PRODUCT_VIEW`); Places from
// Add place and the zero-place empty state; Admin by typing it. Hiding a row
// changes NOTHING about access: `tabsForAccess` is still the one matrix and
// `PlaceTabGate` still 404s a withheld tab.
//
// THIS ARRAY IS THE ONLY STATEMENT OF THE ROW LIST. The rail renders it, the
// contract test walks it, and every other mention in a docblock or a plan is
// prose about it. Two lists is how the rail ended up meaning three different
// things in one document.

/** A rail row names an organization page, a place view, or a PRODUCT. The
 *  three spaces do not overlap, so the union is unambiguous and one lookup
 *  serves the whole column.
 *
 *  A PRODUCT ROW IS NOT A PLACE ROW EVEN WHEN IT OPENS A PLACE VIEW
 *  (MESITA-1885). Five of the eight products are configured on the place and
 *  three are not — Customers is an organization page, Pay's organization half
 *  is another, Terminal is a Soon page — so "product" is the subject and
 *  `productRowHref` is the one function that knows which address each one
 *  actually has. Keying them by `PlaceRailView` would have forced the three
 *  exceptions into a shape that does not fit them. */
export type RailRow =
  | { kind: "org"; target: OrgTarget }
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
//
// THIS ARRAY IS THE ONLY STATEMENT OF THE ROW LIST. The rail renders it, the
// contract test walks it, and every other mention in a docblock or a plan is
// prose about it. Two lists is how the rail ended up meaning three different
// things in one document.

/** THE RAIL, in Pato's order and his groups. Account is not here: it is the
 *  person, it sits below the last seam, and it is the one row every state
 *  renders — including the failed read. */
export const RAIL_ROWS: readonly RailRow[] = [
  // The business itself. Products stays a row of its own: the catalogue is
  // where an operator COMPARES the eight and buys one, which is a different
  // job from configuring the one they already have.
  { kind: "org", target: "settings" },
  { kind: "org", target: "activity" },
  { kind: "org", target: "products" },
  // Free, and always on. Profile is the place; Customers is the organization.
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
    // A group opens where the SUBJECT changes (business → products), and
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
//   an organization page   customers. It is about the guests of every place
//                          the organization holds, so there is no place to
//                          scope it to.
//   a product sub-page     terminal. No engine, no column, no switch: a
//                          SoonStrip under `products/`.
//
// PAY IS SPLIT ACROSS TWO LEVELS AND THE ROW TAKES THE PLACE'S. The
// organization's Stripe account and its `mesita_pay_enabled` switch are at
// `/orgs/<id>/products/pay`; the rung an operator flips per place is on the
// place. The row points where the work is, and the place view links up.
//
// `placeHref` is the caller's, because only the rail knows which place is
// selected — and what to do when none is (the flat twin, which renders the
// next step rather than forwarding nowhere).
export function productRowHref(
  product: ProductKey,
  orgId: string,
  placeHref: (tab: PlaceTab) => string,
): string {
  if (product === "customers") return orgHref(orgId, "customers");
  if (product === "terminal") return orgTerminalHref(orgId);
  // Every other product IS a place tab, and shares its spelling with one —
  // `PLACE_TABS` and `PRODUCT_KEYS` agree on all six by construction, which
  // `console-routes.test.ts` asserts in both directions rather than trusting.
  return placeHref(product as PlaceTab);
}

/** Mesita Terminal's page: a Soon strip under `products/`, and a real landing
 *  for the one row that has nothing else to open. */
export function orgTerminalHref(orgId: string): string {
  return `${ORGS}/${encodeURIComponent(orgId)}/products/terminal`;
}

/** Is this Terminal's page? ONE reader for the rule, like every other
 *  segment→row question in this file.
 *
 *  It has to be asked separately because `orgTargetFromPathname` answers
 *  `null` here ON PURPOSE: `/products/terminal` is not the catalogue, so the
 *  Products row must not light for it. Without this the address would light
 *  NOTHING, which reads as a page outside the console. */
export function isOrgTerminalPathname(pathname: string): boolean {
  return /^\/orgs\/[^/]+\/products\/terminal\/?$/.test(pathname);
}

/** The zero-place console: the rail is a FILTER over `RAIL_ROWS`, never a
 *  second array.
 *
 *  It drops the PLACE rows and keeps every organization row. The place rows go
 *  because a place row with no place opens a page about nothing, which is the
 *  "a row lands somewhere real" law (MESITA-1833) failing quietly. The
 *  organization rows stay because each is a real page that works with no place
 *  at all — and because Products is where the eight cards say "Add a place"
 *  and link to the ceremony. A rail with no door to the one thing a new
 *  operator came to do is a worse empty state than a muted row ever was. */
export const ZERO_PLACE_ROWS: readonly RailRow[] = RAIL_ROWS.filter(
  (r) =>
    r.kind === "org" ||
    // THE TWO PRODUCTS THAT ARE NOT PLACE VIEWS SURVIVE (MESITA-1885). The
    // filter is about whether a row opens a page ABOUT A PLACE, not about
    // whether it is a product: Customers is the organization's guests and
    // Terminal is a Soon page, and both work perfectly with no place at all.
    // The other six are place views and would open a page about nothing.
    (r.kind === "product" && (r.product === "customers" || r.product === "terminal")),
);

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

/** Mesita Pay's controls — the Stripe account, a seam, the switch
 *  (MESITA-1872). A SUB-STEP of the catalogue, exactly the shape Add place
 *  already is: an address beneath the page it belongs to, reached from that
 *  page, lighting that page's rail row. It is deliberately NOT in ORG_PAGES —
 *  the rail must not grow a ninth row for one product's setup.
 *
 *  It replaces a `#mesita-pay` anchor into a Section at the foot of the
 *  catalogue. Pato took that Section off the page (*"just leave the 8 boxes
 *  and the 1 partnership box shit"*), and an anchor into a box that no longer
 *  exists scrolls nowhere SILENTLY, which is the worst kind of dead link. A
 *  link that navigates cannot fail that way, and it is shareable, which the
 *  anchor never was. It is also where Stripe's stored `?connect=` lands. */
export function orgPayHref(orgId: string): string {
  return `${orgHref(orgId, "products")}/pay`;
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
 *  A SUB-STEP READS AS ITS PAGE. The Add place ceremony
 *  (`/orgs/<id>/places/new`) reads as Places, and Mesita Pay's controls
 *  (`/orgs/<id>/products/pay`, MESITA-1872) read as Products: each is the
 *  page's own next step, and a rail that went dark while an operator stood in
 *  one would be saying they had left the section they were plainly still in.
 *  `/switch` is never an address the rail lights — it is a redirect that
 *  exists for a few milliseconds. */
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
  if (second === "products") return third === undefined || third === "pay" ? "products" : null;
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
  // The place's nine. Capabilities and Rewards left with their views
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

/** The place tabs, spelled here so `flatViewFromPathname` can tell a place
 *  twin from an organization one without importing `PLACE_TABS` as a VALUE —
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
