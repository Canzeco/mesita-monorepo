import type { ViewerAccess } from "@/lib/place-tabs";

// THE ADMIN OPERATOR HOLDS EVERY PLACE (decision: MESITA-2086). The shared
// matrix (`tabsForAccess`) answers for a viewer by what they hold and what
// role they hold it as; the admin console is the super-admin's cockpit, and
// every `business-web-*` write it reaches already bypasses membership for a
// super-admin, so the honest access to publish is owner + super-admin — every
// view, Admin included. Published once, from here, so the layout's tab set,
// the gate and the rail row cannot disagree.
export const ADMIN_PLACE_ACCESS: ViewerAccess = {
  held: true,
  role: "owner",
  isSuperAdmin: true,
};
