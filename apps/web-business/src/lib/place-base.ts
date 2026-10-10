// Where a place lives in THIS app's address space — the one seam between the
// shared place surface (shared/place-console, MESITA-2085) and each console's
// routes. Business: `/places/<id>/<tab>`. Admin: `/manage-single/<id>/<tab>`.
// `placeTabHref` (shared lib/place-tabs.ts) and this app's console-routes
// both read it, so the two can never disagree on the prefix.
export const PLACE_BASE = "/places";

/** The route tree beneath `src/` that renders the surface — what the shared
 *  tests that scan the views read, so they hold in both consoles. */
export const PLACE_ROUTE_DIR = "app/(shell)/places/[id]";
