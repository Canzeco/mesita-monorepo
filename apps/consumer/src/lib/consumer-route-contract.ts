// Consumer route contract (canonical surface paths + modal paths).
// Keep this as the single source of truth so nav, headers, middleware, and
// route handlers don't drift into stringly-typed mismatches.

export const CONSUMER_ROUTES = {
  onboard: "/onboard",
  // The referral page is named Invite — the mechanic is person-to-person
  // (gift cards, friends who joined), so the page is the noun and "share"
  // is only the action on it. /share is the legacy path (redirects here).
  invite: "/invite",
  // Discovery hub (Swipe / Social / Favorites modes are client state, not routes).
  home: "/home",
  // Map + catalog search + Ask AI concierge (panels are client state, not routes).
  search: "/search",
  // The saved-places list lives on Home > Favorites (a client-state mode, not
  // its own route). This is the canonical "view my saved places" destination —
  // the old standalone /saved/places grid was a duplicate and was removed.
  favorites: "/home?mode=favorites",
  place: {
    prefix: "/place/",
  },
  saved: {
    reservations: "/saved/reservations",
    placePrefix: "/saved/place/",
    reservationPrefix: "/saved/reservation/",
  },
  pay: {
    qr: "/pay/qr",
    tickets: "/pay/tickets",
    ticketPrefix: "/pay/ticket/",
  },
  inbox: {
    mine: "/inbox/mine",
    global: "/inbox/global",
  },
  me: {
    // Consumers have a CLASS (Free / Premium), never a "plan" — plans belong
    // to businesses. The old /me/plan segment redirects here.
    class: "/me/class",
    settings: "/me/settings",
  },
  legacy: {
    profile: "/profile",
    share: "/share",
    mePlan: "/me/plan",
    notifications: "/notifications",
    inboxMine: "/inbox/my-activity",
    inboxGlobal: "/inbox/global-activity",
    placePrefix: "/place/",
    reservationPrefix: "/reservation/",
    ticketPrefix: "/ticket/",
    payTicketsPrefix: "/pay/tickets/",
  },
} as const;

export const CONSUMER_ROUTE_PREFIX = {
  home: "/home",
  search: "/search",
  place: "/place",
  saved: "/saved",
  pay: "/pay",
  inbox: "/inbox",
  me: "/me",
} as const;

// The Reservations tab surface: the singular prefix matches both the
// /saved/reservations list and /saved/reservation/[id] details, so nav
// highlighting and headers share one matcher instead of string literals.
export const CONSUMER_RESERVATION_SURFACE_PREFIX = "/saved/reservation";

export type PlaceSurface = "place" | "saved";

export function placePath(
  idOrSlug: string,
  surface: PlaceSurface = "place",
): string {
  const prefix =
    surface === "saved"
      ? CONSUMER_ROUTES.saved.placePrefix
      : CONSUMER_ROUTES.place.prefix;
  return `${prefix}${idOrSlug}`;
}

export function reservationPath(id: string): string {
  return `${CONSUMER_ROUTES.saved.reservationPrefix}${id}`;
}

// Coupon detail is singular /coupon/[id] (list lives at /coupons).
export const COUPON_PATH_PREFIX = "/coupon/";

export function couponPath(id: string): string {
  return `${COUPON_PATH_PREFIX}${id}`;
}

export function payTicketPath(id: string): string {
  return `${CONSUMER_ROUTES.pay.ticketPrefix}${id}`;
}

export function ticketPath(id: string): string {
  return payTicketPath(id);
}

export function isModalContractPath(pathname: string): boolean {
  return (
    pathname.startsWith(CONSUMER_ROUTES.place.prefix) ||
    pathname.startsWith(CONSUMER_ROUTES.saved.placePrefix) ||
    pathname.startsWith(CONSUMER_ROUTES.saved.reservationPrefix) ||
    pathname.startsWith(CONSUMER_ROUTES.pay.ticketPrefix) ||
    pathname.startsWith(COUPON_PATH_PREFIX)
  );
}
