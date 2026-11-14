// THE LEGACY REDIRECT TABLE, BARE (moved out of next.config.ts, MESITA-2138).
//
// Static legacy → canonical redirects live here as zero-render 308s
// (MESITA-899). Redirects with logic (query mapping — /me/[tab]) stay as
// server pages. Query strings are preserved automatically. The redirect
// table is pinned by src/lib/__tests__/consumer-route-contract.test.ts;
// route-structure T4 proves every destination resolves in at most two hops
// and T7 proves the load-bearing entries exist.
//
// A REDIRECT WHOSE SOURCE IS A LIVE ROUTE SHADOWS IT ENTIRELY — the page
// never renders and typecheck, build and the whole vitest suite stay green.
// Nothing here may name /home/places, /home/social, /pay, /wallet, /search,
// /search/chat, /me or any live /me/<box>. Pay and Wallet have live children
// (/pay/<placeId>, /pay/tab/<id>, /pay/receipt/<id>, /wallet/<placeId>,
// /wallet/gift/<token>, MESITA-3614), so their old children are listed by
// name, never as a `:param` that would swallow a live one.
//
// BARE ONLY. The /web and /mob surface prefixes are retired (MESITA-3013):
// SURFACE_PREFIX_REDIRECTS below sends each to its bare path in one 308, and
// a prefixed retired address then takes a second hop through this table.
import { ticketsHref } from "./ticket-kinds";

/** The slice of Next's redirect shape this table uses. `has` matches a held
 *  query (MESITA-3688: `?tab=reservations` on the Favorites addresses). */
export type Redirect = {
  source: string;
  destination: string;
  permanent: boolean;
  has?: Array<{ type: "query"; key: string; value: string }>;
};

export const LEGACY_REDIRECTS: Redirect[] = [
  // Explore era (pre-Home). Straight to the Discover default.
  { source: "/explore", destination: "/home/places", permanent: true },
  {
    source: "/explore/swipe",
    destination: "/home/places",
    permanent: true,
  },
  { source: "/explore/map", destination: "/home/places", permanent: true },
  { source: "/explore/add", destination: "/home/places", permanent: true },
  {
    source: "/explore/place/:id",
    destination: "/place/:id",
    permanent: true,
  },
  // THE SECOND STAGE (MESITA-2087). Every address that used to hang off the
  // centre tab lands on the Pay tab: the
  // QR place list (/new-visit), THE TICKET (/visit/:id and its /rewards,
  // /pay and /ticket era spellings), Wallet with Buy · Gift · Redeem ·
  // balance and its /credits, /inbox/credits and /new-visit/wallet
  // spellings, the Order tab, and the public gift landing. Each is ONE
  // hop. Deepest sources first so the intent survives a `:param` rewrite.
  {
    source: "/new-visit/wallet/:path*",
    destination: "/wallet",
    permanent: true,
  },
  { source: "/new-visit", destination: "/pay", permanent: true },
  // The old Wallet tab's children and its other spellings land on the
  // Wallet, Pay's second half (MESITA-3698; on /pay from MESITA-3631).
  { source: "/wallet/balance/:id", destination: "/wallet", permanent: true },
  { source: "/wallet/buy", destination: "/wallet", permanent: true },
  { source: "/wallet/gift", destination: "/wallet", permanent: true },
  { source: "/wallet/redeem", destination: "/wallet", permanent: true },
  { source: "/credits", destination: "/wallet", permanent: true },
  { source: "/inbox/credits", destination: "/wallet", permanent: true },
  { source: "/inbox/orders", destination: "/pay", permanent: true },
  { source: "/order", destination: "/pay", permanent: true },
  { source: "/rewards/ticket/:id", destination: "/pay", permanent: true },
  { source: "/rewards", destination: "/pay", permanent: true },
  { source: "/pay/ticket/:id", destination: "/pay", permanent: true },
  { source: "/pay/tickets/:id", destination: "/pay", permanent: true },
  { source: "/pay/wallet", destination: "/wallet", permanent: true },
  { source: "/pay/qr", destination: "/pay", permanent: true },
  { source: "/qr", destination: "/pay", permanent: true },
  { source: "/ticket/:id", destination: "/pay", permanent: true },
  { source: "/visit/:id", destination: "/pay", permanent: true },
  { source: "/gift/:code", destination: "/pay", permanent: true },
  // Me's Second Stage boxes (MESITA-2087): the class ladder, the Diamond
  // pair and its invite PIN, Plan and the Pro checkout, Visits,
  // Metrics, the Passport, the referral Share deck. The `/me/[tab]`
  // catch-all already 308s a retired ONE-segment /me address onto the
  // hub; the two-segment ones need an entry or they 404.
  { source: "/subscribe", destination: "/me", permanent: true },
  { source: "/subscribe/:plan", destination: "/me", permanent: true },
  // /web's anonymous "Get the app" screen (MESITA-2137): Home, behind the wall.
  { source: "/get-the-app", destination: "/home/places", permanent: true },
  { source: "/me/class/invite", destination: "/me", permanent: true },
  { source: "/me/diamond/invite", destination: "/me", permanent: true },
  { source: "/me/diamond", destination: "/me", permanent: true },
  {
    source: "/me/settings/metrics",
    destination: "/me/settings",
    permanent: true,
  },
  // The Passport (MESITA-2043).
  { source: "/me/passport", destination: "/me/profile", permanent: true },
  // Support (MESITA-2169). Terms and privacy live on Settings.
  { source: "/me/help", destination: "/me/settings", permanent: true },
  // Me › Transactions became Activity (MESITA-3631) and is Me › Tickets
  // again (MESITA-3855).
  { source: "/me/transactions", destination: ticketsHref(), permanent: true },
  // MESITA-3771: MCP is a perk on Plan; Refunds is Tickets' chip (MESITA-3855).
  { source: "/me/connector", destination: "/me/plan", permanent: true },
  {
    source: "/me/refunds",
    destination: ticketsHref("refunds"),
    permanent: true,
  },
  // NO /activity ADDRESS REDIRECTS ANYWHERE (Pato, 2026-11-14, MESITA-3862:
  // "KILL THIS ATIVITY LINK"). Activity folded into Me (MESITA-3855); its
  // own addresses are gone, not forwarded. Never add one back here.
  // SHARE IS A BAR BUTTON, NOT A PAGE (MESITA-3855): its old page lands on
  // Home.
  { source: "/share", destination: "/home/places", permanent: true },
  { source: "/invite", destination: "/me", permanent: true },
  // The retired Home hub's leaves (2026-09-01). /home ITSELF went to Places
  // when each tab got its own address (MESITA-2597); /home/social is live
  // again. NOTHING HERE MAY CHAIN THROUGH /discover/map OR /discover/search —
  // both are themselves 308s.
  { source: "/home", destination: "/home/places", permanent: true },
  { source: "/home/swipe", destination: "/home/places", permanent: true },
  { source: "/home/catalog", destination: "/home/places", permanent: true },
  { source: "/home/chat", destination: "/home/places", permanent: true },
  { source: "/home/ai", destination: "/home/places", permanent: true },
  { source: "/home/favorites", destination: "/home/places", permanent: true },
  // The trial Places tabs (MESITA-3658…3680), retired when 1.0 became
  // Places again (MESITA-3684).
  { source: "/home/classic", destination: "/home/places", permanent: true },
  { source: "/home/grid", destination: "/home/places", permanent: true },
  { source: "/home/rails", destination: "/home/places", permanent: true },
  // Places 3.0's own tab is Places since MESITA-3789.
  { source: "/home/rows", destination: "/home/places", permanent: true },
  // Search's two addresses under /discover (MESITA-1609 → MESITA-1616),
  // straight to the canonical /search. T7 pins both.
  { source: "/discover/search", destination: "/search", permanent: true },
  { source: "/discover/map", destination: "/search", permanent: true },
  // HOME IS /home (Pato, MESITA-2475). Its old namespace and default pill.
  { source: "/discover", destination: "/home/places", permanent: true },
  { source: "/discover/places", destination: "/home/places", permanent: true },
  // Catalog's day as Home, Swipe's week as the default, Catalog's own
  // segment (MESITA-1697). Every retired Home address forwards to Home.
  { source: "/discover/home", destination: "/home/places", permanent: true },
  {
    source: "/discover/catalog",
    destination: "/home/places",
    permanent: true,
  },
  // CATALOG LEFT HOME'S RAIL AGAIN (MESITA-2140).
  {
    source: "/discover/feed",
    destination: "/home/places",
    permanent: true,
  },
  // SCROLL (MESITA-2163) AND SWIPE (MESITA-2166) LEFT HOME'S RAIL: Home is
  // Places · Social (MESITA-2401).
  {
    source: "/discover/scroll",
    destination: "/home/places",
    permanent: true,
  },
  {
    source: "/discover/swipe",
    destination: "/home/places",
    permanent: true,
  },
  // FAVORITES LEFT HOME'S RAIL FOR THE PLACES COLUMN (MESITA-2383).
  {
    source: "/discover/favs",
    destination: "/home/places",
    permanent: true,
  },
  // SOCIAL WAS A PAGE (MESITA-2442), THEN A PANE OF HOME (MESITA-2474), AND
  // IS HOME'S SOCIAL TAB NOW (MESITA-2597).
  {
    source: "/discover/social",
    destination: "/home/social",
    permanent: true,
  },
  // CHAT LEFT HOME FOR THE SEARCH TAB (MESITA-2401).
  {
    source: "/discover/chat",
    destination: "/search/chat",
    permanent: true,
  },
  // THE PLACES TEST TAB DIED (MESITA-2405).
  { source: "/places", destination: "/home/places", permanent: true },
  // EVERY OLD ADDRESS OF FAVORITES, RESERVATIONS AND NOTIFICATIONS LANDS ON
  // ITS ME PAGE IN ONE HOP (Activity's chip from MESITA-3688, Me's page
  // again since MESITA-3855; /me/reservations and /me/notifications are live
  // pages, so they are not here). Me's own pages (MESITA-2565),
  // /saved (the bar's tab, MESITA-2521), /me/saved (Me's Saved,
  // MESITA-2561), the reservations list's top-level, Bookings and Saved
  // addresses. Next carries a held query across, so a held
  // `?tab=reservations` on the Favorites addresses is matched first and
  // lands on Reservations, as it did through /me/favorites before.
  ...["/saved", "/me/saved", "/me/favorites"].map((source) => ({
    source,
    has: [{ type: "query" as const, key: "tab", value: "reservations" }],
    destination: "/me/reservations",
    permanent: true,
  })),
  // Favorites left Activity (MESITA-3723): the hearts are Home's Saved row
  // (MESITA-3718), so the old Favorites addresses land on Home.
  { source: "/saved", destination: "/home/places", permanent: true },
  { source: "/me/saved", destination: "/home/places", permanent: true },
  { source: "/me/favorites", destination: "/home/places", permanent: true },
  {
    source: "/reservations",
    destination: "/me/reservations",
    permanent: true,
  },
  {
    source: "/bookings",
    destination: "/me/reservations",
    permanent: true,
  },
  {
    source: "/saved/reservations",
    destination: "/me/reservations",
    permanent: true,
  },
  {
    source: "/saved/reservation/:id",
    destination: "/reservation/:id",
    permanent: true,
  },
  { source: "/saved/place/:id", destination: "/place/:id", permanent: true },
  { source: "/profile", destination: "/me/profile", permanent: true },
  {
    source: "/notifications",
    destination: "/me/notifications",
    permanent: true,
  },
  // /inbox was Activity's first address (MESITA-1626 sent it to Me); it was
  // Activity again (MESITA-3688) and is Me › Notifications (MESITA-3855). /inbox/credits and
  // /inbox/orders sit ABOVE this and point at Pay: Next takes the first match.
  {
    source: "/inbox/:path*",
    destination: "/me/notifications",
    permanent: true,
  },
];

/** The retired surface prefixes (MESITA-3013): /web/x and /mob/x → /x.
 *  Served AFTER the legacy table so a bare legacy source still wins first. */
export const SURFACE_PREFIX_REDIRECTS: Redirect[] = [
  { source: "/:surface(web|mob)", destination: "/", permanent: true },
  {
    source: "/:surface(web|mob)/:path*",
    destination: "/:path*",
    permanent: true,
  },
];
