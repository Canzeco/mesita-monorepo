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
  //
  // VISIT'S RAIL, NOT HOME'S (Pato, MESITA-2050). The bottom bar is Visit ·
  // Order · Wallet · Me, and Visit's rail is Home · Search · Chat · Favs ·
  // Pay. Three of those five pills live here; Search is `search` and Pay is
  // `newVisit.root`. NONE OF THE URLS MOVED — app/(shell)/(visit)/layout.tsx
  // is a route group that draws the rail above all three namespaces. That
  // ends the "segments match labels" exception described above: the pill
  // reading Home sits at `/discover/scroll`, the same shape Pay has always
  // had at `/new-visit`.
  //
  // FEED LEFT (MESITA-2050): Pato's rail does not list it. `/discover/feed`
  // is a redirect source again (legacy.discoverFeed below), pointing at the
  // Home pill; CatalogRails stays on disk, unrendered.
  discoverTabs: {
    scroll: "/discover/scroll",
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
  // Visit › Pay (MESITA-2050; the centre bottom tab before that): pick a
  // place, start a visit. A VERB on purpose — it is the primary action, and
  // the visits LIST lives in Me › Visits, so this surface only ever creates.
  // /rewards, /pay and /qr all 308 here.
  newVisit: {
    root: "/new-visit",
    // PAY IS ONE PAGE AGAIN (MESITA-2050): Visit's fifth pill, the QR place
    // list and nothing else. Wallet left for a bottom tab of its own at
    // `/wallet` — see `wallet` below — which also retires the QR · Wallet
    // section row that used to sit here.
    new: "/new-visit",
  },
  // The Pay pill's one page, which is also its default: Pay has no sections
  // left to choose between (MESITA-2050).
  newVisitDefault: "/new-visit",
  // WALLET IS A BOTTOM TAB (Pato, MESITA-2050: "Visit. Order. Wallet. Me.").
  //
  // This is Wallet's FOURTH home and its second time as a tab. It was
  // standalone /credits (#1429), an Activity section at /inbox/credits, Pay's
  // second section at /new-visit/wallet (2026-09-01), a tab at /wallet
  // (2026-09-05), Pay's section again (09-06), and now a tab at /wallet
  // again. The 09-06 argument for folding it back ("five tabs is one more
  // top-level choice than the guest has decisions") does not reach this bar:
  // it is still four tabs, and Wallet took Search's and Home's slots, not a
  // fifth one.
  //
  // THE SUBROUTES CAME WITH IT, unchanged in kind: Buy, Gift, Redeem and one
  // balance are full-screen ROUTES, not sheets and not @modal intercepts
  // (Pato, 2026-09-08: "not modals but actually views with full-screen with
  // own screen"). Nothing here goes near isModalContractPath.
  //
  // REDEEM IS IN THE SHELL, behind the auth wall, because it credits a
  // wallet and a wallet needs an account. The PUBLIC half of gifting is
  // /gift/[code] (MESITA-1677), outside (shell), and it funnels into Redeem
  // after sign-in.
  //
  // `balance/` holds the id rather than a bare [id] under wallet/: Next does
  // rank static segments above a dynamic sibling, but a map where three words
  // are pages and everything else is an id is a trap for the next segment.
  wallet: {
    root: "/wallet",
    buy: "/wallet/buy",
    gift: "/wallet/gift",
    redeem: "/wallet/redeem",
    balance: {
      prefix: "/wallet/balance/",
    },
  },
  // ORDER IS A BOTTOM TAB (Pato, MESITA-2050: "Order must have Home. and
  // thats it, i guess."). One rail pill, Home, at the bare route — the same
  // container-plus-sections shape Visit has, with one section. The orders
  // vertical is designed-not-built (Docs › Orders: no table, no Edge
  // Function, no type), so the page is an honest empty state, never mock
  // places. A second Order mode is a key here plus a pill in ORDER_MODES.
  order: {
    root: "/order",
    home: "/order",
  },
  // A single visit — THE TICKET (reward -> task -> QR -> results). Top-level
  // sibling of /place and /reservation, not a child of /new-visit: you reach
  // it from the centre tab when you start one AND from Inbox > Visits when you
  // return to one, so it belongs to neither.
  //
  // It lights the VISIT tab (MESITA-2050), not Me. It lit Me from MESITA-1609
  // because Activity's Visits box moved there; a tab named Visit now exists,
  // it holds the Pay pill that creates the ticket, and the ticket is a visit.
  //
  // The OBJECT is still a ticket and the DB column is still `kind`. Only the
  // consumer-facing URL says visit. Do not let this cascade into a code or
  // column rename (MESITA-1062 eng review).
  visit: {
    prefix: "/visit/",
  },
  // THE PUBLIC HALF OF GIFTING (MESITA-1677) — the one route this issue adds
  // outside (shell). A stranger with a gift code and no account lands here;
  // route-structure.test.tsx T1 carries the fourth exemption for it.
  // Top-level, sibling of /place, /reservation and /visit, for the same
  // reason those are: it is reached from an OUTSIDE link (shared, not
  // navigated to from inside the app), never nested under a segment that
  // assumes a signed-in guest.
  giftClaim: {
    prefix: "/gift/",
  },
  // ACTIVITY IS NOT A CONTAINER ANY MORE (MESITA-1626). MESITA-1609 took it
  // off the bottom bar; MESITA-1789 gave each Me box its own full page so a
  // tap is a route, not a LocalSheet. /inbox/* still 308s onto Me (the hub);
  // the three live Activity cells deep-link to mePages.notifications / visits
  // / reservations. They are NOT @modal intercepts — same reversal Wallet
  // already made for Buy/Gift/Redeem (isModalContractPath stays place +
  // reservation detail only).
  me: "/me",
  // Every live DestTile on /me, and every door inside Diamond /
  // Settings. Hub stays `/me`. These are real pages under (shell)/me/<box>.
  // /me/settings and /me/plan used to 308 onto the hub (MESITA-188); they are
  // canonical again, not legacy. /me/class went the other way (MESITA-2040) —
  // canonical, then retired to the legacy block below.
  mePages: {
    profile: "/me/profile",
    // THE TWO FACTS, AT TWO ADDRESSES (Pato, MESITA-2040: "separate instagram
    // and diamond… those are independent"). `/me/class` was ONE page holding
    // a ladder with two doors on it; there is no ladder, so there is no page
    // for one. Instagram leads because it is the door anyone can walk
    // through; Diamond follows because it is the one that has to be opened
    // for you.
    instagram: "/me/instagram",
    diamond: "/me/diamond",
    // The 10-digit PIN. It nests under Diamond rather than sitting beside it
    // because a PIN grants exactly one thing now — it used to NAME a class,
    // any class, which is why it lived on the ladder's page.
    diamondInvite: "/me/diamond/invite",
    plan: "/me/plan",
    settings: "/me/settings",
    settingsMetrics: "/me/settings/metrics",
    settingsContact: "/me/settings/contact",
    help: "/me/help",
    notifications: "/me/notifications",
    visits: "/me/visits",
    reservations: "/me/reservations",
  },
  legacy: {
    profile: "/profile",
    // The class ladder's two pages (MESITA-188 -> MESITA-2040). Both were
    // canonical and both shipped, so the bookmarks are real. `/me/class`
    // forwards to Diamond rather than to Instagram: the ladder's own CTA
    // order put Instagram first, but the page a guest bookmarked as "my
    // class" was the one telling them which rung they held, and the only
    // rung left is Diamond. The invite PIN forwards straight to its new
    // address — never through /me/diamond, which would be the 2-hop chain
    // route-structure T4 caps.
    meClass: "/me/class",
    meClassInvite: "/me/class/invite",
    // The Passport (MESITA-1789 -> MESITA-2043: "we don't have passports").
    // Its one load-bearing print, the member number, moved to Profile, so
    // the bookmark follows the number there.
    mePassport: "/me/passport",
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
    // Wallet's address as Pay's section (2026-09-01 -> 09-05, and 09-06 ->
    // MESITA-2050). The realest wallet bookmarks there are, and the one a
    // Stripe return URL carried — `/me?cards=` used to forward here. The bare
    // path and every subroute 308 to the same path under `/wallet` in ONE
    // hop. `/wallet` itself is CANONICAL again and is not in this block: a
    // redirect whose source is a live route shadows the page entirely.
    newVisitWallet: "/new-visit/wallet",
    // Feed's segment (MESITA-1621 -> MESITA-2050). It left Visit's rail, and
    // 308s to the Home pill. The name is the THIRD time this key has existed:
    // it was deleted at MESITA-1621 because Feed became a real page.
    discoverFeed: "/discover/feed",
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
  wallet: "/wallet",
  order: "/order",
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

/** One balance in the wallet — a full page, not a sheet. See `wallet.balance`. */
export function walletBalancePath(balanceId: string): string {
  return `${CONSUMER_ROUTES.wallet.balance.prefix}${balanceId}`;
}

/** The public gift landing link (MESITA-1677) — what a sender actually shares. */
export function giftClaimPath(code: string): string {
  return `${CONSUMER_ROUTES.giftClaim.prefix}${code}`;
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
