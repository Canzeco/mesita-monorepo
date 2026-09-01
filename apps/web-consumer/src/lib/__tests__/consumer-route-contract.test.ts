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
      // NO home / homeTabs / homeDefault / favorites keys — the hub was retired
      // 2026-09-01. Discover then grew seven modes and moved off /search, which
      // is now a legacy redirect source (see the legacy block below).
      //
      // SEGMENTS MATCH LABELS here, the exception in this codebase: the tab
      // moved to /discover precisely so the typed mode could be a real segment
      // instead of /search/search.
      discover: "/discover",
      // FIVE modes: Name, Catalog and Social folded into one Search surface
      // (Pato, 2026-09-01). CatalogRails and SocialFeed mount INTO Search when
      // they un-park rather than getting routes back.
      discoverTabs: {
        map: "/discover/map",
        search: "/discover/search",
        swipe: "/discover/swipe",
        chat: "/discover/chat",
        favs: "/discover/favs",
      },
      discoverDefault: "/discover/map",
      place: { prefix: "/place/" },
      reservation: { prefix: "/reservation/" },
      newVisit: { root: "/new-visit" },
      visit: { prefix: "/visit/" },
      // Four sections, and the ORDER is load-bearing: Visits · Orders ·
      // Reservations · Notifications runs from what you're doing right now
      // out to the passive feed. Object key order is asserted separately
      // below, since toEqual ignores it.
      inbox: {
        root: "/inbox",
        credits: "/inbox/credits",
        visits: "/inbox/visits",
        orders: "/inbox/orders",
        reservations: "/inbox/reservations",
        notifications: "/inbox/notifications",
      },
      inboxDefault: "/inbox/visits",
      me: "/me",
      legacy: {
        profile: "/profile",
        subscribe: "/subscribe/premium",
        invite: "/invite",
        homeAi: "/home/ai",
        search: "/search",
        rewards: "/rewards",
        rewardsTicketPrefix: "/rewards/ticket/",
        meClass: "/me/class",
        meSettings: "/me/settings",
        mePlan: "/me/plan",
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
      // One prefix covers all seven Discover modes. /search is a redirect
      // source now, not a surface, so it has no prefix.
      discover: "/discover",
      place: "/place",
      reservations: "/reservations",
      newVisit: "/new-visit",
      visit: "/visit",
      inbox: "/inbox",
      me: "/me",
      saved: "/saved",
    });
    expect(CONSUMER_RESERVATION_SURFACE_PREFIX).toBe("/reservation");
  });

  // toEqual compares keys as a set, so the section ORDER — the product
  // decision (Pato, 2026-08-16; Credits added first 2026-09-01) — needs its
  // own assertion or a well-meaning alphabetical re-sort would pass CI.
  //
  // This pins the CONTRACT's order. It does NOT pin what renders: nothing
  // iterates this object, so the order the guest sees comes from
  // InboxSectionNav.SECTIONS. route-structure.test.tsx T6 pins that one.
  it("pins the Inbox section order: credits → visits → orders → reservations → notifications", () => {
    const sections = Object.keys(CONSUMER_ROUTES.inbox).filter(
      (k) => k !== "root",
    );
    expect(sections).toEqual([
      "credits",
      "visits",
      "orders",
      "reservations",
      "notifications",
    ]);
  });

  // THE DEFAULT IS NO LONGER THE FIRST SECTION, and that is deliberate
  // (Pato, 2026-09-01). Credits leads the pill row because money is what a
  // guest checks first, but bare /inbox must keep landing on Visits: a visit
  // in progress is time-critical — you are standing at a table with staff
  // waiting — and a balance never is. Both inbox/page.tsx and
  // inbox/[tab]/page.tsx redirect here, so this one line decides what the
  // Inbox TAB opens to.
  //
  // If you are "fixing" this to match the row order, read the paragraph above
  // first. The mismatch is the decision, not a bug.
  it("lands the Inbox tab on Visits, NOT on the first section", () => {
    expect(CONSUMER_ROUTES.inboxDefault).toBe(CONSUMER_ROUTES.inbox.visits);
    expect(CONSUMER_ROUTES.inboxDefault).not.toBe(
      CONSUMER_ROUTES.inbox.credits,
    );
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
      // Explore era (pre-Home). Repointed at /search when /home was retired —
      // chaining through /home would make these two-hop, and T4 caps at 2.
      { source: "/explore", destination: "/discover/map", permanent: true },
      { source: "/explore/swipe", destination: "/discover/map", permanent: true },
      { source: "/explore/map", destination: "/discover/map", permanent: true },
      { source: "/explore/add", destination: "/discover/map", permanent: true },
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
      // The retired Home hub (2026-09-01). Every leaf 308s to Discover, which
      // IS /search. /home/ai points straight here rather than chaining through
      // /home/chat — that page is deleted, so the old chain would dangle AND
      // cost a second hop against T4's cap of 2.
      { source: "/home", destination: "/discover/map", permanent: true },
      { source: "/home/swipe", destination: "/discover/map", permanent: true },
      { source: "/home/catalog", destination: "/discover/map", permanent: true },
      { source: "/home/chat", destination: "/discover/map", permanent: true },
      { source: "/home/ai", destination: "/discover/map", permanent: true },
      { source: "/home/social", destination: "/discover/map", permanent: true },
      { source: "/home/favorites", destination: "/discover/map", permanent: true },
      // Renamed surfaces.
      { source: "/search", destination: "/discover/map", permanent: true },
      { source: "/invite", destination: "/share", permanent: true },
      // Credits shipped standalone and moved under Inbox when it became a
      // section (MESITA-1381). route-structure T7 asserts this one separately,
      // because T4 can only validate a destination, never an absence.
      { source: "/credits", destination: "/inbox/credits", permanent: true },
      { source: "/profile", destination: "/me", permanent: true },
      {
        source: "/notifications",
        destination: "/inbox/notifications",
        permanent: true,
      },
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
