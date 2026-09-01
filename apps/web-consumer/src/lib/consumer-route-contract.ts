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
  // Discovery hub. The modes are REAL nested routes (/home/{swipe,catalog,ai,
  // social,favorites}); bare /home redirects to the default (swipe).
  home: "/home",
  homeTabs: {
    swipe: "/home/swipe",
    catalog: "/home/catalog",
    // The AI concierge mode. The pill has read "Chat" since 2026-08-16; the
    // route caught up here. Don Memo is the persona you meet inside it, not
    // the name of the destination. /home/ai 308s to this.
    chat: "/home/chat",
    social: "/home/social",
    favorites: "/home/favorites",
  },
  // Default landing for the Home tab — link straight here so the bare /home
  // redirect hop is only hit by direct URLs / legacy deep links.
  homeDefault: "/home/swipe",
  // Map + catalog search (Ask AI now lives on Home).
  search: "/search",
  // The saved-places list lives on the Home > Favorites route. This is the
  // canonical "view my saved places" destination — the old standalone
  // /saved/places grid was a duplicate and was removed.
  favorites: "/home/favorites",
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
  home: "/home",
  search: "/search",
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
