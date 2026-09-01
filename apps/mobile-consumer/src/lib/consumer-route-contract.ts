import type { Href } from 'expo-router';

// Consumer route contract — port of apps/web-consumer/src/lib/consumer-route-contract.ts.
// Canonical surface paths for agents + deep links. Expo Router file paths differ
// from web hrefs where noted; helpers below return Expo-navigable hrefs.
//
// DRIFT GUARD: this file hand-mirrors the web contract (same convention as
// ef.ts / tokens). Any change to routes or helpers on either side MUST update
// both files in the same PR — web/mobile IA parity is a product rule.
//
// Expo Router ↔ web href map (agents):
//   web /home[/swipe|catalog|ai|social|favorites]
//                                          →  Expo /(tabs)/home  (modes are
//       in-screen state on mobile, not nested routes — same IA)
//   web /search                            →  Expo /(tabs)/search
//   web /rewards                           →  Expo /(tabs)/rewards  (also /rewards)
// WEB HAS MOVED AHEAD (routing v2 S1, 2026-08-17). The port is a SEPARATE PR
// because it is a file-move on this side (Expo route files ARE the paths) with
// its own Metro verification loop:
//   web /rewards            ->  /new-visit        (Expo: (tabs)/rewards.tsx)
//   web /rewards/ticket/:id ->  /visit/:id        (Expo: app/rewards/ticket/[id].tsx)
//   web /home/ai            ->  /home/chat        (Expo: Home screen segment)
//   web /saved/*            DELETED
// SANCTIONED DIVERGENCE: web lights the Inbox tab from /visit/:id via a
// pathname prefix. Mobile CANNOT — the tab bar reads navigator state, and root
// modal screens cover the tab bar entirely, so no tab is lit. That is correct
// RN, not a bug; do not try to port it.
//
//   web /inbox/<section>                   →  Expo /(tabs)/inbox (segments)
//   web /reservation/:id                   →  Expo /reservation/[id]
//   web /saved/reservations (legacy)       →  Expo /saved/reservations → tab
//   web /pay (legacy)                      →  Expo /pay → /(tabs)/rewards
//   web /me                                →  Expo /(tabs)/me
//   web /place/:id                         →  Expo /place/[id]
//   web /rewards/ticket/:id                →  Expo /rewards/ticket/[id]
//   web /onboard                           →  Expo /onboard
//   web /share                             →  Expo /share
//   web /inbox/{mine,global} (legacy)      →  Expo /inbox/* → the Inbox tab

export const CONSUMER_ROUTES = {
  onboard: '/onboard',
  // The referral page is named Share — /share is canonical on web.
  share: '/share',
  // Discovery hub. On web, modes are nested routes; on Expo they are SegmentNav
  // state inside /(tabs)/home. Constants keep the mental model aligned.
  home: '/(tabs)/home',
  homeTabs: {
    swipe: '/(tabs)/home',
    catalog: '/(tabs)/home',
    ai: '/(tabs)/home',
    social: '/(tabs)/home',
    favorites: '/(tabs)/home',
  },
  homeDefault: '/(tabs)/home',
  search: '/(tabs)/search',
  // Shared discovery Filters modal — web /filters peer (MESITA-905). Expo
  // Stack screen with presentation: 'modal'; values stay in the store.
  filters: '/filters',
  favorites: '/(tabs)/home',
  place: {
    prefix: '/place/',
  },
  reservation: {
    prefix: '/reservation/',
  },
  rewards: {
    root: '/(tabs)/rewards',
    ticketPrefix: '/rewards/ticket/',
  },
  // Inbox — the container tab, four sections in a FIXED order (Pato,
  // 2026-08-16): Visits · Orders · Reservations · Notifications, running from
  // what you're doing right now out to the passive feed.
  //
  // Web makes these nested routes (/inbox/<section>); here the tab screen
  // holds them as segments, which is the RN-native shape. These paths are the
  // web contract mirrored for deep-link parity — the tab route itself is
  // `/(tabs)/inbox`.
  inbox: {
    root: '/(tabs)/inbox',
    // Credits leads the web row but is NOT the default section (web contract,
    // 2026-09-01). Mobile's SegmentNav still renders four — the fifth pill
    // waits for the copy pass; this key exists so the mirror stays honest.
    credits: '/inbox/credits',
    visits: '/inbox/visits',
    orders: '/inbox/orders',
    reservations: '/inbox/reservations',
    notifications: '/inbox/notifications',
  },
  inboxDefault: '/(tabs)/inbox',
  me: '/(tabs)/me',
  // Premium checkout deliberately has NO mobile route (Apple review — the
  // sole sanctioned web/mobile divergence): subscribing happens on web, at
  // https://consumer.mesita.ai/me — the Plan box opens the checkout sheet.
  // /subscribe/premium was that URL until MESITA-1129 and still 308s to /me,
  // so an older build's link-out keeps working; new links should use /me.
  legacy: {
    profile: '/profile',
    invite: '/invite',
    meClass: '/me/class',
    meSettings: '/me/settings',
    mePlan: '/me/plan',
    notifications: '/notifications',
    inboxMine: '/inbox/my-activity',
    inboxGlobal: '/inbox/global-activity',
    // The notifications pair reached from Me, before Inbox became one surface
    // with four sections. Both fold into the Notifications section.
    inboxMineTab: '/inbox/mine',
    inboxGlobalTab: '/inbox/global',
    // The reservations LIST used to be its own tab route.
    reservations: '/(tabs)/reservations',
    placePrefix: '/place/',
    ticketPrefix: '/ticket/',
    pay: '/pay',
    payTicketPrefix: '/pay/ticket/',
    payTicketsPrefix: '/pay/tickets/',
    savedReservations: '/saved/reservations',
    savedReservationPrefix: '/saved/reservation/',
  },
} as const;

/** Cast dynamic Expo paths for typed router.push (typed routes regenerate lag). */
function asHref(path: string): Href {
  return path as Href;
}

/** Inbox routes exist on disk; typed-routes lag until expo export regenerates. */
export function inboxPath(
  section: 'visits' | 'orders' | 'reservations' | 'notifications' = 'visits',
): Href {
  return asHref(CONSUMER_ROUTES.inbox[section]);
}

/** The Inbox TAB itself (not a section deep link). */
export function inboxTabPath(): Href {
  return asHref(CONSUMER_ROUTES.inboxDefault);
}

export function filtersPath(): Href {
  return asHref(CONSUMER_ROUTES.filters);
}

export function placePath(idOrSlug: string): Href {
  return asHref(`${CONSUMER_ROUTES.place.prefix}${idOrSlug}`);
}

export function reservationPath(id: string): Href {
  return asHref(`${CONSUMER_ROUTES.reservation.prefix}${id}`);
}

export function rewardsTicketPath(id: string): Href {
  return asHref(`${CONSUMER_ROUTES.rewards.ticketPrefix}${id}`);
}
