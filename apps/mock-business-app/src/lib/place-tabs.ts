// The place's views, and who may see which.
//
// Snapshot of `apps/web-business/src/lib/place-tabs.ts`. Client-safe: the rail
// applies `tabsForAccess` to the viewer's own role on every navigation.
import { PRODUCT_LABEL } from "@/lib/product-keys";

export const PLACE_TABS = [
  "profile",
  "menus",
  "reviews",
  "visits",
  "orders",
  "reservations",
  "rewards",
  "pay",
  "credits",
  "admin",
] as const;
export type PlaceTab = (typeof PLACE_TABS)[number];

export const PLACE_TAB_LABEL: Record<PlaceTab, string> = {
  profile: "Profile",
  menus: "Menus",
  reviews: "Reviews",
  visits: PRODUCT_LABEL.visits,
  orders: PRODUCT_LABEL.orders,
  reservations: PRODUCT_LABEL.reservations,
  rewards: PRODUCT_LABEL.rewards,
  pay: PRODUCT_LABEL.pay,
  credits: PRODUCT_LABEL.credits,
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
      ? ["profile", "menus", "reviews"]
      : [
          "profile",
          "menus",
          "reviews",
          "visits",
          "orders",
          "reservations",
          "rewards",
          "pay",
          "credits",
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
