import type { Href } from 'expo-router';

// Consumer route contract — port of apps/web-consumer/src/lib/consumer-route-contract.ts.
// Canonical surface paths for agents + deep links. Expo Router file paths differ
// from web hrefs where noted; helpers below return Expo-navigable hrefs.
//
// DRIFT GUARD: this file hand-mirrors the web contract (same convention as
// ef.ts / tokens). Any change to routes or helpers on either side MUST update
// both files in the same PR — web/mobile IA parity is a product rule.
//
// Expo Router ↔ web href map (agents). The bar is Visit · Order · Wallet · Me
// on both platforms (Pato, MESITA-2050); Visit's rail is Home · Search · Chat
// · Favs · Pay. Web draws that rail with a route group over five URLs; here
// every pill is its own hidden (tabs) screen, so each keeps its state when
// the guest switches pills and ConsumerTabBar lights Visit for all five.
//
//   web /discover/scroll  (Visit › Home)   →  Expo /(tabs)/home   (SwipeDeck —
//       mobile has not ported Scroll's vertical deck)
//   web /search           (Visit › Search) →  Expo /(tabs)/search
//   web /discover/chat    (Visit › Chat)   →  Expo /(tabs)/chat
//   web /discover/favs    (Visit › Favs)   →  Expo /(tabs)/favs
//   web /new-visit        (Visit › Pay)    →  Expo /(tabs)/rewards
//   web /order            (Order › Home)   →  Expo /(tabs)/order
//   web /wallet[/*]       (Wallet)         →  Expo /(tabs)/wallet — mobile has
//       no wallet body: Buy is payment UI, which Apple review keeps off
//       mobile, and there is no read-only balances port yet.
//   web /visit/:id  (was /rewards/ticket/:id)  →  Expo app/rewards/ticket/[id].tsx
//       — mobile has NOT renamed the ticket route; still /rewards/ticket/[id].
//   web /me[/*]                            →  Expo /(tabs)/me[/*]
//   web /inbox/*  (308s to /me on web)     →  Expo /inbox/* → Me (orders →
//       Order), same destinations web's redirect table names.
//   web /reservation/:id                   →  Expo /reservation/[id]
//   web /saved/reservations (legacy)       →  Expo /saved/reservations → Me
//   web /pay (legacy)                      →  Expo /pay → /(tabs)/rewards
//   web /place/:id                         →  Expo /place/[id]
//   web /onboard · /share                  →  Expo /onboard · /share
// SANCTIONED DIVERGENCE: web lights the Visit tab from /visit/:id via a
// pathname prefix. Mobile CANNOT — the tab bar reads navigator state, and root
// modal screens cover the tab bar entirely, so no tab is lit. That is correct
// RN, not a bug; do not try to port it.

export const CONSUMER_ROUTES = {
  onboard: '/onboard',
  // The referral page is named Share — /share is canonical on web. Mobile
  // already has the screen (src/app/share.tsx); this key was simply missing.
  share: '/share',
  // VISIT'S RAIL (Pato, MESITA-2050): Home · Search · Chat · Favs · Pay.
  // Same key names as web's contract; each value is a hidden (tabs) screen.
  // Feed left the rail on web and never existed here.
  discoverTabs: {
    scroll: '/(tabs)/home',
    chat: '/(tabs)/chat',
    favs: '/(tabs)/favs',
  },
  search: '/(tabs)/search',
  // Visit's default is its leading pill, Home — web's `/discover/scroll`.
  discoverDefault: '/(tabs)/home',
  // Shared discovery Filters modal — web /filters peer (MESITA-905). Web's
  // redesigned Filters is now a bottom-overlay pill with no route of its own
  // (dropped from web's contract entirely); mobile's modal screen
  // (app/filters.tsx) is still live, so this key stays.
  filters: '/filters',
  place: {
    prefix: '/place/',
  },
  reservation: {
    prefix: '/reservation/',
  },
  // Visit › Pay — web's `newVisit` (`/new-visit`). Named `rewards` because
  // that is mobile's real route (`/(tabs)/rewards`), and the ticket is still
  // at /rewards/ticket/[id], not /visit/[id]. The label is Pay; the route is
  // not the label, the rule every rename of this surface has followed.
  rewards: {
    root: '/(tabs)/rewards',
    ticketPrefix: '/rewards/ticket/',
  },
  // WALLET IS A BOTTOM TAB (MESITA-2050), web's `/wallet`. One screen here:
  // no Buy/Gift/Redeem children, because Buy is payment UI (Apple review).
  wallet: {
    root: '/(tabs)/wallet',
  },
  // ORDER IS A BOTTOM TAB (MESITA-2050), one pill, Home. Web's `/order`.
  order: {
    root: '/(tabs)/order',
    home: '/(tabs)/order',
  },
  // NO `inbox` / `inboxDefault` any more. Activity stopped being a tab on web
  // at MESITA-1609 and a container at MESITA-1626; mobile kept an Activity
  // tab until MESITA-2050 deleted it. Its three sections are Me pages on both
  // platforms, and every /inbox deep link lands on Me.
  me: '/(tabs)/me',
  // Every live DestTile on /me (MESITA-1789) — full pages, not sheets.
  // Expo group is stripped in the public URL, so these match web's /me/<box>.
  mePages: {
    profile: '/(tabs)/me/profile',
    // THE TWO FACTS, AT TWO ADDRESSES (Pato, MESITA-2040). `/me/class` was
    // ONE page holding a ladder with several doors on it; there is no ladder,
    // so there is no page for one. Instagram leads because it is the door
    // anyone can walk through. Mirrors web's contract exactly.
    instagram: '/(tabs)/me/instagram',
    diamond: '/(tabs)/me/diamond',
    diamondInvite: '/(tabs)/me/diamond/invite',
    plan: '/(tabs)/me/plan',
    settings: '/(tabs)/me/settings',
    settingsMetrics: '/(tabs)/me/settings/metrics',
    settingsContact: '/(tabs)/me/settings/contact',
    help: '/(tabs)/me/help',
    notifications: '/(tabs)/me/notifications',
    visits: '/(tabs)/me/visits',
    reservations: '/(tabs)/me/reservations',
  },
  // Premium checkout deliberately has NO mobile route (Apple review — the
  // sole sanctioned web/mobile divergence): subscribing happens on web, at
  // https://consumer.mesita.ai/me/plan. Premium status still renders here.
  legacy: {
    profile: '/profile',
    invite: '/invite',
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
