import { tabsForAccess, type PlaceTab, type ViewerAccess } from "@/lib/place-tabs";

// THE ADMIN OPERATOR HOLDS EVERY PLACE (decision: MESITA-2086). The shared
// matrix (`tabsForAccess`) answers for a viewer by what they hold and what
// role they hold it as; the admin console is the super-admin's cockpit, and
// every write it reaches is an admin-web-* door gated on super-admin alone
// (MESITA-2090), so the honest access to publish is owner + super-admin —
// every view, Admin included. Published once, from here, so the layout's tab set,
// the gate and the rail row cannot disagree.
export const ADMIN_PLACE_ACCESS: ViewerAccess = {
  held: true,
  role: "owner",
  isSuperAdmin: true,
};

// THE MVP FIRST STAGE IS TWO VIEWS (MESITA-2088). Pato, 2026-10-10: "Admin
// manages the profiles in manage single." Profile is the profile editor;
// Admin holds the facts and the Crenup buttons. Visits, Orders, Reservations,
// Rewards, Pay, Credits and Capital are Second Stage, and so are the two
// pages the business console added (Setup's shop, Activity's receipts) — all
// deleted here, routes and pills.
export const FIRST_STAGE_TABS = ["profile", "admin"] as const satisfies readonly PlaceTab[];

/** The views Single Place draws: the matrix's grant, cut to First Stage. */
export function adminPlaceTabs(): PlaceTab[] {
  return tabsForAccess(ADMIN_PLACE_ACCESS).filter((t) =>
    (FIRST_STAGE_TABS as readonly PlaceTab[]).includes(t),
  );
}
