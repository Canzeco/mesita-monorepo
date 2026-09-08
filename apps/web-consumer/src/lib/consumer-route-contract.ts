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
  // has moved out (MESITA-1616). Five segments, matching DiscoverModeNav's
  // five columns exactly — no more "one route the rail deliberately
  // excludes."
  //
  // SEGMENTS MATCH LABELS HERE, which is the exception in this codebase rather
  // than the rule (Activity routes at /inbox, Pay at /new-visit, Wallet at
  // /new-visit/wallet). It is deliberate, and it is what makes a relabel a
  // ROUTE rename: renaming a pill without moving its segment breaks the rule
  // silently.
  //
  // SWIPE, FEED, CATALOG, CHAT, FAVS live under the HOME tab's mode rail
  // (DiscoverModeNav, five columns). CatalogRails carries no search bar —
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
  // All five are live. CatalogRails is Catalog's whole body.
  //
  // FEED IS A MODE AGAIN (Pato, MESITA-1621, live instruction: "add a new
  // subpage called feed — swipe, feed, catalog, chat, favs"). This file used
  // to say SocialFeed "mounts INTO Catalog when it un-parks, not as its own
  // route" — that is the line this change overturns, deliberately: the
  // component sat on disk with no surface at all from the hub's retirement
  // (2026-09-01) to now, and folding a people-feed into a grid of category
  // rails was always the awkward half of that plan. It gets the route.
  //
  // `/discover/feed` WAS A REDIRECT SOURCE and is not any more. It 308'd to
  // /discover/catalog for the hour the BROWSE mode shipped under the name
  // Feed (#1447 -> #1448). A next.config redirect shadows a real route
  // entirely, so that entry had to be deleted for this page to be reachable
  // — see the removal in next.config.ts, and note `legacy.discoverFeed` is
  // gone from the legacy block below for the same reason. The name is being
  // REUSED for a different mode, not restored to the old one, so those
  // hour-old bookmarks now land somewhere new. That is the accepted cost;
  // one hour of production traffic is not worth reserving the word forever.
  discover: "/discover",
  //
  // FOUR MODES NOW — Scroll · Feed · Chat · Favs (Pato, MESITA-1697, live
  // instruction, refined mid-review to "better call it scroll"). Swipe's
  // gesture deck is gone and Catalog's segment is gone; what each surviving
  // word means changed, so read the three notes below before touching this.
  //
  // SCROLL IS SWIPE'S SEGMENT, RENAMED. The card-stack deck became a vertical
  // one-card-per-screen scroll over the SAME card face. "Scroll" rather than
  // "Discover" because `/discover/discover` stutters, and because Scroll is
  // the narrower label in DiscoverModeNav's width budget.
  //
  // THE ENGINE KEY IS STILL `swipe`, AND THAT IS DELIBERATE. `swipe` is a
  // persisted key in `app_config.discovery_config`, the only entry in
  // WIRED_ENGINE_KEYS, a row in discovery-matrix.ts and its hand-mirrored
  // admin twin, and the mask for weightsForMode("swipe"). Renaming it would
  // make loadDiscoveryConfig read `undefined` and silently fall back to
  // DEFAULT_SWIPE, discarding every operator-tuned radius and partner bias in
  // the live config — and the two code twins pin EACH OTHER, so it would go
  // green. This is the same routes-never-follow-a-label shape the file already
  // lives with at Activity/`inbox` and Pay/`new-visit`.
  //
  // FEED IS CATALOG'S BODY AT FEED'S ADDRESS — the word's THIRD meaning in
  // eight days, and this is the deliberate record of that. It meant the
  // catalog rails for one hour on 2026-09-01 (#1447 -> #1448, reverted), then
  // the 2-wide deck grid from MESITA-1621, and now it is the rails again with
  // a filter control on top. The MESITA-1621 note below used to say the hour
  // -old bookmarks were "the accepted cost"; the same reasoning applies again
  // to the day-old ones, and the next reader should not mistake this for a
  // mistake — Pato named Feed, twice.
  //
  // CATALOG'S SEGMENT IS RETIRED, not its name: the mode key, CatalogRails,
  // `consumer-web-list-catalog` and the admin Discovery matrix all still say
  // catalog. Only the guest-facing address moved.
  discoverTabs: {
    scroll: "/discover/scroll",
    feed: "/discover/feed",
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
  discoverDefault: "/discover/scroll",
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
    // PAY IS A CONTAINER AGAIN (Pato, 2026-09-06): QR · Wallet.
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
    // are QR and Wallet; the segments are `/new-visit` and `/new-visit/wallet`.
    // Same shape as Inbox: container + sections, bare route is the default.
    new: "/new-visit",
    wallet: "/new-visit/wallet",
    // WALLET'S SUBROUTES ARE ROUTES, NOT SHEETS (Pato, 2026-09-08: "not modals
    // but actually views with full-screen with own screen"). This REVERSES the
    // call recorded on BalanceDetail four hours earlier, which read an older
    // instruction ("que se abra de abajo para arriba") as covering the whole
    // wallet. It covered the balance card's OPEN GESTURE, not the surfaces
    // hanging off the section header.
    //
    // The reversal is the right one on its own merits, and the sheet was
    // already straining: Buy is a purchase, Gift ends on a code someone has to
    // hand over, Redeem is reached by a guest who holds nothing, and a balance
    // detail is a statement with its own activity list. Every one of those is a
    // destination you can be sent to, land on cold, and press Back out of — the
    // definition of a route. A sheet has no URL, so none of it survived a
    // reload or could be linked at all.
    //
    // They are NOT @modal intercepts either, and that is the same decision
    // stated twice: an intercept would put them back in an overlay over the
    // wallet, which is the thing being reversed. Nothing here goes near
    // isModalContractPath.
    walletBuy: "/new-visit/wallet/buy",
    walletGift: "/new-visit/wallet/gift",
    // REDEEM IS IN THE SHELL, behind the auth wall, because it credits a
    // wallet and a wallet needs an account. The PUBLIC half of gifting — a link
    // that lands a stranger who has no account yet — is a different route that
    // does not exist yet (MESITA-1677); when it ships it is a top-level page
    // outside (shell) with its own T1 exemption, and it funnels into this one
    // after sign-in. Do not "fix" this by moving Redeem out of the wall.
    walletRedeem: "/new-visit/wallet/redeem",
    // One balance, opened. `balance/` rather than a bare [id] under wallet/:
    // Next.js does give static segments priority over a dynamic sibling, so
    // /new-visit/wallet/buy would still resolve, but a route map where three
    // words are pages and everything else is an id is a trap for the next
    // segment anyone adds.
    walletBalance: {
      prefix: "/new-visit/wallet/balance/",
    },
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
  // ACTIVITY IS NOT A SURFACE ANY MORE (MESITA-1626). MESITA-1609 took it off
  // the bottom bar and left a container with no tab, reachable only from three
  // Me boxes that each deep-linked straight past its own section nav — so the
  // first thing the guest saw after choosing a section was a row asking them
  // to choose again. Its three sections are sheets on Me now, and a sheet has
  // no URL, so there are no keys here to point at: every /inbox address 308s
  // to /me in next.config.ts.
  //
  // The CONCEPT survives unchanged — Alerts · Visits · Bookings, in that
  // order, Alerts leading because it is the only one that can carry something
  // you have not seen. What died is the routing, not the idea. If Activity
  // ever needs linkable URLs again (a push notification deep-linking to one
  // alert, say), it comes back as @modal-intercepted routes off /me rather
  // than as a container of its own.
  // The Me tab is a single flat page — identity hero + modular boxes that open
  // as modals — everything except Wallet, which routes out to Pay's own
  // Wallet section rather than growing a second copy of it (MESITA-1626).
  // There are NO nested tab routes for /me itself; the surface stays flat. Legacy /me/class, /me/settings and /me/plan redirect here.
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
    // NO `discoverFeed` KEY any more (MESITA-1621). /discover/feed spent an
    // hour as Catalog's segment (#1447 -> #1448) and 308'd here ever since;
    // it is a REAL ROUTE now — Home's Feed mode — and a redirect would
    // shadow it. The hour-old bookmarks land on the new mode instead of
    // Catalog. Deliberate: see discoverTabs above.
    //
    // Catalog's segment for the day it shipped as Home (#1448 -> 2026-09-02).
    // Live in production, so the bookmarks are real. It used to forward to
    // /discover/catalog; that segment is itself retired now (MESITA-1697), so
    // it forwards STRAIGHT to /discover/feed. Chaining it through
    // /discover/catalog would be the 2-hop this file refuses everywhere else.
    discoverHome: "/discover/home",
    // Swipe's segment, from the hub's retirement (2026-09-01) to MESITA-1697.
    // It was `discoverDefault` for that whole week — BottomNav's Home href,
    // the post-signin target, the onboarding target and place detail's
    // fallback all pointed here — so these are the realest bookmarks in the
    // consumer surface. 308s to /discover/scroll.
    discoverSwipe: "/discover/swipe",
    // Catalog's segment (2026-09-02 -> MESITA-1697). 308s to /discover/feed,
    // which now carries the rails it used to serve.
    discoverCatalog: "/discover/catalog",
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

/** One balance in the wallet — a full page, not a sheet. See newVisit.walletBalance. */
export function walletBalancePath(balanceId: string): string {
  return `${CONSUMER_ROUTES.newVisit.walletBalance.prefix}${balanceId}`;
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
