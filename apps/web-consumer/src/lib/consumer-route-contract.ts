// Consumer route contract (canonical surface paths + modal paths).
// Keep this as the single source of truth so nav, headers, middleware, and
// route handlers don't drift into stringly-typed mismatches.
//
// FIRST STAGE (Pato, MESITA-2087, 2026-10-10). The consumer app is Citywide
// Catalog · Discovery Engines · Reservations Agent, and nothing else. Every
// Second Stage surface — Visits/THE TICKET, Wallet and Credits, cards, Orders,
// Diamond/Plan/classes, the referral Share deck, public gift links — is
// DELETED, not parked; its addresses live only in `legacy` below and 308 to
// the nearest live page.

export const CONSUMER_ROUTES = {
  onboard: "/onboard",
  // SEARCH — its own top-level route and bottom tab (MESITA-1616): the map +
  // the one search bar + Filters. `/discover/search` and `/discover/map` are
  // redirect SOURCES for the bookmarks those addresses shipped under.
  search: "/search",
  // Search's second pill (Pato, MESITA-2401: "Search, Chat, Filters"): Chat,
  // Soon for now. Chat left Home; /discover/chat 308s here.
  searchChat: "/search/chat",
  // DISCOVER — Home's namespace. ONE page since MESITA-2405: Home's header
  // is the location alone and Social is a row of the catalog's column
  // (/discover/social 308s to Places), as Favorites is. Favorites is a row of
  // the Places column (/discover/favs 308s to Places); Chat moved to Search.
  //
  // THE SWIPE ENGINE IS GONE (MESITA-2328): its EF, its ranking library and
  // its `discovery_config.swipe` slice retired together. The stored key was
  // dropped by the normalizers, never renamed.
  //
  // HOME'S RAIL IS PLACES · SOCIAL · CHAT · FAVS (Pato, 2026-10-12,
  // MESITA-2166: "no swipe nor scroll for the moment. Kill them."). Places is
  // the live catalog rails (MESITA-2254). Social, Chat and Favs stay Soon
  // (MESITA-2168). Swipe and Scroll are legacy 308s to Places.
  discover: "/discover",
  discoverTabs: {
    places: "/discover/places",
  },
  // PLACES LEADS (MESITA-2166): the default is the first pill.
  // route-structure T5b pins first-pill-is-default.
  discoverDefault: "/discover/places",
  place: {
    prefix: "/place/",
  },
  // The reservations LIST is Me › Reservations; the singular DETAIL stays at
  // /reservation/[id] — a booking is still a reservation.
  reservation: {
    prefix: "/reservation/",
  },
  // PAY IS ONE PAGE, AND IT IS THE SOON STATE (Pato, MESITA-2087: "Keep pay
  // but delete everything else. just the empty page with soon."). The tab
  // links here and lights here; nothing hangs underneath. Every former Pay,
  // Visit, Wallet, Credits and Order address 308s to this page.
  pay: "/pay",
  // Me is the hub: identity header + three pairs of DestTiles, each a real
  // page under (shell)/me/<box> (MESITA-1789). The `/me/[tab]` catch-all
  // 308s any other one-segment address onto the hub.
  me: "/me",
  mePages: {
    profile: "/me/profile",
    // Instagram is an identity fact (a handle + the 1,000 bar), independent
    // of anything priced — it stays (Pato, MESITA-2080).
    instagram: "/me/instagram",
    // Plan is back as a read-only page: Free, with Premium marked Soon
    // (MESITA-2134). It left the legacy list below the same day.
    plan: "/me/plan",
    settings: "/me/settings",
    settingsContact: "/me/settings/contact",
    notifications: "/me/notifications",
    reservations: "/me/reservations",
  },
  // Every address that shipped to production and no longer renders a page.
  // Each one has a next.config.ts redirect (route-structure T4 proves the
  // destination resolves, T7 proves the entry exists), in ONE hop. A prefix
  // (trailing slash) stands for the `:param` entry that catches it. Nothing
  // live belongs here: a redirect whose source is a page shadows the page.
  legacy: {
    profile: "/profile",
    // The referral Share deck and its older /invite address (MESITA-2087).
    share: "/share",
    invite: "/invite",
    // The AI mode's route before it was named for what it does.
    homeAi: "/home/ai",
    // Search's two week-long addresses under /discover (MESITA-1609/1616).
    discoverSearch: "/discover/search",
    discoverMap: "/discover/map",
    // Catalog's day as Home, Swipe's week as the default, Catalog's segment.
    discoverHome: "/discover/home",
    discoverCatalog: "/discover/catalog",
    // Scroll's feed (MESITA-2163) and Swipe's card stack (MESITA-2166).
    discoverScroll: "/discover/scroll",
    discoverSwipe: "/discover/swipe",
    // Favorites left Home's rail for the Places column (MESITA-2383).
    discoverFavs: "/discover/favs",
    // Chat left Home for the Search tab (MESITA-2401).
    discoverChat: "/discover/chat",
    // Social left Home's header for the catalog's column, and the Places
    // test tab (MESITA-2402) was deleted (MESITA-2405).
    discoverSocial: "/discover/social",
    places: "/places",
    // The Second Stage tab and everything under it (MESITA-2087). The QR
    // place list, THE TICKET, Wallet with Buy · Gift · Redeem · balance,
    // standalone Credits, the Order tab, the public gift landing, and every
    // /rewards, /pay/<sub> and /ticket era address. All 308 to `pay`.
    newVisit: "/new-visit",
    newVisitWallet: "/new-visit/wallet",
    visitPrefix: "/visit/",
    wallet: "/wallet",
    credits: "/credits",
    inboxCredits: "/inbox/credits",
    order: "/order",
    inboxOrders: "/inbox/orders",
    giftClaimPrefix: "/gift/",
    rewards: "/rewards",
    rewardsTicketPrefix: "/rewards/ticket/",
    payTicketPrefix: "/pay/ticket/",
    payTicketsPrefix: "/pay/tickets/",
    // Any one-segment child of Pay — the Visit-era section row (/pay/wallet,
    // /pay/qr). Pay itself is live; only what hung under it is legacy.
    payTabPrefix: "/pay/",
    ticketPrefix: "/ticket/",
    qr: "/qr",
    // Me's Second Stage boxes (MESITA-2087): the class ladder's pages, the
    // Diamond pair, Plan's Premium checkout, Visits, Metrics, Passport.
    // /me/plan itself is live again (MESITA-2134).
    meClass: "/me/class",
    meClassInvite: "/me/class/invite",
    meDiamond: "/me/diamond",
    meDiamondInvite: "/me/diamond/invite",
    meVisits: "/me/visits",
    meSettingsMetrics: "/me/settings/metrics",
    mePassport: "/me/passport",
    // Support's page (MESITA-2169). Terms and privacy live on Settings.
    meHelp: "/me/help",
    subscribe: "/subscribe/premium",
    // /web's anonymous dead end, deleted with anonymous sessions
    // (MESITA-2137). It lands on Home's deck, behind the sign-in wall.
    getTheApp: "/get-the-app",
    // Catalog's address, off the rail again (MESITA-2140).
    discoverFeed: "/discover/feed",
    notifications: "/notifications",
    inboxMine: "/inbox/my-activity",
    inboxGlobal: "/inbox/global-activity",
    inboxMineTab: "/inbox/mine",
    inboxGlobalTab: "/inbox/global",
    // The reservations LIST as a top-level tab route. The ONE legacy
    // address answered by a server page, (shell)/reservations/page.tsx,
    // rather than a next.config entry; the contract test names it as such.
    reservations: "/reservations",
    // Reservations under /saved, from when that was a tab.
    savedReservations: "/saved/reservations",
    savedReservationPrefix: "/saved/reservation/",
    // Place detail briefly had a dual path under /saved (Favorites-era).
    // Canonical is /place/[id]; this redirects there (MESITA-899).
    savedPlacePrefix: "/saved/place/",
  },
} as const;

export const CONSUMER_ROUTE_PREFIX = {
  // NO `discover` KEY — BottomNav matches each discoverTabs segment
  // individually for Home. NO `search` KEY either: Search is an exact
  // top-level segment with no siblings to disambiguate from.
  place: "/place",
  pay: "/pay",
  me: "/me",
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

/**
 * Does this path paint inside a routed modal shell?
 *
 * SlideOverShell opens with
 * `if (!isModalContractPath(pathname)) return null`, and it is this
 * predicate's ONLY consumer. So a new @modal intercept whose path is missing
 * here renders BLANK — URL changes, page underneath stays, nothing opens, and
 * typecheck/build/tests all stay green. `route-structure.test.tsx` T2 guards
 * that direction.
 *
 * The reverse is NOT an invariant: a path may sit outside this list and still
 * be a real route (it just renders full-page).
 */
export function isModalContractPath(pathname: string): boolean {
  return (
    pathname.startsWith(CONSUMER_ROUTES.place.prefix) ||
    pathname.startsWith(CONSUMER_ROUTES.legacy.savedPlacePrefix) ||
    pathname.startsWith(CONSUMER_ROUTES.reservation.prefix) ||
    pathname.startsWith(CONSUMER_ROUTES.legacy.savedReservationPrefix)
  );
}
