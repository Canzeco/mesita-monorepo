import type { Href } from 'expo-router';

// Consumer route contract — port of apps/web-consumer/src/lib/consumer-route-contract.ts.
// Canonical surface paths for agents + deep links. Expo Router file paths differ
// from web hrefs where noted; helpers below return Expo-navigable hrefs.
//
// DRIFT GUARD: this file hand-mirrors the web contract (same convention as
// ef.ts / tokens). Any change to routes or helpers on either side MUST update
// both files in the same PR — web/mobile IA parity is a product rule.
//
// MOBILE IS FROZEN (Pato, 2026-08-20). This file is one of only three mobile
// writes the freeze still allows (the others: ticket-journey.ts byte-identical,
// api/tickets.ts ACTIVE_TICKET_STATUSES) — kept in lockstep so it never drifts
// from web's own pinned test (consumer-route-contract.test.ts). The freeze
// forbids restructuring mobile's actual screens or tab bar, so below: every
// key a live mobile call site depends on keeps its CURRENT name and value;
// only the parts nothing outside this file reads are renamed to mirror web's
// current shape. Where mobile genuinely has not done the underlying screen
// work web already shipped, that gap is called out below, not hidden.
//
// Expo Router ↔ web href map (agents):
//   web /discover[/catalog|search|swipe|chat|favs]  (was /home + /search,
//       merged 2026-09-01, MESITA-1400)      →  Expo /(tabs)/home +
//       /(tabs)/search — mobile has NOT merged these; the tab bar is frozen
//       at five tabs (MESITA-1485), so `search` stays its own real Expo
//       screen and the other four modes stay in-screen state inside Home
//       (same IA as before web's merge, renamed below to match web's current
//       mode names).
//   web /new-visit[/wallet]  (was /rewards, split into New + Wallet sections,
//       2026-09-01)                           →  Expo /(tabs)/rewards —
//       mobile has NOT split it; one screen still covers both.
//   web /visit/:id  (was /rewards/ticket/:id)  →  Expo app/rewards/ticket/[id].tsx
//       — mobile has NOT renamed the ticket route; still /rewards/ticket/[id].
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
//   web /onboard                           →  Expo /onboard
//   web /share                             →  Expo /share
//   web /inbox/{mine,global} (legacy)      →  Expo /inbox/* → the Inbox tab

export const CONSUMER_ROUTES = {
  onboard: '/onboard',
  // The referral page is named Share — /share is canonical on web. Mobile
  // already has the screen (src/app/share.tsx); this key was simply missing.
  share: '/share',
  // DISCOVER (web, MESITA-1400, 2026-09-01): web merged Home + Search into
  // one rail. Mobile has NOT — the tab bar is frozen at five separate tabs
  // (see apps/mobile-consumer/CLAUDE.md, MESITA-1485), so Home and Search
  // stay two distinct Expo screens. These keys mirror web's discoverTabs
  // SHAPE for concept parity: `search` maps to mobile's own separate, real
  // screen; the other four (renamed to web's current names — `ai`→`chat`,
  // `social` folded into `catalog`, `favorites`→`favs`) collapse onto Home's
  // in-screen state, same convention the old `homeTabs` used.
  discoverTabs: {
    catalog: '/(tabs)/home',
    search: '/(tabs)/search',
    swipe: '/(tabs)/home',
    chat: '/(tabs)/home',
    favs: '/(tabs)/home',
  },
  // Web's default is search-first now (`discoverDefault: "/discover/search"`,
  // 2026-09-01). Repointing mobile's default landing tab to Search would be
  // a real behavior change, which the freeze forbids — this stays Home until
  // the copy pass actually merges the tabs.
  discoverDefault: '/(tabs)/home',
  // Same value as discoverDefault, kept under its OLD name only because
  // app/index.tsx's auth-gate redirect — one of the files this freeze
  // forbids touching — imports `homeDefault` by that exact name. A future
  // non-frozen PR that repoints app/index.tsx to `discoverDefault` can
  // delete this alias.
  homeDefault: '/(tabs)/home',
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
  // Web split this into `newVisit` (New + Wallet sections) plus a separate
  // top-level `visit` for the ticket screen (2026-09-01). Mobile has NOT made
  // that split — `/(tabs)/rewards` is still one screen covering both, and
  // the ticket is still at /rewards/ticket/[id], not /visit/[id] — so this
  // stays named `rewards`, matching mobile's real, current routes. `root` is
  // live: app/pay/index.tsx and components/place/place-detail/rewards.tsx
  // (both frozen files) import it by that exact name.
  rewards: {
    root: '/(tabs)/rewards',
    ticketPrefix: '/rewards/ticket/',
  },
  // Activity — the container tab, routed at /inbox on both platforms. Web's
  // four sections run, in the load-bearing product order (Pato, 2026-09-01):
  // Alerts · Visits · Orders · Reservations, Alerts leading. Mobile's own
  // (tabs)/inbox.tsx SECTIONS array has NOT been updated to that order — it
  // is still Visits · Orders · Reservations · Notifications (Pato,
  // 2026-08-16), Notifications last, not leading (MESITA-1486). Fixing the
  // order is a screen change, which the freeze forbids here.
  //
  // NO `credits` key any more: web moved Wallet out of Activity into Pay
  // (`newVisit.wallet`, 2026-09-01), and nothing in mobile ever consumed
  // `inbox.credits` — no Credits/Wallet section exists anywhere under
  // components/inbox/ — so it is dropped rather than carried forward dead.
  //
  // Key order below follows MOBILE's actual current section order, not
  // web's: this object has no runtime effect (nothing iterates it; the guest
  // sees (tabs)/inbox.tsx's own SECTIONS array), so the order here is
  // documentation and should describe mobile's reality, not claim parity it
  // doesn't have.
  inbox: {
    root: '/(tabs)/inbox',
    visits: '/inbox/visits',
    orders: '/inbox/orders',
    reservations: '/inbox/reservations',
    notifications: '/inbox/notifications',
  },
  // Was pointing at the bare tab root with no explanation. Mobile's Inbox tab
  // already defaults its own internal segment state to 'visits' (see the
  // useState in (tabs)/inbox.tsx) — matching web's inboxDefault
  // (/inbox/visits) semantically. The VALUE below intentionally stays the
  // tab route rather than the literal string "/inbox/visits": mobile has no
  // distinct per-section screen (app/inbox/[tab].tsx blanket-redirects any
  // /inbox/:tab, "visits" included, straight back to inboxTabPath()), so
  // setting this to "/inbox/visits" would make that redirect loop on itself.
  // This value is the correct, working one.
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
