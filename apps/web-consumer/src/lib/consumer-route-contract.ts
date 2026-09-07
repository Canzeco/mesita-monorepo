// Consumer route contract (canonical surface paths + modal paths).
// Keep this as the single source of truth so nav, headers, middleware, and
// route handlers don't drift into stringly-typed mismatches.
//
// DRIFT GUARD: apps/mobile-consumer/src/lib/consumer-route-contract.ts is the
// hand-mirrored mobile port of this file (same convention as ef.ts / tokens).
// Any change to routes or helpers here MUST update the mobile copy in the
// same PR — web/mobile IA parity is a product rule.

export const CONSUMER_ROUTES = {
  onboard: "/onboard",
  // The referral page is named Share — /share is canonical. /invite is the
  // legacy path (redirects here).
  share: "/share",
  // SEARCH — its own top-level route (MESITA-1616), not nested under
  // /discover any more. MESITA-1609 promoted Search to its own bottom tab
  // but left the URL at /discover/search, still wrapped by
  // discover/layout.tsx — which meant Home's mode rail kept rendering above
  // the map on the Search tab. That was a bug, not a design choice; this is
  // the real fix, a route move, not a CSS hide. Same screen (map + the one
  // search bar), new address. `/discover/search` is now a redirect SOURCE
  // (see next.config.ts) for the bookmarks #1567 shipped, briefly.
  search: "/search",
  // DISCOVER — Home's mode-rail namespace, and ONLY Home's now that Search
  // has moved out (MESITA-1616). Four segments, matching DiscoverModeNav's
  // four columns exactly — no more "one route the rail deliberately
  // excludes."
  //
  // SEGMENTS MATCH LABELS HERE, which is the exception in this codebase rather
  // than the rule (Activity routes at /inbox, Pay at /new-visit, Wallet at
  // /new-visit/wallet). It is deliberate, and it is what makes a relabel a
  // ROUTE rename: renaming a pill without moving its segment breaks the rule
  // silently.
  //
  // CATALOG, SWIPE, CHAT, FAVS live under the HOME tab's mode rail
  // (DiscoverModeNav, four columns). CatalogRails carries no search bar —
  // Search never shared this namespace's rail to begin with, once moved.
  //
  // CATALOG, NOT HOME, is still the mode's own name (Pato, 2026-09-02 call,
  // untouched by MESITA-1609/1616): the `catalog` mode key, CatalogRails,
  // `consumer-web-list-catalog`, the Catalog column in the admin Discovery
  // matrix, and Docs > Discovery's mode list all still say Catalog. The TAB
  // wrapping it is named Home; the MODE inside it is still named Catalog —
  // the same two-name shape Activity/Inbox already lives with.
  //
  // Bare `/home` and every `/home/*` leaf are the retired hub's redirects and
  // 308 to the Discover default. Read the redirect table in next.config.ts
  // before touching either.
  //
  // All four are live. CatalogRails is Catalog's whole body; SocialFeed stays
  // on disk and mounts INTO Catalog when it un-parks, not as its own route.
  discover: "/discover",
  discoverTabs: {
    swipe: "/discover/swipe",
    catalog: "/discover/catalog",
    chat: "/discover/chat",
    favs: "/discover/favs",
  },
  // SWIPE LEADS AND IS THE DEFAULT (Pato, MESITA-1615, live instruction),
  // reversing MESITA-1609's Catalog call from earlier today. First-pill-is-
  // default still holds as the property to preserve — Search left the rail
  // specifically so nothing here has to disagree with what's visually first
  // — it's just Swipe now, not Catalog. Activity's Alerts-leads/Visits-lands
  // split is UNCHANGED and is not this same argument — it stays off its lead
  // for a different, still-live reason (see inboxDefault below).
  discoverDefault: "/discover/swipe",
  // NO `favorites` KEY, deliberately. Saved places were `/home/favorites`, a
  // redirect to the hub's Soon state — `FavoritesList` exists under
  // components/ but nothing rendered it, and it needs `deckPlaces` from the
  // shared deck fetch, which is parked too. So Favorites was never live, and
  // promoting it to a top-level route here would have been an UN-PARK (a page
  // body plus a fetch), which this change does not do. The one caller, a place
  // detail's Save toast, dropped its "View" action rather than point at a map
  // that does not show saves. Restore both together when the deck un-parks.
  place: {
    prefix: "/place/",
  },
  // The reservations LIST is now an Inbox section (/inbox/reservations);
  // /reservations redirects there. The singular DETAIL stays at
  // /reservation/[id] — moving the list didn't rename the object, a booking
  // is still a reservation. /saved/* redirects here from the "Saved"-tab era.
  reservation: {
    prefix: "/reservation/",
  },
  // The centre tab: pick a place, start a visit. A VERB on purpose — it is
  // the primary action, and the visits LIST lives in Inbox > Visits, so this
  // surface only ever creates. /rewards, /pay and /qr all 308 here.
  newVisit: {
    root: "/new-visit",
    // PAY IS A CONTAINER AGAIN (Pato, 2026-09-06): New · Wallet.
    //
    // WALLET CAME BACK. It was Pay's second section from 2026-09-01, left for
    // a tab of its own at /wallet on 09-05, and returns here on 09-06 — the
    // whole round trip inside six days. The tab was argued from what a wallet
    // IS ("the money you hold is a destination, not a subsection"); it comes
    // back on what the BAR is: five tabs is one more top-level choice than the
    // guest has decisions, and the tab that pays for itself least is the one
    // holding a balance you check, not a thing you do. Pay is where that
    // balance gets spent, so it is where it is kept.
    //
    // Do not re-derive the tab from the "instruments, not events" argument
    // either — that argument only ever said Wallet is not ACTIVITY, and it is
    // still why Wallet is not a section of Inbox. It never said Wallet is not
    // Pay.
    //
    // New is the bare route — pick a place, start a visit. The section labels
    // are New and Wallet; the segments are `/new-visit` and `/new-visit/wallet`.
    // Same shape as Inbox: container + sections, bare route is the default.
    new: "/new-visit",
    wallet: "/new-visit/wallet",
  },
  // Pay lands on New: you open this tab standing in a place, not to check a
  // balance. Same reasoning as inboxDefault landing on Visits.
  newVisitDefault: "/new-visit",
  // A single visit — THE TICKET (reward -> task -> QR -> results). Top-level
  // sibling of /place and /reservation, not a child of /new-visit: you reach
  // it from the centre tab when you start one AND from Inbox > Visits when you
  // return to one, so it belongs to neither.
  //
  // It lights the ME tab now (see BottomNav matchPrefixes), not its own tab —
  // Activity retired as a bottom tab MESITA-1609, and the Visits box that
  // replaces it lives on Me. Same reasoning as always: the list is where you
  // land back, and the list's box now lives there.
  //
  // The OBJECT is still a ticket and the DB column is still `kind`. Only the
  // consumer-facing URL says visit. Do not let this cascade into a code or
  // column rename (MESITA-1062 eng review).
  visit: {
    prefix: "/visit/",
  },
  // ACTIVITY — not a bottom tab any more (MESITA-1609). Still routed at
  // /inbox, still holds three sections named for none of them (naming it for
  // the mechanism, "Agent," would break the day places integrate directly) —
  // but the DOOR into it is now three separate boxes on Me (Alerts, Visits,
  // Reservations), not a dedicated tab of its own. The container concept and
  // its three sections are unchanged; only the top-level chrome around it is.
  inbox: {
    root: "/inbox",
    // THREE sections, and the ORDER is the product decision (Pato, 2026-09-01,
    // Orders folded 2026-09-06 — MESITA-1389):
    //
    //   Alerts · Visits · Reservations
    //
    // Orders folded into Visits: it had no table, no Edge Function and no
    // type, so it was a pill that could never render anything. An order is a
    // visit you didn't sit down for, and it reappears as rows inside Visits
    // when it becomes real. /inbox/orders 308s to /inbox/visits.
    //
    // Wallet LEFT for Pay — Activity holds events, a wallet holds instruments,
    // and keeping it here was the category error named on 08-31. Alerts leads
    // now: it is the only section that can carry something you have not seen.
    //
    // `notifications` reads Alerts on screen. That is the last label/route
    // divergence in this object — `reservations` went back to reading
    // Reservations, so Bookings is gone.
    //
    // NOTE: this key order has NO runtime effect. Nothing iterates this object;
    // what the guest sees is InboxSectionNav.SECTIONS, and route-structure pins
    // THAT. Sections are real nested routes so each is linkable.
    notifications: "/inbox/notifications",
    visits: "/inbox/visits",
    reservations: "/inbox/reservations",
  },
  inboxDefault: "/inbox/visits",
  // The Me tab is a single flat page — identity hero + modular boxes that open
  // as modals (Class, Settings, …) or route out (Wallet, and now Alerts,
  // Visits, Reservations — MESITA-1609). There are NO nested tab routes for
  // /me itself; the surface stays flat, it just has more doors leading off
  // it now. Legacy /me/class, /me/settings and /me/plan redirect here.
  // Promoting those to real @modal-intercepted routes is the next stage.
  me: "/me",
  legacy: {
    profile: "/profile",
    // Premium checkout was a page until the plan became a sheet on Me
    // (MESITA-1129). Kept as a redirect, not deleted: this was the live URL,
    // and it is the one an external link-out would still carry. If iOS ever
    // needs a web purchase link for Apple review, it wants a real page again —
    // this redirect is the marker for where it used to live.
    subscribe: "/subscribe/premium",
    invite: "/invite",
    // The AI mode's route before it was named for what it does.
    homeAi: "/home/ai",
    // Wallet's route while it lived under Activity (#1430 -> 2026-09-01). It
    // was live in production, so the bookmarks are real; it 308s to Pay > Wallet.
    inboxCredits: "/inbox/credits",
    // Orders' route while it was its own Activity section (#1430 ->
    // 2026-09-06, MESITA-1389). Live in production, so the bookmarks are
    // real; it 308s straight to Visits, the section it folded into.
    inboxOrders: "/inbox/orders",
    // Wallet's route for the day it was a top-level TAB (#1492, 2026-09-05 ->
    // 09-06). It shipped to production, so its bookmarks are as real as the
    // other two, and like them it 308s STRAIGHT to /new-visit/wallet — never
    // through /inbox/credits, which would be the 3-hop chain T4 refuses.
    wallet: "/wallet",
    // /discover/search's address for the six days it lived there (MESITA-1609,
    // 2026-09-06, -> MESITA-1616, 2026-09-07). Shipped to production, so the
    // bookmarks are real; forwards STRAIGHT to the new canonical `search`
    // route — never through /discover/map, which would be the 2-hop chain
    // this file's other entries already avoid.
    discoverSearch: "/discover/search",
    // The map's segment while the rail called it Map, and while Search still
    // lived under /discover (2026-09-01 -> MESITA-1616). Forwards straight to
    // the canonical `search` route now, not through /discover/search — that
    // segment is itself a redirect source above, and chaining through it
    // would cost a second hop.
    discoverMap: "/discover/map",
    // Catalog's segment for the hour it shipped as Feed (#1447 -> #1448).
    discoverFeed: "/discover/feed",
    // And for the day it shipped as Home (#1448 -> 2026-09-02). Live in
    // production both times, so both bookmarks are real and both forward
    // STRAIGHT to /discover/catalog — never Feed through Home through Catalog,
    // which would be the 3-hop chain T4 refuses.
    discoverHome: "/discover/home",
    // The centre tab and its detail, before visit/order/reservation replaced
    // the word "ticket" in the consumer URL space.
    rewards: "/rewards",
    rewardsTicketPrefix: "/rewards/ticket/",
    meClass: "/me/class",
    meSettings: "/me/settings",
    mePlan: "/me/plan",
    notifications: "/notifications",
    inboxMine: "/inbox/my-activity",
    inboxGlobal: "/inbox/global-activity",
    // The notifications pair reached from Me, before Inbox became one surface
    // with four sections. Both fold into /inbox/notifications.
    inboxMineTab: "/inbox/mine",
    inboxGlobalTab: "/inbox/global",
    // The reservations LIST used to be its own top-level tab route.
    reservations: "/reservations",
    placePrefix: "/place/",
    reservationPrefix: "/reservation/",
    ticketPrefix: "/ticket/",
    // The Rewards surface used to be /pay; these paths redirect to /rewards.
    pay: "/pay",
    payTicketPrefix: "/pay/ticket/",
    payTicketsPrefix: "/pay/tickets/",
    // Reservations used to live under /saved when that was a tab.
    savedReservations: "/saved/reservations",
    savedReservationPrefix: "/saved/reservation/",
    // Place detail briefly had a dual path under /saved (Favorites-era).
    // Canonical is /place/[id]; this redirects there (MESITA-899).
    savedPlacePrefix: "/saved/place/",
  },
} as const;

export const CONSUMER_ROUTE_PREFIX = {
  // NO `discover` KEY (MESITA-1609, removed) — BottomNav matches each
  // discoverTabs segment individually for Home instead of one shared prefix.
  // NO `search` KEY either: Search moved to its own top-level route
  // (MESITA-1616) with no siblings to disambiguate from, so BottomNav
  // matches `CONSUMER_ROUTES.search` directly, an exact segment, not a
  // shared prefix.
  place: "/place",
  reservations: "/reservations",
  newVisit: "/new-visit",
  visit: "/visit",
  inbox: "/inbox",
  me: "/me",
  saved: "/saved",
} as const;

// Matches both the /reservations list and /reservation/[id] details
// (`/reservations`.startsWith(`/reservation`) is intentional).
export const CONSUMER_RESERVATION_SURFACE_PREFIX = "/reservation";

export function placePath(idOrSlug: string): string {
  return `${CONSUMER_ROUTES.place.prefix}${idOrSlug}`;
}

export function reservationPath(id: string): string {
  return `${CONSUMER_ROUTES.reservation.prefix}${id}`;
}

export function visitPath(id: string): string {
  return `${CONSUMER_ROUTES.visit.prefix}${id}`;
}

/**
 * Historical alias. The object is still a ticket everywhere below the URL —
 * the DB column, the EFs and the row types all still say ticket — so call
 * sites that are talking about the OBJECT keep reading naturally.
 */
export function ticketPath(id: string): string {
  return visitPath(id);
}

/**
 * Does this path paint inside a routed modal shell?
 *
 * SlideOverShell and BottomSheetShell both open with
 * `if (!isModalContractPath(pathname)) return null`, and they are this
 * predicate's ONLY consumers. So a new @modal intercept whose path is missing
 * here renders BLANK — URL changes, page underneath stays, nothing opens, and
 * typecheck/build/tests all stay green. `route-structure.test.tsx` T2 guards
 * that direction.
 *
 * The reverse is NOT an invariant: a path may sit outside this list and still
 * be a real route (it just renders full-page). /rewards/ticket/ used to be
 * listed here with no intercept behind it — inert, and removed with the
 * rename rather than carried forward as an inert /visit/ branch.
 */
export function isModalContractPath(pathname: string): boolean {
  return (
    pathname.startsWith(CONSUMER_ROUTES.place.prefix) ||
    pathname.startsWith(CONSUMER_ROUTES.legacy.savedPlacePrefix) ||
    pathname.startsWith(CONSUMER_ROUTES.reservation.prefix) ||
    pathname.startsWith(CONSUMER_ROUTES.legacy.savedReservationPrefix)
  );
}
