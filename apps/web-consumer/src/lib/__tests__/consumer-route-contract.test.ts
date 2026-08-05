import { describe, expect, it } from "vitest";
import {
  CONSUMER_ROUTES,
  CONSUMER_ROUTE_PREFIX,
  CONSUMER_RESERVATION_SURFACE_PREFIX,
  couponPath,
  isModalContractPath,
  placePath,
  reservationPath,
  rewardsTicketPath,
  ticketPath,
} from "@/lib/consumer-route-contract";
import { shouldGate } from "@/lib/supabase/middleware";
import nextConfig from "../../../next.config";

// Routing is contract, not implementation detail: five tabs, flat /me,
// canonical /share, top-level /place — see Product Rules §E. These tests pin
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
      home: "/home",
      homeTabs: {
        swipe: "/home/swipe",
        ai: "/home/ai",
        social: "/home/social",
        favorites: "/home/favorites",
      },
      homeDefault: "/home/swipe",
      search: "/search",
      filters: "/filters",
      favorites: "/home/favorites",
      place: { prefix: "/place/" },
      reservations: "/reservations",
      reservation: { prefix: "/reservation/" },
      rewards: {
        root: "/rewards",
        ticketPrefix: "/rewards/ticket/",
      },
      inbox: {
        mine: "/inbox/mine",
        global: "/inbox/global",
      },
      subscribe: "/subscribe/premium",
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
      home: "/home",
      search: "/search",
      place: "/place",
      reservations: "/reservations",
      rewards: "/rewards",
      inbox: "/inbox",
      me: "/me",
      subscribe: "/subscribe",
      saved: "/saved",
    });
    expect(CONSUMER_RESERVATION_SURFACE_PREFIX).toBe("/reservation");
  });
});

describe("path helpers", () => {
  it("builds detail paths from ids/slugs", () => {
    expect(placePath("abc-123")).toBe("/place/abc-123");
    expect(reservationPath("r1")).toBe("/reservation/r1");
    expect(couponPath("c1")).toBe("/coupon/c1");
    expect(rewardsTicketPath("t1")).toBe("/rewards/ticket/t1");
    // ticketPath is the legacy-named alias of rewardsTicketPath.
    expect(ticketPath("t1")).toBe("/rewards/ticket/t1");
  });
});

describe("isModalContractPath (intercepted detail overlays)", () => {
  const modal = [
    "/filters",
    "/place/abc",
    "/saved/place/abc", // legacy — redirects, but still intercepts first
    "/reservation/r1",
    "/saved/reservation/r1", // legacy
    "/rewards/ticket/t1",
    "/coupon/c1",
  ];
  const notModal = [
    "/",
    "/home",
    "/home/swipe",
    "/search",
    "/reservations",
    "/rewards",
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
      // Explore era (pre-Home).
      { source: "/explore", destination: "/home", permanent: true },
      { source: "/explore/swipe", destination: "/home", permanent: true },
      { source: "/explore/map", destination: "/search", permanent: true },
      { source: "/explore/add", destination: "/search", permanent: true },
      {
        source: "/explore/place/:id",
        destination: "/place/:id",
        permanent: true,
      },
      // Pay era.
      {
        source: "/pay/ticket/:id",
        destination: "/rewards/ticket/:id",
        permanent: true,
      },
      {
        source: "/pay/tickets/:id",
        destination: "/rewards/ticket/:id",
        permanent: true,
      },
      { source: "/pay/:tab", destination: "/rewards", permanent: true },
      { source: "/pay", destination: "/rewards", permanent: true },
      { source: "/qr", destination: "/rewards", permanent: true },
      {
        source: "/ticket/:id",
        destination: "/rewards/ticket/:id",
        permanent: true,
      },
      // Renamed surfaces.
      { source: "/invite", destination: "/share", permanent: true },
      { source: "/profile", destination: "/me", permanent: true },
      { source: "/notifications", destination: "/inbox/mine", permanent: true },
    ]);
  });

  // Redirects that carry logic stay as server pages (not in next.config):
  //   /home              → /home/swipe        (default mode)
  //   /home/ai|social    → /home/swipe        (parked modes)
  //   /me/[tab]          → /me (+?settings=1) (tab → modal mapping)
  //   /inbox/my-activity → /inbox/mine        (alias inside [tab] page)
  //   /saved             → /reservations      (legacy tab)
  //   /saved/reservation(s)/… → /reservation(s)/…
  //   /saved/place/[id]  → /place/[id]
  // Their targets are pinned via CONSUMER_ROUTES above; the pages themselves
  // are one-line redirect() calls checked by build + typecheck.
});

describe("middleware auth wall (shouldGate)", () => {
  const walled = [
    "/me",
    "/me/anything",
    "/rewards",
    "/rewards/ticket/t1",
    "/reservations",
    "/reservation/r1",
    "/inbox/mine",
    "/inbox/global",
    "/subscribe/premium",
    "/saved/reservations",
    "/saved/reservation/r1",
    "/saved/place/abc",
  ];
  const publicPaths = [
    "/",
    "/home",
    "/home/swipe",
    "/home/favorites",
    "/search",
    "/place/abc",
    "/coupon/c1",
    "/share",
    "/onboard",
    // Not gated but also unreachable as pages — next.config 308s them to a
    // canonical destination that IS gated:
    "/pay",
    "/qr",
    "/profile",
    "/notifications",
    "/ticket/t1",
    "/invite",
  ];

  it.each(walled)("%s requires a session", (p) => {
    expect(shouldGate(p)).toBe(true);
  });

  it.each(publicPaths)("%s passes middleware ungated", (p) => {
    expect(shouldGate(p)).toBe(false);
  });

  it("does not gate by loose prefix (\u201c/mesita\u201d is not \u201c/me\u201d)", () => {
    expect(shouldGate("/mesita")).toBe(false);
    expect(shouldGate("/rewardsy")).toBe(false);
  });
});
