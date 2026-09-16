// The place's views, and who may see which.
//
// Snapshot of `apps/web-business/src/lib/place-tabs.ts`. Client-safe: the rail
// applies `tabsForAccess` to the viewer's own role on every navigation.
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
  // `PLACE_TABS` ⊇ `PRODUCT_KEYS` is pinned both ways, so the ninth product
  // owes a tab (MESITA-1929) even while its page is a Soon strip.
  "capital",
  "admin",
] as const;
export type PlaceTab = (typeof PLACE_TABS)[number];

export const PLACE_TAB_LABEL: Record<PlaceTab, string> = {
  profile: "Profile",
  visits: PRODUCT_LABEL.visits,
  orders: PRODUCT_LABEL.orders,
  reservations: PRODUCT_LABEL.reservations,
  rewards: PRODUCT_LABEL.rewards,
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

export function placeTabHref(placeId: string, tab: PlaceTab): string {
  return `/places/${encodeURIComponent(placeId)}/${tab}`;
}

export function placeTabFromPathname(pathname: string): PlaceTab | null {
  const seg = pathname.split("/")[3];
  return (PLACE_TABS as readonly string[]).includes(seg ?? "")
    ? (seg as PlaceTab)
    : null;
}
