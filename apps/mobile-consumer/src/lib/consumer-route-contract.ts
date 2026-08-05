import type { Href } from 'expo-router';

// Consumer route contract — port of apps/web-consumer/src/lib/consumer-route-contract.ts.
// Canonical surface paths for agents + deep links. Expo Router file paths differ
// from web hrefs where noted; helpers below return Expo-navigable hrefs.
//
// Expo Router ↔ web href map (agents):
//   web /home[/swipe|ai|social|favorites]  →  Expo /(tabs)/home  (modes are
//       in-screen state on mobile, not nested routes — same IA)
//   web /search                            →  Expo /(tabs)/search
//   web /rewards                           →  Expo /(tabs)/rewards  (also /rewards)
//   web /reservations                      →  Expo /(tabs)/reservations
//   web /reservation/:id                   →  Expo /reservation/[id]
//   web /saved/reservations (legacy)       →  Expo /saved/reservations → tab
//   web /pay (legacy)                      →  Expo /pay → /(tabs)/rewards
//   web /me                                →  Expo /(tabs)/me
//   web /place/:id                         →  Expo /place/[id]
//   web /rewards/ticket/:id                →  Expo /rewards/ticket/[id]
//   web /onboard                           →  Expo /onboard
//   web /share                             →  Expo /share
//   web /inbox/{mine,global}               →  Expo /inbox/{mine,global}

export const CONSUMER_ROUTES = {
  onboard: '/onboard',
  // The referral page is named Share — /share is canonical on web.
  share: '/share',
  // Discovery hub. On web, modes are nested routes; on Expo they are SegmentNav
  // state inside /(tabs)/home. Constants keep the mental model aligned.
  home: '/(tabs)/home',
  homeTabs: {
    swipe: '/(tabs)/home',
    ai: '/(tabs)/home',
    social: '/(tabs)/home',
    favorites: '/(tabs)/home',
  },
  homeDefault: '/(tabs)/home',
  search: '/(tabs)/search',
  favorites: '/(tabs)/home',
  place: {
    prefix: '/place/',
  },
  reservations: '/(tabs)/reservations',
  reservation: {
    prefix: '/reservation/',
  },
  saved: {
    placePrefix: '/place/',
  },
  rewards: {
    root: '/(tabs)/rewards',
    ticketPrefix: '/rewards/ticket/',
  },
  inbox: {
    mine: '/inbox/mine',
    global: '/inbox/global',
  },
  me: '/(tabs)/me',
  legacy: {
    profile: '/profile',
    invite: '/invite',
    meClass: '/me/class',
    meSettings: '/me/settings',
    mePlan: '/me/plan',
    notifications: '/notifications',
    inboxMine: '/inbox/my-activity',
    inboxGlobal: '/inbox/global-activity',
    placePrefix: '/place/',
    ticketPrefix: '/ticket/',
    pay: '/pay',
    payTicketPrefix: '/pay/ticket/',
    payTicketsPrefix: '/pay/tickets/',
    savedReservations: '/saved/reservations',
    savedReservationPrefix: '/saved/reservation/',
  },
} as const;

type PlaceSurface = 'place' | 'saved';

/** Cast dynamic Expo paths for typed router.push (typed routes regenerate lag). */
function asHref(path: string): Href {
  return path as Href;
}

/** Inbox routes exist on disk; typed-routes lag until expo export regenerates. */
export function inboxPath(which: 'mine' | 'global' = 'mine'): Href {
  return asHref(CONSUMER_ROUTES.inbox[which]);
}

export function placePath(
  idOrSlug: string,
  _surface: PlaceSurface = 'place',
): Href {
  // Mobile has a single place detail route (no /saved/place duplicate).
  void _surface;
  return asHref(`${CONSUMER_ROUTES.place.prefix}${idOrSlug}`);
}

export function reservationPath(id: string): Href {
  return asHref(`${CONSUMER_ROUTES.reservation.prefix}${id}`);
}

const COUPON_PATH_PREFIX = '/coupon/';

export function couponPath(id: string): Href {
  return asHref(`${COUPON_PATH_PREFIX}${id}`);
}

export function rewardsTicketPath(id: string): Href {
  return asHref(`${CONSUMER_ROUTES.rewards.ticketPrefix}${id}`);
}
