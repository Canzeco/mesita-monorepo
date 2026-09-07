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
  // DISCOVER — the shared route namespace under both Home and Search
  // (MESITA-1609). Five segments still live here; only four sit in the mode
  // rail now.
  //
  // SEGMENTS MATCH LABELS HERE, which is the exception in this codebase rather
  // than the rule (Activity routes at /inbox, Pay at /new-visit, Wallet at
  // /new-visit/wallet). It is deliberate, and it is what makes a relabel a
  // ROUTE rename: renaming a pill without moving its segment breaks the rule
  // silently.
  //
  // SEARCH LEFT THE RAIL FOR ITS OWN TAB (Pato, MESITA-1609). It spent
  // 2026-09-01 through today merged into Discover, because Home had nothing
  // live behind it; that reasoning doesn't survive Home getting a real body
  // again (Catalog · Swipe · Chat · Favs). The route is untouched —
  // /discover/search is still the map + the one search bar — only its
  // address in the bottom bar changes, from a mode pill to a top-level tab.
  //
  // CATALOG, SWIPE, CHAT, FAVS now live under the HOME tab's mode rail
  // (DiscoverModeNav, four columns). CatalogRails carries no search bar — two
  // typed inputs one pill apart was the redundancy Search's original merge
  // was fixing, and that redundancy risk doesn't return: Search isn't in
  // this rail to collide with anything.
  //
  // CATALOG, NOT HOME, is still the mode's own name (Pato, 2026-09-02 call,
  // untouched by MESITA-1609): the `catalog` mode key, CatalogRails,
  // `consumer-web-list-catalog`, the Catalog column in the admin Discovery
  // matrix, and Docs > Discovery's mode list all still say Catalog. The TAB
  // wrapping it is named Home; the MODE inside it is still named Catalog —
  // the same two-name shape Activity/Inbox already lives with.
  //
  // Bare `/home` and every `/home/*` leaf are the retired hub's redirects and
  // 308 to the Discover default — which is Catalog again as of MESITA-1609,
  // reversing the 2026-09-01 call that pointed it at Search. Read the
  // redirect table in next.config.ts before touching either.
  //
  // All five are live. CatalogRails is Catalog's whole body; SocialFeed stays
  // on disk and mounts INTO Catalog when it un-parks, not as its own route.
  discover: "/discover",
  discoverTabs: {
    catalog: "/discover/catalog",
    search: "/discover/search",
    swipe: "/discover/swipe",
    chat: "/discover/chat",
    favs: "/discover/favs",
  },
  // DEFAULT IS BACK ON THE LEADING PILL (Pato, MESITA-1609), reversing the
  // "default is not first" call this same object made from 2026-09-01 to
  // today. That call existed because Search — the urgent, no-typing-needed
  // mode — sat buried behind Catalog's width win, so the pill you land on
  // and the pill that leads visually had to disagree on purpose. Once Search
  // left the rail entirely for its own tab, that disagreement has nothing
  // left to resolve: none of Home's remaining four modes (Catalog, Swipe,
  // Chat, Favs) carries Search's urgency, and Catalog is the calmest,
  // most reasonable entry among them. First-pill-is-default is not a relapse
  // here — it is the tension resolving because its cause left, not because
  // anyone forgot it existed. Activity's Alerts-leads/Visits-lands split is
  // UNCHANGED and is not this same argument — it stays off its lead for a
  // different, still-live reason (see inboxDefault below).
  discoverDefault: "/discover/catalog",
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
    // The bare /search tab, from before Discover existed. It forwards to
    // /discover/search, which is once again a map with a search bar on it — the
    // path is legacy, the destination is not a coincidence.
    search: "/search",
    // The map's segment while the rail called it Map. Search carries the map
    // now, so this is the forwarding address. It was the Discover default and
    // every /home* and /explore* pointed at it, so the bookmarks are real.
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
  // NO `discover` KEY (MESITA-1609, removed). One prefix stopped being
  // correct the moment Search left the mode rail for its own tab: Home and
  // Search now need to light DIFFERENT bottom tabs from the same /discover
  // namespace, so BottomNav matches each discoverTabs segment individually
  // instead of the whole prefix. Keeping this key around unused would have
  // been a stale, misleading shortcut back to the old one-tab assumption.
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
