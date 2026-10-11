// Where a place lives in THIS app's address space — the one seam between the
// place surface (MESITA-2085/2086) and admin's routes:
// `/manage-single/<id>/<tab>`, under Manage › Single Place. The surface was
// shared with web-business, which mounted it at `/places/<id>/<tab>` until
// MESITA-2089 deleted that app. `placeTabHref` (lib/place-tabs.ts) and
// console-routes both read it.
export const PLACE_BASE = "/manage-single";

/** The route tree beneath `src/` that renders the surface — what the tests
 *  that scan the views read. */
export const PLACE_ROUTE_DIR = "app/(app)/manage-single/[id]";
