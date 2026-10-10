// Where a place lives in THIS app's address space — the one seam between the
// shared place surface (shared/place-console, MESITA-2085/2086) and each
// console's routes. Admin: `/manage-single/<id>/<tab>`, under Manage › Single
// Place. Business: `/places/<id>/<tab>`. `placeTabHref` (shared
// lib/place-tabs.ts) and this app's console-routes both read it.
export const PLACE_BASE = "/manage-single";

/** The route tree beneath `src/` that renders the surface — what the shared
 *  tests that scan the views read, so they hold in both consoles. */
export const PLACE_ROUTE_DIR = "app/(app)/manage-single/[id]";
