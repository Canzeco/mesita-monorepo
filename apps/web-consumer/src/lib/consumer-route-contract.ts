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
  // DISCOVER — the first tab, and it is the map. `/home` and its five parked
  // mode routes were retired 2026-09-01.
  //
  // The hub had been Soon since 2026-08-28, so the leftmost tab — the one
  // wearing the brand mark — opened an empty state, and its pill row existed
  // to switch between ONE live surface and four coming-soon dialogs. Moving
  // the live map under `/home` was considered and rejected: `/home` existed to
  // hold the pill row, and once the row is cut there is nothing left to move
  // into. Deleting the tree was cheaper than restructuring around it.
  //
  // `/home` and every `/home/*` leaf 308 to here. The parked bodies live in
  // git history; `HomeModeNav`, `CatalogRails` and `SocialTab` stay on disk
  // under components/ so an un-park is a new route plus a mount, not a
  // rewrite.
  // DISCOVER — the first tab, and seven modes under it (2026-09-01).
  //
  // SEGMENTS MATCH LABELS HERE, which is the exception in this codebase rather
  // than the rule (Activity routes at /inbox, Pay at /new-visit, Wallet at
  // /credits). It is deliberate: the tab moved off /search precisely so the
  // typed mode could be a real segment instead of /search/search. Every /home*
  // and /explore* 308 repoints straight at /discover/map in the same change —
  // chaining them through /search would make each two hops, and
  // route-structure T4 caps at exactly 2 with no margin.
  //
  // NAME, not Search: this mode searches Mesita place NAMES, which is what
  // `consumer-web-suggest-places` actually does. It is also 4 characters
  // against Search's 6, worth 14px on a rail that already overflows.
  //
  // Two modes are live (map, name). The other five are parked with their
  // bodies on disk — swipe/, CatalogRails, AskAiTab, SocialFeed,
  // FavoritesList — so un-parking is a route plus a mount, not a rewrite.
  discover: "/discover",
  discoverTabs: {
    map: "/discover/map",
    name: "/discover/name",
    swipe: "/discover/swipe",
    catalog: "/discover/catalog",
    chat: "/discover/chat",
    social: "/discover/social",
    favorites: "/discover/favorites",
  },
  // Discover lands on the map: the only mode that needs no typing, and the only
  // one that answers "what is near me" without a query.
  discoverDefault: "/discover/map",
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
  },
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
  // Inbox — the container tab, and now genuinely ONE surface. It holds four
  // sections in this fixed order (Pato, 2026-08-16):
  //
  //   Credits · Visits · Orders · Reservations · Notifications
  //
  // The money section leads because money is what a guest checks first; the
  // rest still runs from the thing you're doing RIGHT NOW (a visit in
  // progress) out to the passive feed. THREE of these keys are labelled
  // differently on screen — `credits` reads Wallet, `reservations` reads
  // Bookings, `notifications` reads Alerts. A rename stops at the label, so
  // the route keys never follow. The tab itself is the same: /inbox, labelled
  // Activity.
  //
  // NOTE: this key order has NO runtime effect. Nothing iterates this object;
  // every consumer reads a named key. What the guest actually sees is
  // InboxSectionNav.SECTIONS, and the contract test pins THAT. Sections are real nested
  // routes so a section is linkable and the back button works between them;
  // bare /inbox redirects to the default (visits).
  //
  // This closes the half-state MESITA-1046 left behind: notifications used to
  // live at their own /inbox/mine + /inbox/global reached from Me, so the tab
  // named two different things. Both now redirect into the notifications
  // section and the tab is the only Inbox there is.
  inbox: {
    root: "/inbox",
    // Wallet (this key) LEADS the row but is deliberately NOT the default
    // (Pato, 2026-09-01). "First in the row" and "first to open" come apart here: a
    // visit in progress is time-critical and a balance never is, so tapping
    // Inbox while you are standing at a table must not detour through money.
    // inboxDefault below is `visits` on purpose — the contract test says so.
    credits: "/inbox/credits",
    visits: "/inbox/visits",
    orders: "/inbox/orders",
    reservations: "/inbox/reservations",
    notifications: "/inbox/notifications",
  },
  // Default landing for the Inbox tab — link straight here so the bare /inbox
  // redirect hop is only hit by direct URLs / legacy deep links.
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
    // The map's own route, for the ~6 hours between #1437 (which made /search
    // the Discover tab) and the seven-mode split that moved it to
    // /discover/map. Short-lived, but it WAS the live url and production
    // deployed it, so it forwards like any other.
    search: "/search",
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
  // One prefix for all seven Discover modes. /search is a legacy redirect
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
