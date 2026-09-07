import { describe, expect, it } from "vitest";
import {
  CONSUMER_ROUTES,
  CONSUMER_ROUTE_PREFIX,
  CONSUMER_RESERVATION_SURFACE_PREFIX,
  isModalContractPath,
  placePath,
  reservationPath,
  visitPath,
  ticketPath,
} from "@/lib/consumer-route-contract";
import { shouldGate } from "@/lib/supabase/middleware";
import {
  consumerAuthDestination,
  safeNextPath,
  withNext,
} from "@/lib/auth-redirect";
import { isConsumerOnboarded } from "@/lib/consumer-onboarding";
import nextConfig from "../../../next.config";

// Routing is contract, not implementation detail: five tabs, flat /me,
// canonical /share, top-level /place — see Product Rules §C. These tests pin
// the contract, the helpers, the legacy→canonical redirect table, and the
// middleware auth wall so a rename or a "helpful cleanup" can't silently
// break bookmarks, QR deep links, or the signed-out gate.
//
// If a test here fails because you MEANT to change a route: update the mobile
// contract (apps/mobile-consumer/src/lib/consumer-route-contract.ts) in the
// same PR — the two files are hand-mirrored by convention.

describe("CONSUMER_ROUTES (canonical surface map)", () => {
  it("pins the exact canonical route map", () => {
    expect(CONSUMER_ROUTES).toEqual({
      onboard: "/onboard",
      share: "/share",
      // Search's OWN top-level route (MESITA-1616) — not nested under
      // /discover any more. See the legacy block below for the
      // /discover/search entry that replaced it as a redirect source.
      search: "/search",
      // NO home / homeTabs / homeDefault / favorites keys — the hub was
      // retired 2026-09-01.
      //
      // SEGMENTS MATCH LABELS here, the exception in this codebase: the tab
      // moved to /discover precisely so each typed mode could be a real
      // segment.
      discover: "/discover",
      // FIVE modes, all under Home now that Search has its own route
      // (MESITA-1616). CATALOG is the catalog rails with no search bar at
      // all; FEED (MESITA-1621) is the same deck Swipe deals, poured into one
      // two-column grid.
      //
      // `/discover/feed` IS A ROUTE AGAIN and is therefore NOT in the legacy
      // block below any more — it 308'd to /discover/catalog for the hour the
      // browse mode shipped under that name. A redirect shadows a real page
      // entirely, so the two cannot both exist; the redirect lost. If this
      // key and a `legacy.discoverFeed` ever appear together, the page is
      // dead and only this pairing shows it.
      discoverTabs: {
        swipe: "/discover/swipe",
        feed: "/discover/feed",
        catalog: "/discover/catalog",
        chat: "/discover/chat",
        favs: "/discover/favs",
      },
      // Default IS the first pill (MESITA-1609/1615) — Search left this rail
      // for its own tab, so the reason the default sat off the lead (Search's
      // urgency, buried behind width wins) left with it. Swipe leads and is
      // the default now (MESITA-1615, live instruction), not Catalog.
      // Activity's still-live version of this pattern (Alerts leads, bare
      // /inbox lands on Visits) is a SEPARATE, unaffected decision.
      discoverDefault: "/discover/swipe",
      place: { prefix: "/place/" },
      reservation: { prefix: "/reservation/" },
      // Pay is a container again: New (bare) + Wallet. Wallet spent 2026-09-05
      // to 09-06 as a top-level tab and came back — /wallet is a redirect
      // source now, not a key.
      newVisit: {
        root: "/new-visit",
        new: "/new-visit",
        wallet: "/new-visit/wallet",
      },
      newVisitDefault: "/new-visit",
      visit: { prefix: "/visit/" },
      // THREE sections, and the ORDER is load-bearing: Alerts · Visits ·
      // Reservations runs from what you're doing right now out to the
      // passive feed. Object key order is asserted separately below, since
      // toEqual ignores it.
      // Orders folded into Visits (MESITA-1389, 2026-09-06) — no table, no
      // Edge Function, no type, so there was nothing left to keep a section
      // pointed at. Wallet left for Pay (a wallet holds instruments, Activity
      // holds events) and Alerts leads the row now.
      me: "/me",
      legacy: {
        profile: "/profile",
        subscribe: "/subscribe/premium",
        invite: "/invite",
        homeAi: "/home/ai",
        inboxCredits: "/inbox/credits",
        inboxOrders: "/inbox/orders",
        discoverSearch: "/discover/search",
        discoverMap: "/discover/map",
        // NO `discoverFeed` — /discover/feed is Home's Feed mode now
        // (MESITA-1621), a live page, not a forwarding address.
        discoverHome: "/discover/home",
        rewards: "/rewards",
        rewardsTicketPrefix: "/rewards/ticket/",
        meClass: "/me/class",
        meSettings: "/me/settings",
        mePlan: "/me/plan",
        // Wallet's address for the day it was a top-level tab (09-05 -> 09-06).
        wallet: "/wallet",
        notifications: "/notifications",
        inboxMine: "/inbox/my-activity",
        inboxGlobal: "/inbox/global-activity",
        inboxMineTab: "/inbox/mine",
        inboxGlobalTab: "/inbox/global",
        reservations: "/reservations",
        placePrefix: "/place/",
        reservationPrefix: "/reservation/",
        ticketPrefix: "/ticket/",
        pay: "/pay",
        payTicketPrefix: "/pay/ticket/",
        payTicketsPrefix: "/pay/tickets/",
        savedReservations: "/saved/reservations",
        savedReservationPrefix: "/saved/reservation/",
        savedPlacePrefix: "/saved/place/",
      },
    });
  });

  it("pins the middleware prefix map", () => {
    expect(CONSUMER_ROUTE_PREFIX).toEqual({
      // NO `discover` key (MESITA-1609, removed) — Home and Search now split
      // that namespace and need to light DIFFERENT bottom tabs, so BottomNav
      // matches each discoverTabs segment individually instead.
      place: "/place",
      reservations: "/reservations",
      newVisit: "/new-visit",
      visit: "/visit",
      // NO `inbox` key (MESITA-1626, removed): the container is gone and every
      // /inbox address 308s to /me, so the middleware never sees one.
      me: "/me",
      saved: "/saved",
    });
    expect(CONSUMER_RESERVATION_SURFACE_PREFIX).toBe("/reservation");
  });

  // ACTIVITY HAS NO ROUTES LEFT (MESITA-1626). Its three sections are sheets
  // on Me, and a sheet has no URL, so the `inbox` object and `inboxDefault`
  // are gone rather than kept as dead keys pointing at deleted pages.
  //
  // What used to live here: a pin on the section ORDER, and a pin that bare
  // /inbox landed on Visits rather than the first section (a visit in
  // progress is time-critical, a notification never is). The order survives
  // as a product fact — Alerts · Visits · Bookings — and route-structure T6
  // pins it where it is now observable, in what Me renders.
  it("keeps no route keys for a container that no longer exists", () => {
    expect(CONSUMER_ROUTES).not.toHaveProperty("inbox");
    expect(CONSUMER_ROUTES).not.toHaveProperty("inboxDefault");
    expect(CONSUMER_ROUTE_PREFIX).not.toHaveProperty("inbox");
  });

  // Every /inbox address a guest could still hold has to land somewhere real
  // in ONE hop. The legacy SOURCES stay in the contract on purpose — they are
  // what a bookmark or an old push notification carries — but nothing may
  // point AT the container any more.
  it("sends every /inbox address to Me in one hop, and nothing points back", async () => {
    const table = await nextConfig.redirects!();
    const inbox = table.filter((r) => r.source.startsWith("/inbox"));

    // /inbox/credits is the one exception and it predates the container's
    // death: Credits is an INSTRUMENT, not an event, so it went to Pay's
    // Wallet on 2026-09-01. It must stay ABOVE the catch-all — Next takes the
    // first match, so a catch-all listed first would swallow it and land a
    // wallet bookmark on Me.
    expect(inbox.map((r) => [r.source, r.destination])).toEqual([
      ["/inbox/credits", "/new-visit/wallet"],
      ["/inbox", "/me"],
      ["/inbox/:path*", "/me"],
    ]);

    // A destination pointing back into the container is a guaranteed 404 now.
    expect(
      table.filter((r) => r.destination.startsWith("/inbox")),
    ).toEqual([]);
  });

  // Pay's first section and its default AGREE, unlike Activity's. You open
  // this tab standing in a place, and that is also the leftmost pill.
  it("lands the Pay tab on New, which is also its first section", () => {
    expect(CONSUMER_ROUTES.newVisitDefault).toBe(CONSUMER_ROUTES.newVisit.new);
    expect(CONSUMER_ROUTES.newVisit.new).toBe(CONSUMER_ROUTES.newVisit.root);
  });

  // Wallet is a SECTION of Pay, not a tab and not a section of Activity. Both
  // halves have been tried: /inbox/credits (wrong container — a wallet holds
  // instruments, Activity holds events) and /wallet (right idea, one tab too
  // many). A change that moves it again has to delete this line to do it.
  it("keeps Wallet inside Pay, and nowhere else", () => {
    expect(CONSUMER_ROUTES.newVisit.wallet).toBe("/new-visit/wallet");
    expect(
      CONSUMER_ROUTES.newVisit.wallet.startsWith(CONSUMER_ROUTES.newVisit.root),
    ).toBe(true);
    expect(CONSUMER_ROUTES).not.toHaveProperty("wallet");
  });
});

describe("path helpers", () => {
  it("builds detail paths from ids/slugs", () => {
    expect(placePath("abc-123")).toBe("/place/abc-123");
    expect(reservationPath("r1")).toBe("/reservation/r1");
    expect(visitPath("t1")).toBe("/visit/t1");
    // ticketPath stays as the alias: below the URL the object is still a
    // ticket (the DB column, the EFs and the row types all say ticket), so
    // call sites talking about the OBJECT keep reading naturally.
    expect(ticketPath("t1")).toBe("/visit/t1");
  });
});

describe("isModalContractPath (intercepted detail overlays)", () => {
  const modal = [
    "/place/abc",
    "/saved/place/abc", // legacy — redirects, but still intercepts first
    "/reservation/r1",
    "/saved/reservation/r1", // legacy
  ];
  const notModal = [
    "/",
    "/home",
    "/home/swipe",
    "/search",
    "/reservations",
    "/new-visit",
    // THE TICKET is a full page, not a routed modal — /rewards/ticket/ used to
    // sit in the predicate with no intercept behind it (inert). Removed with
    // the rename rather than carried forward as an inert /visit/ branch.
    "/visit/t1",
    "/home/chat",
    "/me",
    "/inbox/mine",
    "/subscribe/premium",
  ];

  it.each(modal)("%s renders as a modal", (p) => {
    expect(isModalContractPath(p)).toBe(true);
  });

  it.each(notModal)("%s is a plain surface", (p) => {
    expect(isModalContractPath(p)).toBe(false);
  });
});

describe("next.config redirects (static legacy → canonical, 308)", () => {
  it("pins the full redirect table", async () => {
    const redirects = await nextConfig.redirects!();
    expect(redirects).toEqual([
      // Explore era (pre-Home). Repointed at the Discover default when /home
      // was retired — chaining through /home would make these two-hop, and
      // T4 caps at 2. Default is Swipe again as of MESITA-1615.
      { source: "/explore", destination: "/discover/swipe", permanent: true },
      { source: "/explore/swipe", destination: "/discover/swipe", permanent: true },
      { source: "/explore/map", destination: "/discover/swipe", permanent: true },
      { source: "/explore/add", destination: "/discover/swipe", permanent: true },
      {
        source: "/explore/place/:id",
        destination: "/place/:id",
        permanent: true,
      },
      // The centre tab: /pay -> /rewards -> /new-visit. BOTH eras forward
      // here. /rewards was the LIVE url until routing v2, so it needs the
      // forwarding address most — everything below used to chain through it.
      // The plan is a sheet on Me now, not a page (MESITA-1129).
      { source: "/subscribe", destination: "/me", permanent: true },
      { source: "/subscribe/:plan", destination: "/me", permanent: true },
      { source: "/rewards", destination: "/new-visit", permanent: true },
      { source: "/pay", destination: "/new-visit", permanent: true },
      { source: "/pay/:tab", destination: "/new-visit", permanent: true },
      { source: "/qr", destination: "/new-visit", permanent: true },
      // A single visit. The OBJECT is still a ticket; only the URL says visit.
      {
        source: "/rewards/ticket/:id",
        destination: "/visit/:id",
        permanent: true,
      },
      { source: "/pay/ticket/:id", destination: "/visit/:id", permanent: true },
      {
        source: "/pay/tickets/:id",
        destination: "/visit/:id",
        permanent: true,
      },
      { source: "/ticket/:id", destination: "/visit/:id", permanent: true },
      // The retired Home hub (2026-09-01). Every leaf 308s to the Discover
      // default, Swipe again as of MESITA-1615. /home/ai points straight
      // here rather than chaining through /home/chat — that page is deleted,
      // so the old chain would dangle AND cost a second hop against T4's cap
      // of 2.
      { source: "/home", destination: "/discover/swipe", permanent: true },
      { source: "/home/swipe", destination: "/discover/swipe", permanent: true },
      { source: "/home/catalog", destination: "/discover/swipe", permanent: true },
      { source: "/home/chat", destination: "/discover/swipe", permanent: true },
      { source: "/home/ai", destination: "/discover/swipe", permanent: true },
      { source: "/home/social", destination: "/discover/swipe", permanent: true },
      { source: "/home/favorites", destination: "/discover/swipe", permanent: true },
      // The just-shipped Search route (MESITA-1609, six days -> MESITA-1616).
      // Straight to the new canonical /search, never chained through
      // /discover/map, which points here too.
      { source: "/discover/search", destination: "/search", permanent: true },
      // The map's segment while the rail called it Map. Search carries the
      // map now, so this forwards straight to the canonical /search route —
      // not through /discover/search, which is itself a redirect source
      // above. Nothing above may CHAIN through either — every /home* and
      // /explore* points at the mode directly, because a chain here would
      // cost a second hop and T4 caps at exactly 2.
      {
        source: "/discover/map",
        destination: "/search",
        permanent: true,
      },
      // The browse mode shipped as "Home" for a day — live in production, so
      // it forwards like any other retired url, straight to /discover/catalog.
      //
      // ITS SIBLING /discover/feed IS DELIBERATELY ABSENT (MESITA-1621).
      // Catalog also spent an hour as "Feed" and 308'd here alongside Home;
      // that segment is a real page now, and a redirect would shadow it into
      // never rendering. This table is exhaustive — `toEqual` on the whole
      // array — so re-adding the entry fails HERE, which is the point: the
      // page it would break is otherwise silent.
      {
        source: "/discover/home",
        destination: "/discover/catalog",
        permanent: true,
      },
      // The Saved tab and the /saved/place dual path (MESITA-1585).
      { source: "/saved", destination: "/me", permanent: true },
      { source: "/saved/reservations", destination: "/me", permanent: true },
      { source: "/saved/reservation/:id", destination: "/reservation/:id", permanent: true },
      { source: "/saved/place/:id", destination: "/place/:id", permanent: true },
      { source: "/invite", destination: "/share", permanent: true },
      // Wallet's three former addresses, each pointing STRAIGHT at
      // /new-visit/wallet — never at one another, which would be the 3-hop
      // chain T4 refuses. route-structure T7 asserts these separately, because
      // T4 can only validate a destination, never an absence.
      { source: "/credits", destination: "/new-visit/wallet", permanent: true },
      {
        source: "/inbox/credits",
        destination: "/new-visit/wallet",
        permanent: true,
      },
      { source: "/wallet", destination: "/new-visit/wallet", permanent: true },
      { source: "/profile", destination: "/me", permanent: true },
      { source: "/notifications", destination: "/me", permanent: true },
      // ACTIVITY IS GONE AS A CONTAINER (MESITA-1626) — its sections are
      // sheets on Me and a sheet has no URL, so every remaining /inbox
      // address lands on Me in ONE hop. These sit BELOW /inbox/credits on
      // purpose: Next takes the first match, and Credits still belongs to
      // Pay's Wallet.
      { source: "/inbox", destination: "/me", permanent: true },
      { source: "/inbox/:path*", destination: "/me", permanent: true },
    ]);
  });

  // Redirects that carry logic stay as server pages (not in next.config):
  //   /home              → /home/swipe        (default mode)
  //   /home/catalog|chat|social|favorites → /home/swipe (Home is Soon)
  //   /me/[tab]          → /me (+?settings=1) (tab → modal mapping)
  //   /inbox             → /inbox/visits      (default section)
  //   /inbox/[tab]       → /inbox/notifications (mine, global + old aliases)
  //   /reservations      → /inbox/reservations (list moved into Inbox)
  //   /saved             → /inbox/reservations (legacy tab)
  //   /saved/reservation(s)/… → /reservation(s)/…
  //   /saved/place/[id]  → /place/[id]
  // Their targets are pinned via CONSUMER_ROUTES above; the pages themselves
  // are one-line redirect() calls checked by build + typecheck.
});

describe("the AI mode is reachable by both names", () => {
  it("308s /home/ai straight to Discover, one hop", async () => {
    const redirects = await nextConfig.redirects!();
    const hop = redirects.find(
      (r) => r.source === CONSUMER_ROUTES.legacy.homeAi,
    );
    // Was /home/ai -> /home/chat. That page is gone with the rest of the hub,
    // so the old chain would dangle; and even repaired it would have cost two
    // hops (/home/ai -> /home/chat -> /search) against T4's cap of exactly 2,
    // leaving zero margin for the next legacy alias anyone adds.
    expect(hop?.destination).toBe(CONSUMER_ROUTES.discoverDefault);
    // Every retired leaf resolves in ONE hop, for the same reason.
    const homeHops = redirects.filter((r) => r.source.startsWith("/home"));
    expect(homeHops).not.toHaveLength(0);
    for (const r of homeHops) {
      expect(r.destination).toBe(CONSUMER_ROUTES.discoverDefault);
    }
  });
});

describe("middleware auth wall (shouldGate)", () => {
  const walled = [
    "/me",
    "/me/anything",
    "/new-visit",
    "/visit/t1",
    "/reservations",
    "/reservation/r1",
    "/inbox/mine",
    "/inbox/global",
  ];
  // "Ungated at middleware" — NOT "public". Everything under app/(shell)
  // (/home, /search, /place, /share) is still walled by that
  // layout's own getUser() check; middleware just doesn't pay for an SSR
  // render first. Only "/" and "/onboard" are reachable signed-out.
  const ungatedAtMiddleware = [
    "/",
    "/home",
    "/home/swipe",
    "/home/favorites",
    "/search",
    "/place/abc",
    "/share",
    "/onboard",
    // Not gated but also unreachable as pages — next.config 308s them to a
    // canonical destination that IS gated:
    "/pay",
    "/qr",
    "/rewards",
    "/rewards/ticket/t1",
    "/profile",
    "/notifications",
    "/ticket/t1",
    "/invite",
    // The plan became a sheet on Me (MESITA-1129); this 308s to /me.
    "/subscribe",
    "/subscribe/premium",
  ];

  it.each(walled)("%s requires a session", (p) => {
    expect(shouldGate(p)).toBe(true);
  });

  it.each(ungatedAtMiddleware)("%s passes middleware ungated", (p) => {
    expect(shouldGate(p)).toBe(false);
  });

  it("does not gate by loose prefix (\u201c/mesita\u201d is not \u201c/me\u201d)", () => {
    expect(shouldGate("/mesita")).toBe(false);
    expect(shouldGate("/rewardsy")).toBe(false);
  });
});

// The destination a guest opened has to survive three hops — the auth wall,
// /auth/post-signin, and /onboard — or a shared place link silently becomes
// "welcome to the home tab". These pin the plumbing and the open-redirect
// guard that every hop shares.
describe("?next= threading (safeNextPath / withNext)", () => {
  it("accepts in-app paths, with params", () => {
    expect(safeNextPath("/place/abc")).toBe("/place/abc");
    expect(safeNextPath("/place/abc?ref=ig")).toBe("/place/abc?ref=ig");
  });

  it("rejects anything that could leave our origin", () => {
    for (const hostile of [
      "//evil.com",
      "https://evil.com",
      "http://evil.com",
      "evil.com",
      "",
      undefined,
      null,
    ]) {
      expect(safeNextPath(hostile)).toBeNull();
    }
  });

  it("appends an encoded next, or nothing when there's no safe target", () => {
    expect(withNext("/onboard", "/place/abc?ref=ig")).toBe(
      "/onboard?next=%2Fplace%2Fabc%3Fref%3Dig",
    );
    expect(withNext("/onboard", null)).toBe("/onboard");
    expect(withNext("/onboard", "//evil.com")).toBe("/onboard");
  });

  it("survives the wall → post-signin → onboard round trip", () => {
    // (shell) gate on a signed-out deep link…
    const wall = withNext("/", "/place/abc?ref=ig");
    expect(wall).toBe("/?next=%2Fplace%2Fabc%3Fref%3Dig");
    // …root page hands it to post-signin…
    const afterAuth = consumerAuthDestination(
      new URL(wall, "https://consumer.mesita.ai").searchParams.get("next") ??
        undefined,
    );
    expect(afterAuth).toBe("/auth/post-signin?next=%2Fplace%2Fabc%3Fref%3Dig");
    // …which parks it on /onboard for an unfinished profile…
    const target = new URL(afterAuth, "https://consumer.mesita.ai").searchParams.get(
      "next",
    );
    expect(withNext(CONSUMER_ROUTES.onboard, target)).toBe(
      "/onboard?next=%2Fplace%2Fabc%3Fref%3Dig",
    );
    // …and the form finally lands on the original link.
    expect(safeNextPath(target)).toBe("/place/abc?ref=ig");
  });
});

describe("isConsumerOnboarded (one predicate, three call sites)", () => {
  const complete = {
    first_name: "Ana",
    last_name: "Ruiz",
    birthday: "1995-04-02",
    sex: "female",
  };

  it("requires all four fields", () => {
    expect(isConsumerOnboarded(complete)).toBe(true);
    for (const key of Object.keys(complete) as (keyof typeof complete)[]) {
      expect(isConsumerOnboarded({ ...complete, [key]: null })).toBe(false);
      expect(isConsumerOnboarded({ ...complete, [key]: "" })).toBe(false);
    }
  });

  it("treats a missing profile as not onboarded", () => {
    expect(isConsumerOnboarded(null)).toBe(false);
    expect(isConsumerOnboarded(undefined)).toBe(false);
  });
});
