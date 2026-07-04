// Consumer route contract (canonical surface paths + modal paths).
// Keep this as the single source of truth so nav, headers, middleware, and
// route handlers don't drift into stringly-typed mismatches.

export const CONSUMER_ROUTES = {
  onboard: "/onboard",
  share: "/share",
  // Discovery hub (Swipe / Social / Favorites modes are client state, not routes).
  home: "/home",
  // Map + catalog search + Ask AI concierge (panels are client state, not routes).
  search: "/search",
  explore: {
    swipe: "/explore/swipe",
    map: "/explore/map",
    add: "/explore/add",
    placePrefix: "/explore/place/",
  },
  saved: {
    places: "/saved/places",
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
    plan: "/me/plan",
    settings: "/me/settings",
  },
  legacy: {
    profile: "/profile",
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
  explore: "/explore",
  saved: "/saved",
  pay: "/pay",
  inbox: "/inbox",
  me: "/me",
} as const;

export type PlaceSurface = "explore" | "saved";

export function placePath(
  idOrSlug: string,
  surface: PlaceSurface = "explore",
): string {
  const prefix =
    surface === "saved"
      ? CONSUMER_ROUTES.saved.placePrefix
      : CONSUMER_ROUTES.explore.placePrefix;
  return `${prefix}${idOrSlug}`;
}

export function reservationPath(id: string): string {
  return `${CONSUMER_ROUTES.saved.reservationPrefix}${id}`;
}

export function payTicketPath(id: string): string {
  return `${CONSUMER_ROUTES.pay.ticketPrefix}${id}`;
}

export function ticketPath(id: string): string {
  return payTicketPath(id);
}

export function isModalContractPath(pathname: string): boolean {
  return (
    pathname.startsWith(CONSUMER_ROUTES.explore.placePrefix) ||
    pathname.startsWith(CONSUMER_ROUTES.saved.placePrefix) ||
    pathname.startsWith(CONSUMER_ROUTES.saved.reservationPrefix) ||
    pathname.startsWith(CONSUMER_ROUTES.pay.ticketPrefix)
  );
}
