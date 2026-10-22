import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONSUMER_ROUTES,
  CONSUMER_ROUTE_PREFIX,
  CONSUMER_RESERVATION_SURFACE_PREFIX,
  isModalContractPath,
  placePath,
  reservationPath,
} from "@/lib/consumer-route-contract";
import { shouldGate } from "@/lib/supabase/middleware";
import {
  consumerAuthDestination,
  safeNextPath,
  withNext,
} from "@/lib/auth-redirect";
import {
  consumerCanBrowse,
  consumerNeedsLastName,
} from "@/lib/consumer-onboarding";
import { LEGACY_REDIRECTS } from "@/lib/legacy-redirects";
import nextConfig from "../../../next.config";

// Routing is contract, not implementation detail: four tabs, flat /me,
// top-level /place and /reservation — see Docs › Apps §A. These tests pin
// the contract, the helpers, the legacy→canonical redirect table, and the
// middleware auth wall so a rename or a "helpful cleanup" can't silently
// break bookmarks, shared place links, or the signed-out gate.
//
// FIRST STAGE (MESITA-2087). The consumer app is Citywide Catalog · Discovery
// Engines · Reservations Agent. Every Second Stage address — Visits, Wallet,
// Credits, Orders, Diamond, Plan, the Share deck, public gift links — is a
// redirect SOURCE here and nothing else: no key, no helper, no page.

const SHELL = join(__dirname, "..", "..", "app", "(shell)");

type Redirect = { source: string; destination: string };

/** Next's matcher, reduced to what this table uses: `:name` is ONE segment,
 *  `:name*` is ZERO OR MORE (path-to-regexp's `*` modifier — `/wallet/:path*`
 *  catches bare `/wallet` too, which is why the exact `/wallet` row beneath it
 *  never fires and why "exactly one entry" is the wrong invariant). */
function matches(source: string, address: string): boolean {
  const re = source
    .split("/")
    .slice(1)
    .map((seg) =>
      /^:[A-Za-z]+\*$/.test(seg)
        ? "(?:/[^/]+)*"
        : /^:[A-Za-z]+$/.test(seg)
          ? "/[^/]+"
          : `/${seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
    )
    .join("");
  return new RegExp(`^${re}$`).test(address);
}

/** The entry Next would fire for `address` — the FIRST match, as it does. */
function firstRedirect(
  table: Redirect[],
  address: string,
): Redirect | undefined {
  return table.find((r) => matches(r.source, address));
}

/** A legacy prefix (`/visit/`) stands for a `:param` entry; give it a sample
 *  id so the matcher can see it. A plain address is itself. */
function sampleAddress(legacy: string): string {
  return legacy.endsWith("/") ? `${legacy}sample` : legacy;
}

/** Every address the contract says RENDERS, with `:id` where a page takes
 *  one. The redirect table may point here and nowhere else. */
function liveAddresses(): Set<string> {
  return new Set([
    CONSUMER_ROUTES.onboard,
    CONSUMER_ROUTES.search,
    CONSUMER_ROUTES.searchChat,
    CONSUMER_ROUTES.home,
    CONSUMER_ROUTES.homeSocial,
    CONSUMER_ROUTES.pay,
    CONSUMER_ROUTES.share,
    CONSUMER_ROUTES.me,
    ...Object.values(CONSUMER_ROUTES.mePages),
    `${CONSUMER_ROUTES.place.prefix}:id`,
    `${CONSUMER_ROUTES.reservation.prefix}:id`,
  ]);
}

describe("CONSUMER_ROUTES (canonical surface map)", () => {
  it("pins the exact canonical route map", () => {
    expect(CONSUMER_ROUTES).toEqual({
      onboard: "/onboard",
      // Search's OWN top-level route (MESITA-1616) — not nested under
      // /discover. See the legacy block below for the /discover/search entry
      // that replaced it as a redirect source.
      search: "/search",
      // Ask AI: a sheet over Search when opened from it (MESITA-2475).
      searchChat: "/search/chat",
      // HOME IS TWO TABS, EACH AN ADDRESS (Pato, MESITA-2597). Bare /home,
      // /discover and /discover/places are in the legacy block now.
      home: "/home/places",
      homeSocial: "/home/social",
      place: { prefix: "/place/" },
      reservation: { prefix: "/reservation/" },
      // PAY IS ONE PAGE, the Soon state (MESITA-2087). No children, no
      // default, no sections: the tab links here and lights here.
      pay: "/pay",
      // The Share tab's page (MESITA-2566).
      share: "/share",
      // Me's six boxes, each a route. NO diamond / diamondInvite / plan /
      // settingsMetrics / visits — those are redirect sources in `legacy`
      // below.
      me: "/me",
      mePages: {
        profile: "/me/profile",
        instagram: "/me/instagram",
        plan: "/me/plan",
        class: "/me/class",
        connector: "/me/connector",
        settings: "/me/settings",
        settingsContact: "/me/settings/contact",
        notifications: "/me/notifications",
        // Favorites and Reservations, each its own page (MESITA-2565); they
        // were Saved's two tabs (MESITA-2521, MESITA-2561).
        favorites: "/me/favorites",
        reservations: "/me/reservations",
      },
      legacy: {
        profile: "/profile",
        invite: "/invite",
        homeRoot: "/home",
        homeAi: "/home/ai",
        discover: "/discover",
        discoverPlaces: "/discover/places",
        discoverSearch: "/discover/search",
        discoverMap: "/discover/map",
        discoverHome: "/discover/home",
        discoverCatalog: "/discover/catalog",
        discoverScroll: "/discover/scroll",
        discoverSwipe: "/discover/swipe",
        discoverFavs: "/discover/favs",
        discoverSocial: "/discover/social",
        discoverChat: "/discover/chat",
        places: "/places",
        // The Second Stage tab and everything under it. All land on `pay`.
        newVisit: "/new-visit",
        newVisitWallet: "/new-visit/wallet",
        visitPrefix: "/visit/",
        wallet: "/wallet",
        credits: "/credits",
        inboxCredits: "/inbox/credits",
        order: "/order",
        inboxOrders: "/inbox/orders",
        giftClaimPrefix: "/gift/",
        rewards: "/rewards",
        rewardsTicketPrefix: "/rewards/ticket/",
        payTicketPrefix: "/pay/ticket/",
        payTicketsPrefix: "/pay/tickets/",
        payTabPrefix: "/pay/",
        ticketPrefix: "/ticket/",
        qr: "/qr",
        // Me's Second Stage boxes. All land on `me` (Metrics on Settings,
        // the Passport on Profile).
        meClassInvite: "/me/class/invite",
        meDiamond: "/me/diamond",
        meDiamondInvite: "/me/diamond/invite",
        meVisits: "/me/visits",
        meSettingsMetrics: "/me/settings/metrics",
        mePassport: "/me/passport",
        meHelp: "/me/help",
        subscribe: "/subscribe/premium",
        getTheApp: "/get-the-app",
        discoverFeed: "/discover/feed",
        notifications: "/notifications",
        inboxMine: "/inbox/my-activity",
        inboxGlobal: "/inbox/global-activity",
        inboxMineTab: "/inbox/mine",
        inboxGlobalTab: "/inbox/global",
        reservations: "/reservations",
        bookings: "/bookings",
        savedReservations: "/saved/reservations",
        saved: "/saved",
        meSaved: "/me/saved",
        savedReservationPrefix: "/saved/reservation/",
        savedPlacePrefix: "/saved/place/",
      },
    });
  });

  it("pins the middleware prefix map", () => {
    expect(CONSUMER_ROUTE_PREFIX).toEqual({
      // NO `discover` key (MESITA-1609) — Home and Search split that
      // namespace and light DIFFERENT bottom tabs, so BottomNav matches each
      // discoverTabs segment individually instead. NO `search` key: an exact
      // top-level segment with no siblings. Home's two tabs light it
      // (MESITA-2597).
      home: "/home/",
      place: "/place",
      pay: "/pay",
      // NO `saved` key: Saved is a Me page (MESITA-2561), lit by Me's prefix.
      // NO `inbox` key (MESITA-1626): every /inbox address 308s to /me, so
      // the middleware never sees one.
      me: "/me",
    });
    expect(CONSUMER_RESERVATION_SURFACE_PREFIX).toBe("/reservation");
  });

  // Nothing in the legacy block may be a live address: a redirect whose
  // source is a page shadows the page, and every gate stays green.
  it("names no live address in the legacy block", () => {
    const live = liveAddresses();
    for (const [key, value] of Object.entries(CONSUMER_ROUTES.legacy)) {
      const address = value.endsWith("/") ? `${value}:id` : value;
      expect(live.has(address), `legacy.${key} = ${value} is a live page`).toBe(
        false,
      );
    }
  });
});

describe("the legacy block and the redirect table are one set", () => {
  // Every retired address a guest could still hold — a bookmark, an old push,
  // a QR printed last month — is caught by next.config and lands, in ONE hop,
  // on a page the contract says renders. FIRST match, as Next fires it: the
  // `/inbox/:path*` catch-all also covers `/inbox/credits`, and the specific
  // entry wins only because it sits above — the full-table pin below holds
  // that order.
  it("catches every legacy address and lands it on a live page", async () => {
    const table = await nextConfig.redirects!();
    const live = liveAddresses();

    for (const [key, value] of Object.entries(CONSUMER_ROUTES.legacy)) {
      const hit = firstRedirect(table, sampleAddress(value));
      expect(hit, `legacy.${key} (${value}) has no redirect`).toBeDefined();

      // One hop: the destination renders. (`:id` on both sides lines up — a
      // param destination is a param page; a `?tab=` query picks a tab of
      // the page, MESITA-2521.)
      const dest = hit!.destination.split("?")[0].replace(/:[A-Za-z]+/g, ":id");
      expect(
        live.has(dest),
        `legacy.${key} → ${hit!.destination} is not a page`,
      ).toBe(true);
    }
  });

  it("answers /reservations from the table, not a page (MESITA-2475)", () => {
    expect(existsSync(join(SHELL, "reservations", "page.tsx"))).toBe(false);
  });

  // The other direction: every SOURCE the table catches is spoken for in the
  // contract, so a retired address cannot be forwarded by a stray entry nobody
  // can find from the route map. Sources with a `:param` are checked by their
  // prefix; the `:path*` catch-alls stand for the exact entries beside them.
  it("every redirect source is a legacy address, or a Home/Explore-era alias", async () => {
    const table = LEGACY_REDIRECTS;
    const legacy = Object.values(CONSUMER_ROUTES.legacy) as string[];
    // Addresses that predate the contract's legacy block and are pinned by
    // value in the table test below rather than by key.
    const ALIASES = ["/explore", "/home/", "/subscribe", "/inbox", "/saved/"];
    const spokenFor = (source: string) => {
      const exact = source.replace(/\/:[A-Za-z]+\*?$/, "/");
      if (legacy.includes(source)) return true;
      if (source.includes(":") && legacy.includes(exact)) return true;
      if (source.includes(":") && legacy.includes(exact.replace(/\/$/, "")))
        return true;
      return ALIASES.some((a) =>
        a.endsWith("/")
          ? source.startsWith(a)
          : source === a || source.startsWith(`${a}/`),
      );
    };
    expect(
      table.filter((r) => !spokenFor(r.source)).map((r) => r.source),
    ).toEqual([]);
  });

  // Pay is the ONE live address every Second Stage spelling lands on. If it
  // ever becomes a source itself, the tab 308s on every tap and the page
  // never renders — and nothing but this line notices.
  it("never lists /pay, a tab, as a redirect source", async () => {
    const table = await nextConfig.redirects!();
    expect(table.find((r) => r.source === CONSUMER_ROUTES.pay)).toBeUndefined();
    expect(firstRedirect(table, CONSUMER_ROUTES.pay)).toBeUndefined();
    // Every live address, in fact.
    for (const address of liveAddresses()) {
      const concrete = address.replace(/:id$/, "sample");
      expect(
        firstRedirect(table, concrete),
        `${address} is shadowed`,
      ).toBeUndefined();
    }
  });
});

describe("path helpers", () => {
  it("builds detail paths from ids/slugs", () => {
    expect(placePath("abc-123")).toBe("/place/abc-123");
    expect(reservationPath("r1")).toBe("/reservation/r1");
  });

  it("keeps every Me box page out of the modal contract", () => {
    for (const href of Object.values(CONSUMER_ROUTES.mePages)) {
      expect(isModalContractPath(href), href).toBe(false);
    }
  });
});

describe("isModalContractPath (intercepted detail overlays)", () => {
  const modal = [
    "/search/chat", // Ask AI's sheet over Search (MESITA-2475)
    "/place/abc",
    "/saved/place/abc", // legacy — redirects, but still intercepts first
    "/reservation/r1",
    "/saved/reservation/r1", // legacy
  ];
  const notModal = [
    "/",
    "/onboard",
    "/home",
    "/home/places",
    "/home/social",
    "/discover/places",
    "/discover/social",
    "/search",
    "/search/chat/x",
    "/pay",
    "/reservations",
    "/me",
    "/me/profile",
    "/me/instagram",
    "/me/plan",
    "/me/class",
    "/me/connector",
    "/me/notifications",
    "/me/reservations",
    "/me/favorites",
    "/me/saved",
    "/me/settings",
    "/me/help", // retired; 308s to Settings before it could intercept
    // Second Stage spellings 308 before they could ever intercept.
    "/new-visit",
    "/visit/t1",
    "/wallet",
    "/order",
    "/me/diamond",
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
    const redirects = LEGACY_REDIRECTS;
    expect(redirects).toEqual([
      // Explore era (pre-Home). Straight to the Discover default.
      { source: "/explore", destination: "/home/places", permanent: true },
      {
        source: "/explore/swipe",
        destination: "/home/places",
        permanent: true,
      },
      { source: "/explore/map", destination: "/home/places", permanent: true },
      { source: "/explore/add", destination: "/home/places", permanent: true },
      {
        source: "/explore/place/:id",
        destination: "/place/:id",
        permanent: true,
      },
      // THE SECOND STAGE (MESITA-2087): every address that hung off the
      // centre tab lands on Pay in ONE hop. Deepest sources first.
      {
        source: "/new-visit/wallet/:path*",
        destination: "/pay",
        permanent: true,
      },
      { source: "/new-visit", destination: "/pay", permanent: true },
      { source: "/wallet/:path*", destination: "/pay", permanent: true },
      { source: "/credits", destination: "/pay", permanent: true },
      { source: "/inbox/credits", destination: "/pay", permanent: true },
      { source: "/inbox/orders", destination: "/pay", permanent: true },
      { source: "/order", destination: "/pay", permanent: true },
      { source: "/rewards/ticket/:id", destination: "/pay", permanent: true },
      { source: "/rewards", destination: "/pay", permanent: true },
      { source: "/pay/ticket/:id", destination: "/pay", permanent: true },
      { source: "/pay/tickets/:id", destination: "/pay", permanent: true },
      { source: "/pay/:tab", destination: "/pay", permanent: true },
      { source: "/qr", destination: "/pay", permanent: true },
      { source: "/ticket/:id", destination: "/pay", permanent: true },
      { source: "/visit/:id", destination: "/pay", permanent: true },
      { source: "/gift/:code", destination: "/pay", permanent: true },
      // Me's Second Stage boxes. The `/me/[tab]` catch-all already 308s a
      // retired ONE-segment /me address onto the hub; the two-segment ones
      // need an entry or they 404.
      { source: "/subscribe", destination: "/me", permanent: true },
      { source: "/subscribe/:plan", destination: "/me", permanent: true },
      { source: "/get-the-app", destination: "/home/places", permanent: true },
      { source: "/me/class/invite", destination: "/me", permanent: true },
      { source: "/me/diamond/invite", destination: "/me", permanent: true },
      { source: "/me/diamond", destination: "/me", permanent: true },
      { source: "/me/visits", destination: "/me", permanent: true },
      {
        source: "/me/settings/metrics",
        destination: "/me/settings",
        permanent: true,
      },
      { source: "/me/passport", destination: "/me/profile", permanent: true },
      { source: "/me/help", destination: "/me/settings", permanent: true },
      { source: "/invite", destination: "/me", permanent: true },
      // The retired Home hub's leaves (2026-09-01), and bare /home since each
      // tab got its own address (MESITA-2597). /home itself was live
      // (MESITA-2475). Never through /discover/map or /discover/search,
      // which are themselves 308s below.
      { source: "/home", destination: "/home/places", permanent: true },
      { source: "/home/swipe", destination: "/home/places", permanent: true },
      { source: "/home/catalog", destination: "/home/places", permanent: true },
      { source: "/home/chat", destination: "/home/places", permanent: true },
      { source: "/home/ai", destination: "/home/places", permanent: true },
      {
        source: "/home/favorites",
        destination: "/home/places",
        permanent: true,
      },
      // Search's two addresses under /discover (MESITA-1609 → 1616).
      { source: "/discover/search", destination: "/search", permanent: true },
      { source: "/discover/map", destination: "/search", permanent: true },
      // HOME IS /home (MESITA-2475): its old namespace and default pill.
      { source: "/discover", destination: "/home/places", permanent: true },
      {
        source: "/discover/places",
        destination: "/home/places",
        permanent: true,
      },
      // Catalog's day as Home, Swipe's week as the default, Catalog's own
      // segment (MESITA-1697), and Catalog's /discover/feed itself, off the
      // rail again (MESITA-2140). All land on Home.
      {
        source: "/discover/home",
        destination: "/home/places",
        permanent: true,
      },
      {
        source: "/discover/catalog",
        destination: "/home/places",
        permanent: true,
      },
      {
        source: "/discover/feed",
        destination: "/home/places",
        permanent: true,
      },
      // Scroll (MESITA-2163) and Swipe (MESITA-2166), off the rail.
      {
        source: "/discover/scroll",
        destination: "/home/places",
        permanent: true,
      },
      {
        source: "/discover/swipe",
        destination: "/home/places",
        permanent: true,
      },
      {
        source: "/discover/favs",
        destination: "/home/places",
        permanent: true,
      },
      {
        source: "/discover/social",
        destination: "/home/social",
        permanent: true,
      },
      {
        source: "/discover/chat",
        destination: "/search/chat",
        permanent: true,
      },
      { source: "/places", destination: "/home/places", permanent: true },
      // Favorites and Reservations are each a Me page (MESITA-2565): /saved
      // and /me/saved land on Favorites; every former reservations list →
      // Me › Reservations in one hop. The /saved/place dual path
      // (MESITA-1585) still forwards.
      { source: "/saved", destination: "/me/favorites", permanent: true },
      { source: "/me/saved", destination: "/me/favorites", permanent: true },
      {
        source: "/reservations",
        destination: "/me/reservations",
        permanent: true,
      },
      {
        source: "/bookings",
        destination: "/me/reservations",
        permanent: true,
      },
      {
        source: "/saved/reservations",
        destination: "/me/reservations",
        permanent: true,
      },
      {
        source: "/saved/reservation/:id",
        destination: "/reservation/:id",
        permanent: true,
      },
      {
        source: "/saved/place/:id",
        destination: "/place/:id",
        permanent: true,
      },
      { source: "/profile", destination: "/me/profile", permanent: true },
      {
        source: "/notifications",
        destination: "/me/notifications",
        permanent: true,
      },
      // ACTIVITY IS GONE AS A CONTAINER (MESITA-1626): /inbox lands on Me in
      // ONE hop. /inbox/credits and /inbox/orders sit ABOVE this and point at
      // Pay — Next takes the first match.
      { source: "/inbox/:path*", destination: "/me", permanent: true },
    ]);
  });

  // The one redirect that carries logic stays a server page (not in
  // next.config): /me/[tab] → /me (+ query), the retired one-segment boxes.
});

describe("middleware auth wall (shouldGate)", () => {
  const walled = [
    "/me",
    "/me/anything",
    // Pay is a tab: a signed-out tap gets the edge redirect with its own
    // `next`, like every other personal surface.
    "/pay",
    "/reservations",
    "/reservation/r1",
    "/inbox/mine",
    "/inbox/global",
  ];
  // "Ungated at middleware" — NOT "public". Everything under app/(shell)
  // (/discover, /search, /place) is still walled by that layout's own
  // getUser() check; middleware just doesn't pay for an SSR render first.
  // Only "/" and "/onboard" are reachable signed-out.
  const ungatedAtMiddleware = [
    "/",
    "/home", // 308s to /home/places (MESITA-2597)
    "/home/places",
    "/home/social",
    "/discover/places", // 308s to /home/places
    "/discover/social", // 308s to /home/social (MESITA-2597)
    "/discover/chat", // 308s to /search/chat (MESITA-2401)
    "/discover/favs", // 308s to Home (MESITA-2383)
    "/search",
    "/place/abc",
    "/onboard",
    // Not gated but also unreachable as pages — next.config 308s them to a
    // canonical destination that IS gated.
    "/new-visit",
    "/visit/t1",
    "/wallet",
    "/wallet/buy",
    "/order",
    "/gift/1234567890",
    "/qr",
    "/rewards",
    "/rewards/ticket/t1",
    "/profile",
    "/notifications",
    "/ticket/t1",
    "/invite",
    "/subscribe",
    "/subscribe/premium",
  ];

  it.each(walled)("%s requires a session", (p) => {
    expect(shouldGate(p)).toBe(true);
  });

  it.each(ungatedAtMiddleware)("%s passes middleware ungated", (p) => {
    expect(shouldGate(p)).toBe(false);
  });

  it("does not gate by loose prefix (“/mesita” is not “/me”)", () => {
    expect(shouldGate("/mesita")).toBe(false);
    expect(shouldGate("/payments")).toBe(false);
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
    const target = new URL(
      afterAuth,
      "https://consumer.mesita.ai",
    ).searchParams.get("next");
    expect(withNext(CONSUMER_ROUTES.onboard, target)).toBe(
      "/onboard?next=%2Fplace%2Fabc%3Fref%3Dig",
    );
    // …and the form finally lands on the original link.
    expect(safeNextPath(target)).toBe("/place/abc?ref=ig");
  });
});

describe("consumer onboarding gates", () => {
  const complete = {
    first_name: "Ana",
    last_name: "Ruiz",
    birthday: "1995-04-02",
    sex: "female",
  };

  // What ReservationSheet renders its one extra field from.
  it("flags the last name as the only field a booking surface asks for", () => {
    expect(consumerNeedsLastName(complete)).toBe(false);
    expect(consumerNeedsLastName({ ...complete, last_name: null })).toBe(true);
    expect(consumerNeedsLastName({ ...complete, last_name: "" })).toBe(true);
  });

  it("treats a missing profile as past neither gate", () => {
    expect(consumerCanBrowse(null)).toBe(false);
    expect(consumerCanBrowse(undefined)).toBe(false);
  });
});
