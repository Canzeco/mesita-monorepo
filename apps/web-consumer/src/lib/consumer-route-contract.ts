// Consumer route contract (canonical surface paths + modal paths).
// Keep this as the single source of truth so nav, headers, middleware, and
// route handlers don't drift into stringly-typed mismatches.

export const CONSUMER_ROUTES = {
  onboard: "/onboard",
  // The referral page is named Share — /share is canonical. /invite is the
  // legacy path (redirects here).
  share: "/share",
  // Discovery hub. The modes are REAL nested routes (/home/{swipe,ai,social,
  // favorites}); bare /home redirects to the default (swipe).
  home: "/home",
  homeTabs: {
    swipe: "/home/swipe",
    ai: "/home/ai",
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
  // Reservations tab — list + singular detail. Formerly under /saved/* when
  // "Saved" was a tab; favorites moved to /home/favorites, so the namespace
  // was a lie. /saved/reservations + /saved/reservation/[id] redirect here.
  reservations: "/reservations",
  reservation: {
    prefix: "/reservation/",
  },
  saved: {
    // Dual place-detail path from Favorites (collapse later). Not reservations.
    placePrefix: "/saved/place/",
  },
  // Rewards is a single page (banner + Mesita passport + tickets). The tab
  // used to live at /pay — that whole tree now redirects here. Ticket detail
  // is /rewards/ticket/[id].
  rewards: {
    root: "/rewards",
    ticketPrefix: "/rewards/ticket/",
  },
  inbox: {
    mine: "/inbox/mine",
    global: "/inbox/global",
  },
  // The Me tab is a single flat page — identity hero + modular boxes that open
  // as modals (Class, Settings, …). There are NO nested tab routes; /me is the
  // whole surface. Legacy /me/class, /me/settings, and /me/plan redirect here.
  me: "/me",
  legacy: {
    profile: "/profile",
    invite: "/invite",
    meClass: "/me/class",
    meSettings: "/me/settings",
    mePlan: "/me/plan",
    notifications: "/notifications",
    inboxMine: "/inbox/my-activity",
    inboxGlobal: "/inbox/global-activity",
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
  },
} as const;

export const CONSUMER_ROUTE_PREFIX = {
  home: "/home",
  search: "/search",
  place: "/place",
  reservations: "/reservations",
  rewards: "/rewards",
  inbox: "/inbox",
  me: "/me",
  saved: "/saved",
} as const;

// Matches both the /reservations list and /reservation/[id] details
// (`/reservations`.startsWith(`/reservation`) is intentional).
export const CONSUMER_RESERVATION_SURFACE_PREFIX = "/reservation";

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
  return `${CONSUMER_ROUTES.reservation.prefix}${id}`;
}

// Coupon detail is singular /coupon/[id] (list lives at /coupons).
const COUPON_PATH_PREFIX = "/coupon/";

export function couponPath(id: string): string {
  return `${COUPON_PATH_PREFIX}${id}`;
}

export function rewardsTicketPath(id: string): string {
  return `${CONSUMER_ROUTES.rewards.ticketPrefix}${id}`;
}

export function ticketPath(id: string): string {
  return rewardsTicketPath(id);
}

export function isModalContractPath(pathname: string): boolean {
  return (
    pathname.startsWith(CONSUMER_ROUTES.place.prefix) ||
    pathname.startsWith(CONSUMER_ROUTES.saved.placePrefix) ||
    pathname.startsWith(CONSUMER_ROUTES.reservation.prefix) ||
    pathname.startsWith(CONSUMER_ROUTES.legacy.savedReservationPrefix) ||
    pathname.startsWith(CONSUMER_ROUTES.rewards.ticketPrefix) ||
    pathname.startsWith(COUPON_PATH_PREFIX)
  );
}
