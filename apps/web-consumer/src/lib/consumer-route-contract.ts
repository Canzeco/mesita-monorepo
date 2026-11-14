// Consumer route contract (canonical surface paths + modal paths).
// The single source of truth: nav, headers, the loading pickers, the
// middleware's sign-in wall and route handlers read these, never a typed
// path, so they cannot drift into stringly-typed mismatches (MESITA-3642).
//
// The live app is the bar (Home · Search · Pay · Activity · Me), the place
// screen, reservations, Share (a Me tile), and the money objects under Pay
// and Wallet. ROUTE_MAP below says, once, how each screen opens, which tab
// it lights, where the bar shows and where Back lands (MESITA-3646).
// Every address that shipped and no longer renders a page lives only in
// `legacy` below and 308s to the nearest live page.

export const CONSUMER_ROUTES = {
  onboard: "/onboard",
  // SEARCH — its own top-level route and bottom tab (MESITA-1616): the map +
  // the one search bar + Filters. `/discover/search` and `/discover/map` are
  // redirect SOURCES for the bookmarks those addresses shipped under.
  search: "/search",
  // ASK AI (Pato, MESITA-2401; Soon, MESITA-2168). Opened from Search it
  // floats as a sheet over the map — an @modal intercept, so Search stays
  // painted under it (Pato, MESITA-2475: "like a modal"); a cold load renders
  // the full page. /discover/chat 308s here.
  searchChat: "/search/chat",
  // HOME — two tabs, each its own address (Pato, MESITA-2597: "we should
  // have home/places and home/social"): Places, the catalog, is where every
  // "go Home" lands; Social is the activity feed. Bare /home and every older
  // Home address 308 to Places in one hop. They were one page at /home with
  // the tab in client state (MESITA-2475, MESITA-2517).
  //
  // THE SWIPE ENGINE IS GONE (MESITA-2328): its EF, its ranking library and
  // its `discovery_config.swipe` slice retired together. The stored key was
  // dropped by the normalizers, never renamed.
  home: "/home/places",
  homeSocial: "/home/social",
  place: {
    prefix: "/place/",
  },
  // A Google place with no Mesita row yet: generated on open.
  placeOpen: {
    prefix: "/place/open/",
  },
  // The singular reservation DETAIL; the list is Me › Reservations.
  reservation: {
    prefix: "/reservation/",
  },
  // MONEY HAS ADDRESSES (Pato, 2026-11-09, MESITA-3614: "you first go to
  // one side and then to the other … keep stuff structurally clean"). Each
  // money object lives under the bar tab that owns it, and a place's address
  // is a door that opens the object:
  //
  //   /pay                       the places you can pay at (the tab)
  //   /pay/<placeId>             pay at that place: opens your bill there and
  //                              becomes /pay/tab/<id> (the table QR's door)
  //   /pay/tab/<tabId>           the bill at the table (MESITA-3564)
  //   /pay/join/<token>          a friend's share of a split bill
  //                              (MESITA-3695): takes the share, becomes
  //                              /pay/tab/<shareId>
  //   /pay/receipt/<paymentId>   a paid bill's proof (MESITA-3459)
  //   /wallet                    the Wallet, the Pay | Wallet switch's
  //                              second half (MESITA-3729)
  //   /wallet/<placeId>          a place's House Card, full screen (MESITA-3533)
  //   /wallet/gift/<token>       a friend's credit link (MESITA-3292)
  //
  // Each was a query string read and then dropped (/pay?place=, ?tab=,
  // ?payment=; /wallet?place=, ?gift=), so a place's Wallet tile landed on
  // the Wallet and then popped a sheet, and that sheet's Pay threw you onto
  // Pay. Those shapes still arrive (printed table QRs, Stripe returns, sent
  // links): /pay and /wallet's server pages forward each one in one hop.
  pay: "/pay",
  payPlace: { prefix: "/pay/" },
  payTab: { prefix: "/pay/tab/" },
  payJoin: { prefix: "/pay/join/" },
  payReceipt: { prefix: "/pay/receipt/" },
  // A FINISHED VISIT, ONE PAGE (MESITA-3770, Pato: "the live workflow visit
  // tickets and the output ticket must be different"): what was paid, how,
  // and what came back. An open bill stays /pay/tab/<id>; /visit/ is a legacy address.
  // Under Me › Tickets since Activity left the bar (MESITA-3855).
  visit: { prefix: "/me/tickets/visit/" },
  // ONE CREDIT MOVEMENT, ONE PAGE (MESITA-3782): a voucher, bonus, refund or
  // gift ticket opens /me/tickets/credit/<placeId>/<kind>.<ms> (MESITA-3855).
  credit: { prefix: "/me/tickets/credit/" },
  // PAY · WALLET (Pato, 2026-11-11, MESITA-3698: "Divide Payments across
  // two sections: Pay and Wallet"): the bar's Pay tab has two halves, each
  // its own address, /pay and /wallet, under one band. Wallet was the bar's
  // fourth tab from MESITA-3295 and sat under Pay's list from MESITA-3631
  // (/wallet a door to /pay) until this. A Mesita Prepay checkout returns to
  // the place's House Card with ?prepay= (MESITA-3617), an added card to
  // /wallet?card=.
  wallet: "/wallet",
  walletPlace: { prefix: "/wallet/" },
  walletGift: { prefix: "/wallet/gift/" },
  // NO ACTIVITY AND NO SHARE PAGE (Pato, 2026-11-14, MESITA-3855: "Home
  // Search Pay Share Me … SHARE IS JUST A QUICK BUTTON TO SHARE WITH
  // FRIENDS. NOTHING ELSE"). Activity's chips are Me's Notifications,
  // Reservations and Tickets pages; Share is a bar button that opens the
  // phone's share sheet, no page. Both addresses are in `legacy`.
  // Me is the hub: identity header + a grid of DestTiles and a Settings row, each a real
  // page under (shell)/me/<box> (MESITA-1789). The `/me/[tab]` catch-all
  // 308s any other one-segment address onto the hub.
  me: "/me",
  mePages: {
    profile: "/me/profile",
    // Instagram is an identity fact (a handle + the 1,000 bar), independent
    // of anything priced — it stays (Pato, MESITA-2080).
    instagram: "/me/instagram",
    // Plan is back as a read-only page: Free and Pro, Pro's new perks Soon
    // (MESITA-2134, MESITA-2553). It left the legacy list the same day.
    plan: "/me/plan",
    // Class, Regular or VIP, as a page behind Me's Class tile (MESITA-2562);
    // the header's Class chip opens the same body as a sheet.
    class: "/me/class",
    // GIFT (Pato, 2026-11-11, MESITA-3771): the places the guest holds credit
    // at; a tap opens that House Card with Gift Credits open.
    gift: "/me/gift",
    // ACTIVITY'S CHIPS, AS ME'S PAGES (MESITA-3855): Notifications,
    // Reservations, and Tickets — every visit, voucher, gift and refund,
    // one chip per kind at /me/tickets/<kind> (lib/ticket-kinds.ts).
    notifications: "/me/notifications",
    reservations: "/me/reservations",
    tickets: "/me/tickets",
    settings: "/me/settings",
    settingsContact: "/me/settings/contact",
    // Feedback about the app itself, not a place (MESITA-3029).
    settingsFeedback: "/me/settings/feedback",
    // Me's Favorites page left for Activity (MESITA-3688) and then Home's
    // Saved row (MESITA-3723); its address is in `legacy`.
    // Me › Visits (MESITA-3264) left with the discount product (MESITA-3299);
    // the `/me/[tab]` catch-all 308s its address onto the hub.
  },
  // Every address that shipped to production and no longer renders a page.
  // Each one has a next.config.ts redirect (route-structure T4 proves the
  // destination resolves, T7 proves the entry exists), in ONE hop. A prefix
  // (trailing slash) stands for the `:param` entry that catches it. Nothing
  // live belongs here: a redirect whose source is a page shadows the page.
  legacy: {
    profile: "/profile",
    // The referral deck's older /invite address (MESITA-2087). /share itself
    // is live again (MESITA-2566).
    invite: "/invite",
    // Home's one page, until each tab got its own address (MESITA-2597).
    homeRoot: "/home",
    // The AI mode's route before it was named for what it does.
    homeAi: "/home/ai",
    // The trial Places tabs, 1.0 · 2.0 · 4.0 (MESITA-3658…3680), retired
    // when 1.0 became Places again at /home/places (MESITA-3684).
    homeClassic: "/home/classic",
    homeGrid: "/home/grid",
    homeRails: "/home/rails",
    // Places 3.0's own tab until MESITA-3789 made it Places.
    homeRows: "/home/rows",
    // Home's namespace and its default pill, until Home became /home
    // (MESITA-2475).
    discover: "/discover",
    discoverPlaces: "/discover/places",
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
    // Social became a pane of Home, not a page (MESITA-2474).
    discoverSocial: "/discover/social",
    // Chat left Home for the Search tab (MESITA-2401).
    discoverChat: "/discover/chat",
    // The Places test tab (MESITA-2402) was deleted (MESITA-2405).
    places: "/places",
    // The Second Stage tab and everything under it (MESITA-2087). The QR
    // place list, THE TICKET, Wallet with Buy · Gift · Redeem · balance,
    // standalone Credits, the Order tab, the public gift landing, and every
    // /rewards, /pay/<sub> and /ticket era address. All 308 to `pay`, except
    // what hung under the old Wallet tab, which land on /wallet, Pay's Wallet
    // half (MESITA-3698).
    newVisit: "/new-visit",
    newVisitWallet: "/new-visit/wallet",
    visitPrefix: "/visit/",
    walletBalancePrefix: "/wallet/balance/",
    // The old Wallet tab's one-segment children. Literal, never `/wallet/:tab`:
    // /wallet/<placeId> is a live page (MESITA-3614).
    walletBuy: "/wallet/buy",
    walletGiftTab: "/wallet/gift",
    walletRedeem: "/wallet/redeem",
    credits: "/credits",
    inboxCredits: "/inbox/credits",
    order: "/order",
    inboxOrders: "/inbox/orders",
    giftClaimPrefix: "/gift/",
    rewards: "/rewards",
    rewardsTicketPrefix: "/rewards/ticket/",
    payTicketPrefix: "/pay/ticket/",
    payTicketsPrefix: "/pay/tickets/",
    // The Visit-era section row under Pay. Literal, never `/pay/:tab`:
    // /pay/<placeId> is a live page (MESITA-3614).
    payWallet: "/pay/wallet",
    payQr: "/pay/qr",
    ticketPrefix: "/ticket/",
    qr: "/qr",
    // Me › Transactions became Activity (MESITA-3631), then Me › Tickets
    // (MESITA-3855).
    meTransactions: "/me/transactions",
    // MCP is a Pro perk on Plan (MESITA-3771); Refunds is Tickets' chip.
    meConnector: "/me/connector",
    meRefunds: "/me/refunds",
    // Me's Second Stage boxes (MESITA-2087): the class ladder's pages, the
    // Diamond pair, Plan's Pro checkout, Visits, Metrics, Passport.
    // /me/plan (MESITA-2134) and /me/class (MESITA-2562) are live again.
    meClassInvite: "/me/class/invite",
    meDiamond: "/me/diamond",
    meDiamondInvite: "/me/diamond/invite",
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
    // The reservations LIST as a top-level tab route. A server page until
    // MESITA-2475; a table entry now, like every other.
    reservations: "/reservations",
    // The Bookings tab, until it became Saved › Reservations (MESITA-2521).
    bookings: "/bookings",
    // Reservations under /saved, from when that was a tab.
    savedReservations: "/saved/reservations",
    savedReservationPrefix: "/saved/reservation/",
    // The bar's Saved tab (MESITA-2521), until it moved under Me (MESITA-2561).
    saved: "/saved",
    // Me › Saved, Favorites | Reservations (MESITA-2561), until each became
    // its own page (MESITA-2565).
    meSaved: "/me/saved",
    // Me's own Favorites page (MESITA-2565). Its Notifications and
    // Reservations pages are live again (MESITA-3855).
    meFavorites: "/me/favorites",
    // NO /activity HERE (MESITA-3862): the Activity tab's addresses are
    // gone, not redirected (Pato: "KILL THIS ATIVITY LINK").
    // Share's page (MESITA-2566), until Share became a bar button
    // (MESITA-3855). It lands on Home.
    share: "/share",
    // Place detail briefly had a dual path under /saved (Favorites-era).
    // Canonical is /place/[id]; this redirects there (MESITA-899).
    savedPlacePrefix: "/saved/place/",
  },
} as const;

/** `pathname` is `root` itself or under it (`/me` matches `/me/plan`,
 *  never `/menu`). A trailing slash on `root` is ignored. */
export function isAtRoute(pathname: string, root: string): boolean {
  const r = root.endsWith("/") ? root.slice(0, -1) : root;
  return pathname === r || pathname.startsWith(`${r}/`);
}

export function placePath(idOrSlug: string): string {
  return `${CONSUMER_ROUTES.place.prefix}${idOrSlug}`;
}

/** The full Reserve page under a place (MESITA-3609). */
export function placeReservePath(idOrSlug: string): string {
  return `${placePath(idOrSlug)}/reserve`;
}

/** /place/<id>/reserve: a full page, never the place slide-over. */
export function isPlaceReservePath(pathname: string): boolean {
  return /^\/place\/[^/]+\/reserve\/?$/.test(pathname);
}

/** A Mesita row id (a place, a bill, a payment): the money routes take
 *  nothing else in their id segment. */
export function isRouteId(id: string | null | undefined): id is string {
  return typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/** Pay at a place: the door that opens (or reuses) the guest's bill there. */
export function payPlacePath(placeId: string): string {
  return `${CONSUMER_ROUTES.payPlace.prefix}${placeId}`;
}

/** The bill at the table. */
export function payTabPath(tabId: string): string {
  return `${CONSUMER_ROUTES.payTab.prefix}${tabId}`;
}

/** A friend's door to their share of a split bill (MESITA-3695). */
export function payJoinPath(token: string): string {
  return `${CONSUMER_ROUTES.payJoin.prefix}${encodeURIComponent(token)}`;
}

/** A finished visit's one-page summary (MESITA-3770). */
export function visitPath(tabId: string): string {
  return `${CONSUMER_ROUTES.visit.prefix}${tabId}`;
}

/** One credit movement's page (MESITA-3782): the entry is its kind and
 *  its time, which together name it on the guest's balance at the place. */
export function creditEntryPath(placeId: string, e: { kind: string; at: string }): string {
  return `${CONSUMER_ROUTES.credit.prefix}${placeId}/${e.kind}.${Date.parse(e.at)}`;
}

/** A paid bill's proof. */
export function payReceiptPath(paymentId: string): string {
  return `${CONSUMER_ROUTES.payReceipt.prefix}${paymentId}`;
}

/** A place's House Card in the Wallet. */
export function walletPlacePath(placeId: string): string {
  return `${CONSUMER_ROUTES.walletPlace.prefix}${placeId}`;
}

/** A friend's credit link (shared outside the app: keep its shape). */
export function walletGiftPath(token: string): string {
  return `${CONSUMER_ROUTES.walletGift.prefix}${encodeURIComponent(token)}`;
}

export function reservationPath(id: string): string {
  return `${CONSUMER_ROUTES.reservation.prefix}${id}`;
}

/** Open a Google-only place by its Google id: the generating screen, which
 *  becomes the place's own address once it exists. */
export function placeOpenPath(googlePlaceId: string): string {
  return `${CONSUMER_ROUTES.placeOpen.prefix}${encodeURIComponent(googlePlaceId)}`;
}

// ─── THE ROUTE MAP (MESITA-3646) ───────────────────────────────────────────
//
// One row per live screen inside the shell, and the ONLY place that says
// which bar tab a screen lights, whether the bar shows on it, how it opens
// (a tab, a pushed page, a panel over the page, a sheet, a door that
// forwards) and which screen is under it when there is no history to go
// Back to. The bar, the panels' stale-slot guard, the loading frames, the
// edge auth wall and Back all read it; a screen missing here has no loading
// frame (a type error) and lights no tab. Addresses that only redirect live
// in `legacy` and next.config's table, never here.

/** The bar's tabs that are screens. Share sits on the bar too, between Pay
 *  and Me, but is a button: no screen lights it (MESITA-3855). */
export type ConsumerTab = "home" | "search" | "pay" | "me";

/** How a screen arrives: a bar `tab`; a `page` pushed over the screen it was
 *  opened from; a `panel` that slides over the page under it (an @modal
 *  intercept with a full-page twin); a `sheet` that rises over it; a `door`
 *  that only forwards to another screen. */
export type RouteKind = "tab" | "page" | "panel" | "sheet" | "door";

type RouteRow = {
  /** Segments; `:name` takes any one segment. */
  pattern: string;
  tab: ConsumerTab;
  kind: RouteKind;
  /** The screen Back lands on when nothing of ours is under this one: a
   *  row's id (a string here so the table can name itself; the test pins
   *  that every parent is a row). */
  parent: string | null;
  /** Does the bottom bar show? The place screen owns the whole frame
   *  (MESITA-3300), and so do Reserve and the generating screen. */
  bar: boolean;
};

const row = (
  pattern: string,
  tab: ConsumerTab,
  kind: RouteKind,
  parent: string | null,
  bar = true,
): RouteRow => ({ pattern, tab, kind, parent, bar });

export const ROUTE_MAP = {
  home: row("/home/places", "home", "tab", null),
  homeSocial: row("/home/social", "home", "tab", null),
  search: row("/search", "search", "tab", null),
  searchChat: row("/search/chat", "search", "sheet", "search"),
  place: row("/place/:id", "home", "panel", "home", false),
  placeOpen: row("/place/open/:gid", "home", "panel", "home", false),
  placeReserve: row("/place/:id/reserve", "home", "page", "place", false),
  // A reservation is reached from a place and from Me › Reservations; it
  // lights Me, whose list is where it lands back (MESITA-3855).
  reservation: row("/reservation/:id", "me", "panel", "meReservations"),
  // A finished Visit, opened from Me › Tickets (MESITA-3770, MESITA-3855).
  visit: row("/me/tickets/visit/:tabId", "me", "page", "meTickets"),
  // A voucher, bonus, refund or gift, opened from Tickets (MESITA-3782).
  credit: row("/me/tickets/credit/:placeId/:entry", "me", "page", "meTickets"),
  pay: row("/pay", "pay", "tab", null),
  // The pay screens own the whole frame, as the place screen does: no bar,
  // the header's back is the way out, so every step fits (MESITA-3739).
  payPlace: row("/pay/:placeId", "pay", "door", "pay", false),
  payTab: row("/pay/tab/:tabId", "pay", "page", "pay", false),
  payJoin: row("/pay/join/:token", "pay", "door", "pay", false),
  payReceipt: row("/pay/receipt/:paymentId", "pay", "page", "pay", false),
  // The Pay | Wallet switch's second half (MESITA-3729; a page pushed from
  // Pay's header in MESITA-3726, a bar tab in MESITA-3722). It and its
  // children light Pay.
  wallet: row("/wallet", "pay", "tab", null),
  walletPlace: row("/wallet/:placeId", "pay", "page", "wallet"),
  walletGift: row("/wallet/gift/:token", "pay", "page", "wallet"),
  me: row("/me", "me", "tab", null),
  meProfile: row("/me/profile", "me", "page", "me"),
  meInstagram: row("/me/instagram", "me", "page", "me"),
  // Opened from Settings since the Me cell went Soon (MESITA-3855).
  mePlan: row("/me/plan", "me", "page", "meSettings"),
  meClass: row("/me/class", "me", "page", "me"),
  meGift: row("/me/gift", "me", "page", "me"),
  // Activity's chips as Me's pages (MESITA-3855).
  meNotifications: row("/me/notifications", "me", "page", "me"),
  meReservations: row("/me/reservations", "me", "page", "me"),
  meTickets: row("/me/tickets", "me", "page", "me"),
  // One kind of ticket, /me/tickets/<kind>: the same page, chip picked.
  meTicketsKind: row("/me/tickets/:kind", "me", "page", "me"),
  meSettings: row("/me/settings", "me", "page", "me"),
  meSettingsContact: row("/me/settings/contact", "me", "page", "meSettings"),
  meSettingsFeedback: row("/me/settings/feedback", "me", "page", "meSettings"),
} as const satisfies Record<string, RouteRow>;

export type RouteId = keyof typeof ROUTE_MAP;

/** The address of a row with no params (a tab, a Me page). */
export function routeHref(id: RouteId): string {
  return ROUTE_MAP[id].pattern;
}

const COMPILED = (Object.keys(ROUTE_MAP) as RouteId[]).map((id) => {
  const segs = ROUTE_MAP[id].pattern.split("/").filter(Boolean);
  return { id, segs, fixed: segs.filter((x) => !x.startsWith(":")).length };
});

/** The screen a pathname shows, or null (a redirect, an unknown address).
 *  A fixed segment beats a `:param` (/place/open/x is not /place/:id). */
export function routeFor(pathname: string): RouteId | null {
  const parts = pathname.split(/[?#]/)[0]!.split("/").filter(Boolean);
  let best: { id: RouteId; fixed: number } | null = null;
  for (const c of COMPILED) {
    if (c.segs.length !== parts.length) continue;
    if (!c.segs.every((x, i) => x.startsWith(":") || x === parts[i])) continue;
    if (!best || c.fixed > best.fixed) best = { id: c.id, fixed: c.fixed };
  }
  return best?.id ?? null;
}

/** The bar tab a pathname lights: its row's, or, for an address with no row
 *  (a /me/<old box> on its way to the hub), its first segment's tab. */
export function tabFor(pathname: string): ConsumerTab | null {
  const id = routeFor(pathname);
  if (id) return ROUTE_MAP[id].tab;
  const first = `/${pathname.split("/").filter(Boolean)[0] ?? ""}`;
  for (const c of COMPILED) {
    if (`/${c.segs[0] ?? ""}` === first) return ROUTE_MAP[c.id].tab;
  }
  return null;
}

/** Does the bottom bar show on this pathname? */
export function barShowsOn(pathname: string): boolean {
  const id = routeFor(pathname);
  return id ? ROUTE_MAP[id].bar : true;
}

/** Where Back lands when nothing of ours is under this screen: its parent
 *  row, the tab it lights, or Home. A param in the parent's pattern takes
 *  the same-named param of this pathname (Reserve → its place). */
export function parentHref(pathname: string): string {
  const id = routeFor(pathname);
  if (!id) {
    const tab = tabFor(pathname);
    return tab ? routeHref(tab === "home" ? "home" : tab) : routeHref("home");
  }
  const parent = ROUTE_MAP[id].parent as RouteId | null;
  if (!parent) return routeHref("home");
  const own = ROUTE_MAP[id].pattern.split("/").filter(Boolean);
  const parts = pathname.split(/[?#]/)[0]!.split("/").filter(Boolean);
  const params = new Map(own.map((x, i) => [x, parts[i]] as const));
  return (
    "/" +
    ROUTE_MAP[parent].pattern
      .split("/")
      .filter(Boolean)
      .map((x) => (x.startsWith(":") ? (params.get(x) ?? x) : x))
      .join("/")
  );
}

/** Every first segment a row lives under: the edge auth wall's list. */
export function shellRoots(): string[] {
  return [...new Set(COMPILED.map((c) => `/${c.segs[0]}`))];
}

/**
 * Does this path paint inside a routed modal shell? A `panel` or `sheet` row
 * of ROUTE_MAP (MESITA-3646).
 *
 * SlideOverShell and RouteSheetShell open with
 * `if (!isModalContractPath(pathname)) return null`, so an @modal intercept
 * whose row is not a panel or sheet renders BLANK. The route-map tests hold
 * every intercept to a panel or sheet row, and only those rows to one.
 */
export function isModalContractPath(pathname: string): boolean {
  const id = routeFor(pathname);
  if (id) {
    const kind = ROUTE_MAP[id].kind;
    return kind === "panel" || kind === "sheet";
  }
  // Two retired addresses still 308 through a panel route (T2).
  return (
    pathname.startsWith(CONSUMER_ROUTES.legacy.savedPlacePrefix) ||
    pathname.startsWith(CONSUMER_ROUTES.legacy.savedReservationPrefix)
  );
}
