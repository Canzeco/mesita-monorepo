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
  // DISCOVER — the first tab, and five modes under it.
  //
  // SEGMENTS MATCH LABELS HERE, which is the exception in this codebase rather
  // than the rule (Activity routes at /inbox, Pay at /new-visit, Wallet at
  // /credits). It is deliberate, and it is what makes a relabel a ROUTE rename:
  // renaming a pill without moving its segment breaks the rule silently.
  //
  // SEARCH IS THE MAP (Pato, 2026-09-01). A search bar is a control, and it
  // belongs on the surface it serves — the map is where a found place has
  // somewhere to land, and it is the only mode that also answers "what is near
  // me" with no query at all. So the typed control lives on the pins, and the
  // word Search names the mode that carries it.
  //
  // HOME is what is left once the bar moves off the list: CatalogRails on their
  // own, a browse surface with no query. It carries NO search bar — two typed
  // inputs one pill apart was the redundancy that started this.
  //
  // TWO "HOME" URLS EXIST AND THEY ARE NOT THE SAME SCREEN (Pato, 2026-09-01,
  // choosing the name over this objection). `/discover/home` is this mode.
  // Bare `/home` and every `/home/*` leaf are the RETIRED hub's redirects and
  // still 308 to the Discover default, which is Search. Do not "tidy" them to
  // point at /discover/home: they were the old hub's URLs, the hub is gone, and
  // the default is where a stale bookmark belongs. Read the redirect table in
  // next.config.ts before touching either.
  //
  // All five are live. CatalogRails is Home's whole body; SocialFeed stays on
  // disk and mounts INTO Home when it un-parks, rather than getting a route.
  discover: "/discover",
  discoverTabs: {
    home: "/discover/home",
    search: "/discover/search",
    swipe: "/discover/swipe",
    chat: "/discover/chat",
    favs: "/discover/favs",
  },
  // DEFAULT IS NOT FIRST, deliberately — the same call Activity makes with bare
  // /inbox landing on Visits while Alerts leads the row. Home leads because
  // browsing is the calmer entry, but a guest opening Discover wants the map:
  // it needs no typing and answers "what is near me" on its own. Every /home*,
  // /explore* and /search 308 points straight here, never through
  // /discover/map — that segment is a 308 itself now, and route-structure T4
  // caps a chain at exactly 2 hops with no margin.
  discoverDefault: "/discover/search",
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
    // PAY IS A CONTAINER NOW (Pato, 2026-09-01): New · Wallet.
    //
    // New is the bare route — pick a place, start a visit. Wallet is the money
    // you hold, moved here from Activity because a wallet holds INSTRUMENTS and
    // Activity holds EVENTS. /inbox/credits 308s to it.
    //
    // The section labels are New and Wallet; the segments are `/new-visit` and
    // `/new-visit/wallet`. Same shape as Inbox: container + sections, bare route
    // is the default.
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
  // It lights the INBOX tab (see BottomNav matchPrefixes) because that is
  // where the list lives — exactly how /reservation/[id] behaves.
  //
  // The OBJECT is still a ticket and the DB column is still `kind`. Only the
  // consumer-facing URL says visit. Do not let this cascade into a code or
  // column rename (MESITA-1062 eng review).
  visit: {
    prefix: "/visit/",
  },
  // ACTIVITY — the container tab, routed at /inbox. It holds four sections and
  // is named for none of them; naming it for the mechanism ("Agent") would
  // break the day places integrate directly.
  inbox: {
    root: "/inbox",
    // FOUR sections, and the ORDER is the product decision (Pato, 2026-09-01):
    //
    //   Alerts · Visits · Orders · Reservations
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
    orders: "/inbox/orders",
    reservations: "/inbox/reservations",
  },
  inboxDefault: "/inbox/visits",
  // The Me tab is a single flat page — identity hero + modular boxes that open
  // as modals (Class, Settings, …). There are NO nested tab routes yet; /me is
  // the whole surface. Legacy /me/class, /me/settings and /me/plan redirect
  // here. Promoting those to real @modal-intercepted routes is the next stage.
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
    // The bare /search tab, from before Discover existed. It forwards to
    // /discover/search, which is once again a map with a search bar on it — the
    // path is legacy, the destination is not a coincidence.
    search: "/search",
    // The map's segment while the rail called it Map. Search carries the map
    // now, so this is the forwarding address. It was the Discover default and
    // every /home* and /explore* pointed at it, so the bookmarks are real.
    discoverMap: "/discover/map",
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
  // One prefix for all five Discover modes. /search is a legacy redirect
  // source now, not a surface, so it needs no prefix.
  discover: "/discover",
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
