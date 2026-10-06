// The place's views, and who may see which.
//
// Snapshot of `apps/web-business/src/lib/place-tabs.ts`. Client-safe: the rail
// applies both matrices below to the viewer's own role on every navigation.
//
// `PLACE_PAGES` IS A VALUE IMPORT AND THAT IS SAFE TODAY — `console-routes.ts`
// imports only a TYPE from here, which is erased, so there is no runtime edge
// back and no cycle. Do not add a value import there; `pagesForAccess` would
// become a cycle, and a cycle in a permission matrix is an undefined at module
// evaluation, which reads as "allowed".
import { PLACE_PAGES, type PlacePage } from "@/lib/console-routes";
import { PRODUCT_LABEL } from "@/lib/product-keys";

// MENUS AND REVIEWS ARE NOT HERE (MESITA-1917). They are CARDS ON PROFILE
// now, not views, so there is no name for `PlaceTabGate` to admit and
// `/places/<id>/menus` 404s like any other name off this contract. Neither
// ever had a rail row to lose — MESITA-1900 set the rail to Pato's eight
// products and neither was among them.
export const PLACE_TABS = [
  "profile",
  "visits",
  "orders",
  "reservations",
  "rewards",
  "pay",
  "credits",
  // Capital owes a tab (MESITA-1929) even while its page is a Soon strip.
  //
  // `PLACE_TABS` ⊇ `PRODUCT_KEYS` IS OVER (MESITA-1946). It held while the
  // suite was these six views plus Customers, and Pato's fifteen ended it:
  // Website, Ads, Terminal, the two bots and Intelligence have nothing to
  // open, and giving each an empty view to keep a containment true would be
  // six Soon strips nobody asked for. A product names its own view in
  // `lib/products.ts` now, or names none.
  "capital",
  "admin",
] as const;
export type PlaceTab = (typeof PLACE_TABS)[number];

export const PLACE_TAB_LABEL: Record<PlaceTab, string> = {
  // PROFILE READS THROUGH TOO (MESITA-1963). It was the one product here
  // spelled as a literal, so the rail said "Profile" while its card said
  // "Mesita Profile" — the exact drift this issue removed from the other
  // thirteen. Only `rewards` and `admin` may be literals, because neither is
  // a product in the catalogue.
  profile: PRODUCT_LABEL.profile,
  visits: PRODUCT_LABEL.visits,
  orders: PRODUCT_LABEL.orders,
  reservations: PRODUCT_LABEL.reservations,
  // A VIEW WITHOUT A CARD (MESITA-1953). Rewards merged into Member Visits
  // in the catalogue; the strategy dial stayed here, because one product's
  // state must be settable in exactly one place. The label is a literal now
  // — there is no `PRODUCT_LABEL.rewards` to read.
  rewards: "Rewards",
  pay: PRODUCT_LABEL.pay,
  credits: PRODUCT_LABEL.credits,
  capital: PRODUCT_LABEL.capital,
  admin: "Admin",
};

export type PlaceRole = "owner" | "editor" | "viewer";

export type ViewerAccess = {
  held: boolean;
  role: PlaceRole | null;
  isSuperAdmin: boolean;
};

/** HIDDEN IS NOT PROTECTED. The rail drops a row it may not show; this is the
 *  matrix that decides, and `PlaceTabGate` 404s anything outside it — because a
 *  view reachable by typing its address is a view. */
export function tabsForAccess(access: ViewerAccess): PlaceTab[] {
  if (!access.held) return ["profile"];
  const tabs: PlaceTab[] =
    access.role === "viewer"
      ? // ONE VIEW, and that is not a narrowing (MESITA-1917). A viewer's three
        // were Profile, Menus and Reviews; the other two are cards on the first
        // one now, so the same person still reads the same things.
        ["profile"]
      : [
          "profile",
          "visits",
          "orders",
          "reservations",
          "rewards",
          "pay",
          "credits",
          "capital",
        ];
  if (access.isSuperAdmin) tabs.push("admin");
  return tabs;
}

/** The PAGES this caller may open under a place — `/places/<id>/{settings,
 *  products,customers,activity}` and `products/pay` beneath them.
 *
 *  THE GATE THE RAIL USED TO RUN BY ACCIDENT. Every product row went through
 *  `tabsForAccess`, so a viewer's rail came out as Profile alone — and that
 *  was the ONLY role check standing between a viewer and the four pages,
 *  because the four are STATIC segments beside `[view]`: `PlaceTabGate` never
 *  sees them, and `useHeldPlaceOrNull` answers "is this place held", never "as
 *  what". MESITA-1933 took the product rows off the rail, which would have
 *  left that gate with nothing to filter and all three remaining pages open,
 *  with every check green. So the gate is written down now instead of ridden.
 *
 *  ONE MATRIX, TWO READERS: the rail drops the row from this, and each page
 *  refuses the address from this. Hidden is not protected — a page reachable
 *  by typing its address is a page, whatever the rail chose to draw.
 *
 *  ALL OR NOTHING, DERIVED. Every `PlacePage` is a surface where the place is
 *  configured, bought for or audited, so there is no page a viewer may have
 *  and the answer is the whole list or the empty one. Deriving it means a page
 *  added to `PLACE_PAGES` cannot be left out of this by forgetting. The day
 *  one of them becomes readable by a viewer, this stops being all-or-nothing
 *  and has to name its list. */
export function pagesForAccess(access: ViewerAccess): PlacePage[] {
  if (!access.held || access.role === "viewer") return [];
  return [...PLACE_PAGES];
}

export function placeTabHref(placeId: string, tab: PlaceTab): string {
  return `/places/${encodeURIComponent(placeId)}/${tab}`;
}

export function placeTabFromPathname(pathname: string): PlaceTab | null {
  const seg = pathname.split("/")[3];
  return (PLACE_TABS as readonly string[]).includes(seg ?? "")
    ? (seg as PlaceTab)
    : null;
}
