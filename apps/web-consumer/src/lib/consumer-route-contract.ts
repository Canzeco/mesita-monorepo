// Consumer route contract (canonical surface paths + modal paths).
// The single source of truth: nav, headers, the loading pickers, the
// middleware's sign-in wall and route handlers read these, never a typed
// path, so they cannot drift into stringly-typed mismatches (MESITA-3642).
//
// The live app is the bar (Home · Search · Pay · Me), the place
// screen, reservations, and the money objects under Pay and Wallet. ROUTE_MAP below says, once, how each screen opens, which tab
// it lights, where the bar shows and where Back lands (MESITA-3646).
// Every address that shipped and no longer renders a page lives only in
// `legacy` below and 308s to the nearest live page.
//
// THE WORDS (MESITA-4013). An address is written in these and no others:
//
//   tab     one of the bar's four: Home · Search · Pay · Me. Never
//           the bill: `tab` is that thing's wire name only (pay_tabs, the
//           EF bodies, `tabId` in props).
//   page    a screen pushed over the one it was opened from; it has Back.
//   panel   a screen that slides over the page under it (a place, a
//           reservation): an @modal intercept with a full-page twin.
//   door    an address that only forwards to a screen (/pay/place/<id>).
//   chip    a filter of one page with its own address (/me/tickets/refunds,
//           /me/reservations/past). It swaps in place, never a new screen.
//   bill    what the guest is paying at the table, open: /pay/bill/<id>.
//   ticket  a finished money movement, under Me › Tickets.
//
// THE ADDRESS SAYS WHAT THE THING IS; `parent` in ROUTE_MAP says where Back
// lands. They need not match (/share lands on Wallet), so a screen that
// moves between tabs keeps its address. An id never sits beside fixed words:
// it follows the noun that says what it identifies (/pay/place/<placeId>,
// /place/google/<gid>), so no id can ever be read as a word or a word as an
// id. `/place/<id>` is the one bare id: the place is the app's subject.

export const CONSUMER_ROUTES = {
  onboard: "/onboard",
  // SIGN (MESITA-4246): the anonymous visitor's tab, in Me's slot. Phone,
  // code and onboarding on one page with the bar showing; it becomes Me once
  // the account is onboarded.
  sign: "/sign",
  // SEARCH — its own top-level route and bottom tab (MESITA-1616): the map +
  // the one search bar + Filters. `/discover/search` and `/discover/map` are
  // redirect SOURCES for the bookmarks those addresses shipped under.
  search: "/search",
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
  // A Google place with no Mesita row yet, by its Google id: generated on
  // open. /place/open/<gid> until MESITA-4013 (the segment names the id).
  placeGoogle: {
    prefix: "/place/google/",
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
  //   /pay                       Pay Bill, your money (the tab)
  //   /pay/pick                  redirects to /pay?pick=1, the place sheet (MESITA-4478)
  //   /pay/place/<placeId>       pay at that place: opens your bill there and
  //                              becomes /pay/bill/<id> (the table QR's door)
  //   /pay/bill/<billId>         the bill at the table (MESITA-3564)
  //   /pay/join/<token>          a friend's share of a split bill
  //                              (MESITA-3695): takes the share, becomes
  //                              /pay/bill/<shareId>
  //   /pay/receipt/<paymentId>   a paid bill's proof (MESITA-3459)
  //   /wallet                    the Wallet tab (MESITA-3886)
  //   /wallet/place/<placeId>    a place's Loyalty Card, full screen (MESITA-3533)
  //   /wallet/gift/<token>       a friend's credit link (MESITA-3292)
  //
  // The bill was /pay/tab/<id>, and the two place addresses were a bare id
  // (/pay/<placeId>, /wallet/<placeId>) until MESITA-4013; each old shape
  // 308s to its new one in one hop (legacy-redirects.ts).
  //
  // Each was a query string read and then dropped (/pay?place=, ?tab=,
  // ?payment=; /wallet?place=, ?gift=), so a place's Wallet tile landed on
  // the Wallet and then popped a sheet, and that sheet's Pay threw you onto
  // Pay. Those shapes still arrive (printed table QRs, Stripe returns, sent
  // links): /pay and /wallet's server pages forward each one in one hop.
  pay: "/pay",
  // PAY BILL'S PLACE PICKER (MESITA-4232): a pushed page, not a modal.
  payPick: "/pay/pick",
  payPlace: { prefix: "/pay/place/" },
  payBill: { prefix: "/pay/bill/" },
  payJoin: { prefix: "/pay/join/" },
  payReceipt: { prefix: "/pay/receipt/" },
  // A FINISHED VISIT, ONE PAGE (MESITA-3770, Pato: "the live workflow visit
  // tickets and the output ticket must be different"): what was paid, how,
  // and what came back. An open bill stays /pay/bill/<id>; /visit/ is a legacy address.
  // Under Me › Tickets since Activity left the bar (MESITA-3855); /visits/<visitId>
  // beside the /visits chip since MESITA-4016 (was /visit/<tabId>, 308s).
  visit: { prefix: "/me/tickets/visits/" },
  // ONE CREDIT MOVEMENT, ONE PAGE (MESITA-3782): a voucher, bonus, refund or
  // gift ticket opens /me/tickets/credit/<placeId>/<kind>.<ms> (MESITA-3855).
  // One noun on purpose (MESITA-4016): bonus and extra credit have no chip.
  credit: { prefix: "/me/tickets/credit/" },
  // ONE GIFT, ONE PAGE (MESITA-4066): a Gifts row opens
  // /me/tickets/gift/<giftId>, the gift found by its id in the wallet read;
  // a gift line's credit page forwards there.
  gift: { prefix: "/me/tickets/gift/" },
  // ONE STORY, ONE PAGE (MESITA-4405): the Story record's steps (post, the
  // waiter's QR, the bonus), opened from Tickets › Stories, the Wallet's
  // Story row, and right after a Story buy (?by=purchase, the purchase id).
  story: { prefix: "/me/tickets/stories/" },
  // PAY AND WALLET, TWO TABS (Pato, 2026-11-14, MESITA-3886: "separate pay
  // and wallet again. only pay and only wallet"): each its own bar tab and
  // page, no switch between them. They were two halves of the Pay tab under
  // one band (MESITA-3698/3729); Wallet was the bar's fourth tab from
  // MESITA-3295 and sat under Pay's list from MESITA-3631. A Mesita Prepay checkout returns to
  // the place's Loyalty Card with ?prepay= (MESITA-3617), an added card to
  // /wallet?card=.
  wallet: "/wallet",
  walletPlace: { prefix: "/wallet/place/" },
  walletGift: { prefix: "/wallet/gift/" },
  // ADD A CARD, ITS OWN PAGE (MESITA-4092, Pato: "OWN SUBPAGES IS CLEANER"),
  // pushed from Wallet's Add a card row; it was an 88% sheet.
  walletAddCard: "/wallet/cards/new",
  // PAYMENT METHODS (MESITA-4526): the header's method button opens it.
  walletMethods: "/wallet/methods",
  // BUY CREDITS AND SEND GIFT PICK A PLACE FIRST (MESITA-4096, Pato: "buy
  // credits and send credits must actually display a list of places to select
  // the action ... like a shortcut instead of going to the card subpage"):
  // Wallet's two buttons push these lists. Buy's row opens the place's Offers
  // at Prepayments; Send's row opens /wallet/place/<id>/send (walletSendPath).
  walletBuy: "/wallet/buy",
  walletSend: "/wallet/send",
  // NO ACTIVITY (Pato, 2026-11-14, MESITA-3855): its chips are Me's
  // Notifications, Reservations and Tickets pages.
  //
  // SHARE, A PAGE OPENED FROM WALLET (MESITA-3886: "in wallet include the
  // button to share. super big button"): one card of channel rows
  // (MESITA-3867), pushed with Back; it lights Wallet. It was the bar's Share
  // tab from MESITA-3867 until Wallet took the slot.
  share: "/share",
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
    // GIFT (Pato, 2026-11-11, MESITA-3771): the places the guest holds credit
    // at; a tap opens that Loyalty Card with Gift Credits open.
    gift: "/me/gift",
    // ACTIVITY'S CHIPS, AS ME'S PAGES (MESITA-3855): Notifications,
    // Reservations, and Tickets — every visit, voucher, gift and refund,
    // one chip per kind at /me/tickets/<kind> (lib/ticket-kinds.ts).
    notifications: "/me/notifications",
    reservations: "/me/reservations",
    tickets: "/me/tickets",
    settings: "/me/settings",
    settingsContact: "/me/settings/contact",
    // Refunds left Tickets for Settings (MESITA-4402).
    settingsRefunds: "/me/settings/refunds",
    // Feedback about the app itself, not a place (MESITA-3029).
    settingsFeedback: "/me/settings/feedback",
    // Integrations (MESITA-3954): Calendar, and MCP Soon; Me's cell read
    // "MCP" before.
    integrations: "/me/integrations",
    integrationsCalendar: "/me/integrations/calendar",
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
    // Chat left Home for the Search tab (MESITA-2401), then left its page
    // for a popup over Search (MESITA-4480).
    discoverChat: "/discover/chat",
    searchChat: "/search/chat",
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
    // The old Wallet tab's one-segment children, by name. /wallet/buy is a
    // live page again since MESITA-4096 (Buy Credits' place list).
    walletGiftTab: "/wallet/gift",
    // Claim Gift's 12-digit code page (MESITA-4020): a gift is a link only
    // since MESITA-4223 (Pato: "no necesita la gente meter un input de un
    // código").
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
    // The Visit-era section row under Pay, by name.
    payWallet: "/pay/wallet",
    payQr: "/pay/qr",
    ticketPrefix: "/ticket/",
    qr: "/qr",
    // The four addresses renamed to the product's words (MESITA-4013): the
    // bill was /pay/tab/<id>; a Google place opened at /place/open/<gid>.
    // The two bare place ids (/pay/<placeId>, /wallet/<placeId>) have no
    // prefix to name here; their redirects match a Mesita id only, so no
    // live word under /pay or /wallet is ever taken for one.
    payTabPrefix: "/pay/tab/",
    placeOpenPrefix: "/place/open/",
    // A finished Visit's detail beside its chip (MESITA-4016).
    meTicketsVisitPrefix: "/me/tickets/visit/",
    // Me › Transactions became Activity (MESITA-3631), then Me › Tickets
    // (MESITA-3855).
    meTransactions: "/me/transactions",
    // MCP is a Pro perk on Plan (MESITA-3771); Refunds is a Settings page
    // (MESITA-4402).
    meConnector: "/me/connector",
    meRefunds: "/me/refunds",
    // Gifts-In and Gifts-Out (MESITA-3941) are one Gifts list again
    // (MESITA-4036), /me/tickets/gifts.
    meTicketsGiftsIn: "/me/tickets/gifts-in",
    meTicketsGiftsOut: "/me/tickets/gifts-out",
    // Refunds left Tickets for Settings (MESITA-4402).
    meTicketsRefunds: "/me/tickets/refunds",
    // No Stories tab (MESITA-4627): a Story voucher is a Vouchers row.
    meTicketsStories: "/me/tickets/stories",
    // Me's Second Stage boxes (MESITA-2087): the class ladder's pages, the
    // Diamond pair, Plan's Pro checkout, Visits, Metrics, Passport.
    // /me/plan (MESITA-2134) is live again. /me/class left Me with Class
    // (MESITA-4306, Pato: "LETS REMOVE THE CLASS").
    meClass: "/me/class",
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
    // NO /share HERE: it is a live tab again (MESITA-3867).
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

/** The Story offer's own page under a place (MESITA-4303). */
export function placeStoryPath(idOrSlug: string): string {
  return `${placePath(idOrSlug)}/story`;
}

/** The place's Offers page (MESITA-4379): a page under the place, never a
 *  sheet over its profile, so a tap lands on Offers without the profile
 *  loading first. `section` (prepayment | special) says why it opened;
 *  `fromWallet` marks a wallet screen that wants the guest back, so a paid
 *  offer pops to it instead of replacing Offers with the card. No forward
 *  control reads it (MESITA-4601). */
export function placeOffersPath(
  idOrSlug: string,
  section?: "prepayment" | "special" | null,
  fromWallet = false,
): string {
  const q = new URLSearchParams();
  if (section) q.set("rewards", section);
  if (fromWallet) q.set("from", "wallet");
  const qs = q.toString();
  return `${placePath(idOrSlug)}/offers${qs ? `?${qs}` : ""}`;
}

/** A voucher's ticket (MESITA-4630): Offer · Pay · Credits · Receipt on its
 *  own page under Offers. `from` is Offers' own (pay | wallet): it says where
 *  a paid ticket's Done returns (MESITA-4599/4601). */
export function placeOfferPath(idOrSlug: string, voucher: string, from?: "pay" | "wallet" | null): string {
  return `${placePath(idOrSlug)}/offers/${encodeURIComponent(voucher)}${from ? `?from=${from}` : ""}`;
}

/** Contact, a page under the place (MESITA-4111). Open to a signed-out
 *  visitor, like the place itself: the rows are the place's own links. */
export function placeContactPath(idOrSlug: string): string {
  return `${placePath(idOrSlug)}/contact`;
}

/** Report, a page under the place (MESITA-4111). A member's screen. */
export function placeReportPath(idOrSlug: string): string {
  return `${placePath(idOrSlug)}/report`;
}

/** Upgrade, a page under the place (MESITA-4111). Checkout returns here. */
export function placeUpgradePath(idOrSlug: string): string {
  return `${placePath(idOrSlug)}/upgrade`;
}

/** One stored menu file (MESITA-4111). Menus have no id of their own;
 *  `menuId` is the index in `products.menu`. */
export function placeMenuPath(idOrSlug: string, menuId: number): string {
  return `${placePath(idOrSlug)}/menu/${menuId}`;
}

/** /place/<id>/reserve: a full page, never the place slide-over. */
export function isPlaceReservePath(pathname: string): boolean {
  return /^\/place\/[^/]+\/reserve\/?$/.test(pathname);
}

/** A Mesita row id (a place, a bill, a payment): the money routes take
 *  nothing else in their id segment. */
export function isRouteId(id: string | null | undefined): id is string {
  return (
    typeof id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  );
}

/** Pay at a place: the door that opens (or reuses) the guest's bill there. */
export function payPlacePath(placeId: string): string {
  return `${CONSUMER_ROUTES.payPlace.prefix}${placeId}`;
}

/** The bill at the table. The id is the wire's tab id. */
export function payBillPath(tabId: string): string {
  return `${CONSUMER_ROUTES.payBill.prefix}${tabId}`;
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
export function creditEntryPath(
  placeId: string,
  e: { kind: string; at: string },
): string {
  return `${CONSUMER_ROUTES.credit.prefix}${placeId}/${e.kind}.${Date.parse(e.at)}`;
}

/** One gift's page (MESITA-4066), by its wallet_gifts id. */
export function giftTicketPath(giftId: string): string {
  return `${CONSUMER_ROUTES.gift.prefix}${giftId}`;
}

/** One Story's screen (MESITA-4405). */
export function storyTicketPath(storyId: string): string {
  return `${CONSUMER_ROUTES.story.prefix}${storyId}`;
}

/** A Story's screen right after its buy, found by the purchase's id. */
export function storyPurchasePath(purchaseId: string): string {
  return `${CONSUMER_ROUTES.story.prefix}${purchaseId}?by=purchase`;
}

/** A paid bill's proof. */
export function payReceiptPath(paymentId: string): string {
  return `${CONSUMER_ROUTES.payReceipt.prefix}${paymentId}`;
}

/** A place's Loyalty Card in the Wallet. */
export function walletPlacePath(placeId: string): string {
  return `${CONSUMER_ROUTES.walletPlace.prefix}${placeId}`;
}

/** A Loyalty Card's Send Gift page: the amount, then the link (MESITA-4096). */
export function walletSendPath(placeId: string): string {
  return `${walletPlacePath(placeId)}/send`;
}

/** Payment methods (MESITA-4526): the saved card, Apple Pay, Google Pay and
 *  the default, opened from the Wallet header's method button. */
export function walletMethodsPath(): string {
  return "/wallet/methods";
}

/** A saved card's page (MESITA-4112). */
export function walletCardPath(cardId: string): string {
  return `/wallet/cards/${encodeURIComponent(cardId)}`;
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
export function placeGooglePath(googlePlaceId: string): string {
  return `${CONSUMER_ROUTES.placeGoogle.prefix}${encodeURIComponent(googlePlaceId)}`;
}

// ─── THE ROUTE MAP (MESITA-3646) ───────────────────────────────────────────
//
// One row per live screen inside the shell, and the ONLY place that says
// which bar tab a screen lights, whether the bar shows on it, how it opens
// (a tab, a pushed page, a panel over the page, a door that forwards) and
// which screen is under it when there is no history to go
// Back to. The bar, the panels' stale-slot guard, the loading frames, the
// edge auth wall and Back all read it; a screen missing here has no loading
// frame (a type error) and lights no tab. Addresses that only redirect live
// in `legacy` and next.config's table, never here.

/** The bar's tabs: Home · Search · Pay · Me (MESITA-4199). */
export type ConsumerTab = "home" | "search" | "pay" | "me";

/** How a screen arrives: a bar `tab`; a `page` pushed over the screen it was
 *  opened from; a `panel` that slides over the page under it (an @modal
 *  intercept with a full-page twin); a `door` that only forwards to another
 *  screen. A sheet that rises over a page is not a route. */
export type RouteKind = "tab" | "page" | "panel" | "door";

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
  // A member's card (MESITA-4113). The event names them (place, kind, at);
  // there is no member id (MESITA-2460).
  homeSocialPerson: row(
    "/home/social/person",
    "home",
    "page",
    "homeSocial",
    false,
  ),
  search: row("/search", "search", "tab", null),
  // Add a place, then Generate its profile (MESITA-4113). Both were sheets
  // over the map.
  searchAdd: row("/search/add", "search", "page", "search", false),
  searchGenerate: row("/search/generate", "search", "page", "search", false),
  place: row("/place/:id", "home", "panel", "home", false),
  placeGoogle: row("/place/google/:gid", "home", "panel", "home", false),
  placeReserve: row("/place/:id/reserve", "home", "page", "place", false),
  // The Story offer, pushed from Offers (MESITA-4303): a page, not a sheet.
  placeStory: row("/place/:id/story", "home", "page", "place", false),
  // OFFERS IS A PAGE (MESITA-4379, Pato: "why it needs to pass across that
  // page"): it was a full-screen sheet over the profile at
  // /place/<id>?rewards=…, so the profile loaded before Offers showed.
  placeOffers: row("/place/:id/offers", "home", "page", "place", false),
  // A voucher's ticket, pushed from Offers (MESITA-4630): a page like Pay
  // Bill's ticket. A bottom sheet over Offers until then (MESITA-4224).
  placeOffer: row("/place/:id/offers/:voucher", "home", "page", "placeOffers", false),
  // Contact, Report, Upgrade and one menu file, pages under the place
  // (MESITA-4111). They were sheets over the profile. More is rows on the
  // place page, so it has no address.
  placeContact: row("/place/:id/contact", "home", "page", "place", false),
  placeReport: row("/place/:id/report", "home", "page", "place", false),
  placeUpgrade: row("/place/:id/upgrade", "home", "page", "place", false),
  placeMenu: row("/place/:id/menu/:menuId", "home", "page", "place", false),
  // A reservation is reached from a place and from Me › Reservations; it
  // lights Me, whose list is where it lands back (MESITA-3855).
  reservation: row("/reservation/:id", "me", "panel", "meReservations"),
  // Move your table (MESITA-4113). Cancel stays a confirm on the reservation.
  reservationReschedule: row(
    "/reservation/:id/reschedule",
    "me",
    "page",
    "reservation",
    false,
  ),
  // A finished Visit, opened from Me › Tickets (MESITA-3770, MESITA-3855).
  visit: row("/me/tickets/visits/:visitId", "me", "page", "meTickets"),
  // A voucher, bonus, refund or gift, opened from Tickets (MESITA-3782).
  credit: row("/me/tickets/credit/:placeId/:entry", "me", "page", "meTickets"),
  // One gift, sender and receiver, opened from Tickets › Gifts (MESITA-4066).
  gift: row("/me/tickets/gift/:giftId", "me", "page", "meTickets"),
  // One Story and its steps, opened from Tickets › Stories (MESITA-4405).
  story: row("/me/tickets/stories/:storyId", "me", "page", "meTickets"),
  pay: row("/pay", "pay", "tab", null),
  // The pay screens own the whole frame, as the place screen does: no bar,
  // the header's back is the way out, so every step fits (MESITA-3739).
  payPick: row("/pay/pick", "pay", "page", "pay"),
  payPlace: row("/pay/place/:placeId", "pay", "door", "pay", false),
  payBill: row("/pay/bill/:billId", "pay", "page", "pay", false),
  payJoin: row("/pay/join/:token", "pay", "door", "pay", false),
  payReceipt: row("/pay/receipt/:paymentId", "pay", "page", "pay", false),
  // THE WALLET IS PAY'S LOWER HALF (MESITA-4199): /wallet forwards to /pay;
  // its children keep their addresses, light Pay and land back on it. It
  // was its own tab from MESITA-3722 and again from MESITA-3886.
  wallet: row("/wallet", "pay", "door", "pay"),
  // A Loyalty Card is a nested page: no bar (MESITA-4381).
  walletPlace: row("/wallet/place/:placeId", "pay", "page", "pay", false),
  walletGift: row("/wallet/gift/:token", "pay", "page", "pay"),
  walletAddCard: row("/wallet/cards/new", "pay", "page", "pay"),
  // Payment methods: a nested page, no bar (MESITA-4526).
  walletMethods: row("/wallet/methods", "pay", "page", "pay", false),
  // A saved card, opened from the Wallet rail (MESITA-4112). /cards/new
  // stays the add page: a fixed segment beats this param.
  walletCard: row("/wallet/cards/:cardId", "pay", "page", "pay", false),
  // Pay's Buy Credits and Send Gift lists, and a Loyalty Card's send page,
  // which was a sheet over it (MESITA-4096).
  walletBuy: row("/wallet/buy", "pay", "page", "pay"),
  walletSend: row("/wallet/send", "pay", "page", "pay"),
  walletPlaceSend: row(
    "/wallet/place/:placeId/send",
    "pay",
    "page",
    "walletPlace",
    false,
  ),
  // Share's page, pushed from Pay's Share Mesita button.
  share: row("/share", "pay", "page", "pay"),
  me: row("/me", "me", "tab", null),
  // Sign holds Me's slot while the visitor is anonymous (MESITA-4246).
  sign: row("/sign", "me", "tab", null),
  meProfile: row("/me/profile", "me", "page", "me"),
  meInstagram: row("/me/instagram", "me", "page", "me"),
  // Opened from Settings since the Me cell went Soon (MESITA-3855).
  mePlan: row("/me/plan", "me", "page", "meSettings"),
  meGift: row("/me/gift", "me", "page", "me"),
  // Activity's chips as Me's pages (MESITA-3855).
  meNotifications: row("/me/notifications", "me", "page", "me"),
  meReservations: row("/me/reservations", "me", "page", "me"),
  // Reservations' Past half (MESITA-3888): the same page, its chip picked.
  meReservationsPast: row("/me/reservations/past", "me", "page", "me"),
  meTickets: row("/me/tickets", "me", "page", "me"),
  // One kind of ticket, /me/tickets/<kind>: the same page, chip picked.
  meTicketsKind: row("/me/tickets/:kind", "me", "page", "me"),
  meSettings: row("/me/settings", "me", "page", "me"),
  meSettingsContact: row("/me/settings/contact", "me", "page", "meSettings"),
  meSettingsRefunds: row("/me/settings/refunds", "me", "page", "meSettings"),
  meSettingsFeedback: row("/me/settings/feedback", "me", "page", "meSettings"),
  // Integrations (MESITA-3954); Calendar is also Reservations' header icon.
  meIntegrations: row("/me/integrations", "me", "page", "me"),
  meIntegrationsCalendar: row(
    "/me/integrations/calendar",
    "me",
    "page",
    "meIntegrations",
  ),
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
 *  A fixed segment beats a `:param` (/place/google/x is not /place/:id). */
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

// ─── WHO MAY OPEN A SCREEN (MESITA-4246) ───────────────────────────────────
//
// Anonymous mode: a visitor with no onboarded account opens these rows and
// nothing else. Every other row, and every address under a shell root that
// is no row, is a member's: the proxy, the shell layout and the walled
// pages all read this one list. `routeFor` matches a fixed segment before a
// `:param`, so /place/google/x and /place/x/reserve are their own (member)
// rows, never /place/:id.
const OPEN_ROUTES: ReadonlySet<RouteId> = new Set<RouteId>([
  "home",
  "homeSocial",
  "search",
  "place",
  // Contact and a menu file are the place's own public links (MESITA-4111).
  "placeContact",
  "placeMenu",
  "sign",
]);

/** Can a visitor without an onboarded account open this pathname? */
export function isOpenToAnonymous(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const id = routeFor(path);
  return id !== null && OPEN_ROUTES.has(id);
}

/** Every first segment a row lives under: the edge auth wall's list. */
export function shellRoots(): string[] {
  return [...new Set(COMPILED.map((c) => `/${c.segs[0]}`))];
}

/**
 * Does this path paint inside a routed modal shell? A `panel` row of
 * ROUTE_MAP (MESITA-3646).
 *
 * SlideOverShell opens with
 * `if (!isModalContractPath(pathname)) return null`, so an @modal intercept
 * whose row is not a panel renders BLANK. The route-map tests hold
 * every intercept to a panel row, and only those rows to one.
 */
export function isModalContractPath(pathname: string): boolean {
  const id = routeFor(pathname);
  if (id) {
    const kind = ROUTE_MAP[id].kind;
    return kind === "panel";
  }
  // Two retired addresses still 308 through a panel route (T2).
  return (
    pathname.startsWith(CONSUMER_ROUTES.legacy.savedPlacePrefix) ||
    pathname.startsWith(CONSUMER_ROUTES.legacy.savedReservationPrefix)
  );
}
