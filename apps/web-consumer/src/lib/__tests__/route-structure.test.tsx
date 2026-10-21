import { readdirSync, existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  CONSUMER_ROUTES,
  isModalContractPath,
} from "@/lib/consumer-route-contract";
import { LEGACY_REDIRECTS } from "@/lib/legacy-redirects";
import nextConfig from "../../../next.config";

// STRUCTURAL route guards (MESITA-1062 S0).
//
// These are deliberately NOT assertions about the current route map — that is
// consumer-route-contract.test.ts's job, and it pins values with toEqual. These
// assert INVARIANTS about the shape of the routing tree, so they keep holding
// while the map underneath them changes.
//
// Every test here is GREEN on main today. That is the point: each one goes RED
// the moment the routing migration breaks the thing it guards. A guard written
// after the rename teaches you nothing, because you have no idea whether it
// ever would have caught the mistake.
//
// Each test names the failure it exists to catch. If one goes red, read that
// line before "fixing" the test.

const APP_DIR = join(__dirname, "..", "..", "app");
const SHELL = join(APP_DIR, "(shell)");
const COMPONENTS = join(__dirname, "..", "..", "components", "consumer");

/** Recursively collect dirs whose basename matches `pred`. */
function findDirs(root: string, pred: (name: string) => boolean): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (!statSync(full).isDirectory()) continue;
      if (pred(entry)) out.push(full);
      walk(full);
    }
  };
  walk(root);
  return out;
}

/** Every page.tsx under app/, as a path relative to app/. */
function allPages(): string[] {
  const out: string[] = [];
  const walk = (dir: string, rel: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full, rel ? `${rel}/${entry}` : entry);
      } else if (entry === "page.tsx") {
        out.push(rel ? `${rel}/page.tsx` : "page.tsx");
      }
    }
  };
  walk(APP_DIR, "");
  return out;
}

/** The URL a page.tsx serves: route groups and parallel slots dropped,
 *  `[id]` kept so `:id` destinations can be lined up against it. */
function pageUrl(page: string): string {
  return (
    "/" +
    page
      .replace(/\/?page\.tsx$/, "")
      .split("/")
      .filter((seg) => seg && !seg.startsWith("(") && !seg.startsWith("@"))
      .join("/")
  );
}

/** Next's matcher, reduced to what this table uses: `:name` is ONE segment,
 *  `:name*` ZERO OR MORE (path-to-regexp's `*` modifier). The contract test
 *  carries the same eight lines; the two files cannot share a helper without
 *  a module that exists only for tests. */
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

// ── T1 — the auth wall is STRUCTURAL ────────────────────────────────────────
//
// (shell)/layout.tsx runs getUser() and every route inside the segment
// inherits it. That inheritance is the wall — NOT middleware's
// PROTECTED_PREFIXES, which is only an edge fast path (see the comment at the
// top of lib/supabase/middleware.ts). So the security property is exactly
// "the page lives under (shell)", and a new route authored outside it is
// unauthenticated by construction.
describe("T1 — every page lives inside the (shell) auth segment", () => {
  // The only routes that may sit outside, each for a stated reason.
  const EXEMPT = new Set([
    "page.tsx", // "/" — the sign-in surface itself
    "onboard/page.tsx", // pre-profile, gated on session not profile
    "auth/post-signin/page.tsx", // the redirect hop that establishes session
  ]);

  it("catches a route authored outside the auth wall", () => {
    const outside = allPages().filter(
      (p) => !p.startsWith("(shell)/") && !EXEMPT.has(p),
    );
    expect(outside).toEqual([]);
  });
});

// ── T2 — an intercepted route must be allowed to PAINT ──────────────────────
//
// SlideOverShell opens with
// `if (!isModalContractPath(pathname)) return null`. It is the only
// consumer of that predicate, and it is mounted only from
// @modal/(.)X/layout.tsx. So adding an intercept directory WITHOUT adding its
// path to the predicate ships a silently blank modal: the URL changes, the
// page underneath stays, nothing opens. Typecheck, build and the contract test
// all stay green.
//
// ONE DIRECTION ONLY. The reverse is not an invariant: the predicate carries
// the two /saved/ legacy prefixes with no intercept directory behind them,
// deliberately — they 308 to the canonical detail, which intercepts.
describe("T2 — every @modal intercept is allowed by isModalContractPath", () => {
  it("catches the blank-modal trap", () => {
    const modalRoot = join(SHELL, "@modal");
    const intercepts = findDirs(modalRoot, (n) => n.startsWith("(.)"));

    const blank = intercepts
      // Only LEAF intercepts render — an intermediate dir like (.)place is
      // just structure holding [id]; it has no page and paints nothing.
      .filter((dir) => existsSync(join(dir, "page.tsx")))
      .map((dir) => {
        // (shell)/@modal/(.)place/[id] -> /place/sample-id
        const rel = dir.slice(modalRoot.length + 1);
        const path =
          "/" +
          rel
            .replace(/\(\.\)/g, "")
            .split("/")
            .map((seg) => (seg.startsWith("[") ? "sample-id" : seg))
            .filter(Boolean)
            .join("/");
        return { dir: rel, path, allowed: isModalContractPath(path) };
      })
      .filter((x) => !x.allowed);

    expect(blank).toEqual([]);
  });
});

// ── T3 — every intercept needs its hard twin ────────────────────────────────
//
// Route interception is SOFT-NAVIGATION ONLY: Next generates the rewrite with
// `has: [{ type: "header", key: "next-url" }]`. A cold load, a reload, or a
// pasted link sends no such header, so no rewrite fires and the REAL route
// renders full-page. If that real route does not exist, the link 404s — or
// worse, falls through to a catch-all and silently lands somewhere wrong.
describe("T3 — every @modal intercept has a hard route to fall back to", () => {
  it("catches a shared link that opens nothing", () => {
    const modalRoot = join(SHELL, "@modal");
    const missing = findDirs(modalRoot, (n) => n.startsWith("(.)"))
      .map((dir) => dir.slice(modalRoot.length + 1).replace(/\(\.\)/g, ""))
      // Only leaf intercepts own a page; intermediate dirs are just structure.
      .filter((rel) => existsSync(join(modalRoot, `(.)${rel}`, "page.tsx")))
      .filter((rel) => !existsSync(join(SHELL, rel, "page.tsx")));

    expect(missing).toEqual([]);
  });
});

// ── T4 — no redirect points into the void ───────────────────────────────────
//
// `next build` does NOT validate redirect destinations. A 308 to a route that
// does not exist is a 404 with extra steps, and it is invisible until someone
// follows an old link.
describe("T4 — every redirect destination resolves", () => {
  it("catches a dangling 308 and any redirect cycle", async () => {
    const redirects = LEGACY_REDIRECTS;
    const sources = new Set(redirects.map((r) => r.source));

    // A destination resolves if a real page matches it, or if it is itself a
    // redirect source (a legal one-hop chain).
    const pages = allPages().map(pageUrl);

    const resolves = (dest: string) => {
      if (sources.has(dest)) return true;
      // :id / :tab params in a destination correspond to [id] / [tab] segments.
      // A `?tab=` query picks a tab of the page (MESITA-2521).
      const normalized = dest.split("?")[0].replace(/:[a-zA-Z]+/g, "[param]");
      return pages.some((page) => {
        const p = page.replace(/\[[^\]]+\]/g, "[param]");
        return p === normalized || p === normalized.replace(/\/$/, "");
      });
    };

    const dangling = redirects
      .filter((r) => !resolves(r.destination))
      .map((r) => `${r.source} -> ${r.destination}`);

    expect(dangling).toEqual([]);
  });

  it("terminates every chain in at most two hops", async () => {
    const redirects = await nextConfig.redirects!();
    const bySource = new Map(redirects.map((r) => [r.source, r.destination]));

    for (const [source] of bySource) {
      let cur = source;
      const seen = new Set<string>([cur]);
      let hops = 0;
      while (bySource.has(cur) && hops < 5) {
        cur = bySource.get(cur)!;
        hops += 1;
        expect(seen.has(cur), `redirect cycle at ${source}`).toBe(false);
        seen.add(cur);
      }
      expect(
        hops,
        `redirect chain too long from ${source}`,
      ).toBeLessThanOrEqual(2);
    }
  });
});

// ── T5 — exactly one bottom-nav tab lights, on every surface ────────────────
//
// The failure this exists for: a DETAIL route that stops nesting under its
// tab's prefix silently lights NOTHING. Nothing else catches it — not tsc, not
// the contract test, not the build. /reservation/[id] lighting Me while living
// outside /me is precisely that shape, so this matrix is the only mechanism
// that can hold it.
//
// Renders the real component with renderToStaticMarkup (react-dom/server is
// already a direct dependency; vitest runs environment:node) and reads the
// active tab off the underline span that only the active item renders.
describe("T5 — exactly one tab lights per surface", () => {
  async function activeTabFor(pathname: string): Promise<string[]> {
    vi.resetModules();
    vi.doMock("next/navigation", () => ({
      usePathname: () => pathname,
      useRouter: () => ({ push: () => {}, back: () => {} }),
    }));
    const { BottomNav } = await import("@/components/consumer/BottomNav");
    const html = renderToStaticMarkup(<BottomNav />);
    // The active item renders a `bg-primary absolute -top-2` underline span;
    // pull the label out of each nav item and keep the ones that carry it.
    const items = html.split("<a ").slice(1);
    return items
      .filter((chunk) => chunk.includes("-top-2"))
      .map((chunk) => {
        const m = chunk.match(/text-center">([^<]+)</);
        return m ? m[1] : "?";
      });
  }

  const MATRIX: [string, string][] = [
    ["/home", "Home"],
    ["/search/chat", "Search"],
    ["/place/abc", "Home"],
    ["/search", "Search"],
    // Pay is one page and lights its own tab there.
    ["/pay", "Pay"],
    // The Saved tab and the detail route it owns: a reservation is reached
    // from a place AND from the list (MESITA-2518 as Bookings, Saved since
    // MESITA-2521; Me owned it until then).
    ["/saved", "Saved"],
    ["/reservation/r1", "Saved"],
    ["/me", "Me"],
  ];

  it.each(MATRIX)("%s lights exactly %s", async (path, expected) => {
    const lit = await activeTabFor(path);
    expect(lit).toEqual([expected]);
  });

  // Non-overlap is currently naming luck (/pay vs /place share no prefix that
  // the matcher reads). Pin it so a future rename that creates an overlap
  // fails here.
  it("never lights two tabs at once", async () => {
    for (const [path] of MATRIX) {
      expect((await activeTabFor(path)).length, path).toBe(1);
    }
  });

  // THE SECOND STAGE IS A SET OF REDIRECT SOURCES AND NOTHING ELSE (Pato,
  // MESITA-2087). Every address below shipped to production. Each one must be
  // caught by next.config — first match, as Next fires it — and land on a
  // page in ONE hop. A missing entry is a 404 on a printed QR; a dangling one
  // is a 404 with extra steps.
  it.each([
    "/new-visit",
    "/visit/t1",
    "/wallet",
    "/wallet/buy",
    "/wallet/balance/bal_1",
    "/credits",
    "/order",
    "/rewards",
    "/qr",
    "/ticket/t1",
    "/gift/1234567890",
    "/me/diamond",
    "/me/visits",
    "/me/settings/metrics",
    "/share",
  ])("%s is a redirect source that resolves in one hop", async (address) => {
    const redirects = await nextConfig.redirects!();
    const hit = redirects.find((r) => matches(r.source, address));
    expect(hit, `${address} has no redirect`).toBeDefined();
    const pages = new Set(
      allPages().map((p) => pageUrl(p).replace(/\[[^\]]+\]/g, ":id")),
    );
    expect(
      pages.has(hit!.destination.replace(/:[A-Za-z]+/g, ":id")),
      `${address} → ${hit!.destination} is not a page`,
    ).toBe(true);
  });
});

// The bar is Home · Search · Pay (Soon) · Me (Pato, MESITA-2076: "BOTTOM BAR
// MUST ONLY BE. Home. Search. Pay(Soon). Me."), and Pay is a LINK like the
// other three — its page is the Soon state. Two things
// MESITA-1119 cared about are unchanged below: no class stamped into Me, and
// no Agents tab.
describe("the bar is Home · Search · Pay (Soon) · Me", () => {
  async function renderNav(pathname: string): Promise<string> {
    vi.resetModules();
    vi.doMock("next/navigation", () => ({
      usePathname: () => pathname,
      useRouter: () => ({ push: () => {}, back: () => {} }),
    }));
    const { BottomNav } = await import("@/components/consumer/BottomNav");
    return renderToStaticMarkup(<BottomNav />);
  }

  async function tabLabels(): Promise<string[]> {
    const html = await renderNav("/search");
    return [...html.matchAll(/text-center">([^<]+)</g)].map((m) => m[1]);
  }

  it("is exactly Home · Search · Pay · Saved · Me (MESITA-2521)", async () => {
    expect(await tabLabels()).toEqual(["Home", "Search", "Pay", "Saved", "Me"]);
  });

  it("keeps Wallet, Visit and Order off the bar", async () => {
    const labels = await tabLabels();
    expect(labels).not.toContain("Wallet");
    expect(labels).not.toContain("Visit");
    expect(labels).not.toContain("Order");
  });

  // Five <a> tabs, no <button>: Pay navigates to its page like every other
  // tab, and it is the only one tagged Soon — exactly once.
  it("draws five links, Pay among them with one Soon tag and no button", async () => {
    const html = await renderNav("/search");
    const anchors = html.split("<a ").slice(1);
    expect(anchors).toHaveLength(5);
    expect(html.includes("<button")).toBe(false);
    const pay = anchors.find((a) => /text-center">Pay</.test(a));
    expect(pay).toBeDefined();
    expect(pay).toMatch(/>Soon</);
    expect(html.match(/>Soon</g)).toHaveLength(1);
  });

  it("does not stamp class into Me and does not add an Agents tab", async () => {
    const labels = await tabLabels();
    expect(labels.some((l) => l.includes("·"))).toBe(false);
    expect(labels).not.toContain("Agents");
    expect(labels).not.toContain("Agent");
  });

  // Every tab's href is a live page, never a redirect source — a tab that
  // 308s costs a hop on every tap and lights nothing while it runs.
  it("points every tab at its own live default", async () => {
    const html = await renderNav("/me");
    const hrefs = [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(hrefs).toEqual([
      CONSUMER_ROUTES.home,
      CONSUMER_ROUTES.search,
      CONSUMER_ROUTES.pay,
      CONSUMER_ROUTES.saved,
      CONSUMER_ROUTES.me,
    ]);
    const redirects = await nextConfig.redirects!();
    expect(
      hrefs.filter((h) => redirects.some((r) => matches(r.source, h))),
    ).toEqual([]);
    const pages = new Set(allPages().map(pageUrl));
    for (const href of hrefs) expect(pages, href).toContain(href);
  });
});

// ── T5b — Home's header and Search's header ────────────────────────────────
// HOME'S HEADER IS THE LOGO AND THE LOCATION (MESITA-2405: the location is its
// only control; MESITA-2470: the Mesita logo beside it, for brand identity).
// Social and Favorites are rows of the catalog's column; Home has no pills. Search's header is locate · bar ·
// Ask AI over a row of family chips (MESITA-2409).
describe("T5b — Home's header and Search's header", () => {
  it('Home\'s header is the name "Mesita", then the location picker, and nothing else', () => {
    const tabs = readFileSync(join(COMPONENTS, "ModeTabs.tsx"), "utf8");
    // The stone band (BrandHeader, MESITA-2524/2529) holds the name and the tab's
    // own control; Home's is the location picker alone.
    expect(tabs).toMatch(
      /data-home-header>\s*<span[\s\S]*?data-home-wordmark\s*>\s*Mesita\s*<\/span>\s*\{children\}\s*<\/div>/,
    );
    expect(tabs).toMatch(
      /<BrandHeader>\s*<LocationPicker \/>\s*<\/BrandHeader>/,
    );
    expect(tabs).not.toContain("HOME_MODES");
    const layout = readFileSync(
      join(SHELL, "(discovery)", "home", "layout.tsx"),
      "utf8",
    );
    expect(layout).toContain("<ModeTabs />");
  });

  // Search's header (MESITA-2409): locate · bar · Ask AI, then family chips.
  // Ask AI lands on /search/chat: from Search, a sheet over the map
  // (MESITA-2475); cold-loaded, the Soon page with a way back.
  it("Search's header is locate · bar · Ask AI, and Ask AI is a real Soon page", () => {
    const header = readFileSync(
      join(COMPONENTS, "search", "SearchHeader.tsx"),
      "utf8",
    );
    expect(header).toContain("href={CONSUMER_ROUTES.searchChat}");
    expect(header).toMatch(
      /\{locate\}\s*<div className="min-w-0 flex-1">\{bar\}<\/div>\s*<Link/,
    );
    expect(header).toContain("Ask AI");
    expect(new Set(allPages().map(pageUrl))).toContain(
      CONSUMER_ROUTES.searchChat,
    );
    const chat = readFileSync(
      join(SHELL, "(discovery)", "search", "chat", "page.tsx"),
      "utf8",
    );
    expect(chat).toContain("HomeSoon");
    expect(chat).toContain("href={CONSUMER_ROUTES.search}");
    expect(chat).not.toMatch(/<AskAiTab/);
    const sheet = readFileSync(
      join(SHELL, "@modal", "(.)search", "chat", "layout.tsx"),
      "utf8",
    );
    expect(sheet).toContain("<RouteSheetShell");
    const sheetPage = readFileSync(
      join(SHELL, "@modal", "(.)search", "chat", "page.tsx"),
      "utf8",
    );
    expect(sheetPage).toContain("<RouteSheetHeader");
    expect(sheetPage).toContain("HomeSoon");
  });

  // Home is ONE page: the catalog. Its Social row draws the feed in the
  // right pane, never a page (MESITA-2474), so no pane of Home is Soon.
  it("Home is /home, one page: the catalog (MESITA-2475)", () => {
    expect(CONSUMER_ROUTES.home).toBe("/home");
    const pages = new Set(allPages().map(pageUrl));
    expect(pages).toContain("/home");
    expect(pages).not.toContain("/discover");
    expect(pages).not.toContain("/discover/places");
    const places = readFileSync(
      join(SHELL, "(discovery)", "home", "page.tsx"),
      "utf8",
    );
    expect(places).toContain("<CatalogRails");
    expect(places).not.toContain("HomeSoon");
    const rails = readFileSync(
      join(COMPONENTS, "home", "CatalogRails.tsx"),
      "utf8",
    );
    expect(rails).not.toContain("<HomeSoon");
    expect(rails).toContain(
      "return shell(<SocialFeed samplePlaces={samplePlaces} />);",
    );
    expect(rails).not.toContain("router.push");
    expect(new Set(allPages().map(pageUrl))).not.toContain("/discover/social");
    const soon = readFileSync(join(COMPONENTS, "home", "HomeSoon.tsx"), "utf8");
    expect(soon).toContain("is coming soon");
  });

  // Chat left Home for the Search tab (MESITA-2401): no page, one hop.
  it("/discover/chat has no page and 308s to /search/chat", async () => {
    const hop = (await nextConfig.redirects!()).find(
      (r) => r.source === "/discover/chat",
    );
    expect(hop?.destination).toBe(CONSUMER_ROUTES.searchChat);
    expect(
      existsSync(join(SHELL, "(discovery)", "discover", "chat", "page.tsx")),
    ).toBe(false);
  });

  // Swipe (MESITA-2166), Scroll (MESITA-2163), Catalog's old Feed address,
  // Favorites (MESITA-2383) and Social (MESITA-2474) left; Places itself
  // became /home (MESITA-2475).
  it.each(["places", "swipe", "scroll", "feed", "favs", "social"])(
    "/discover/%s has no page and 308s to Home",
    async (seg) => {
      const hop = (await nextConfig.redirects!()).find(
        (r) => r.source === `/discover/${seg}`,
      );
      expect(hop?.destination).toBe(CONSUMER_ROUTES.home);
      expect(
        existsSync(join(SHELL, "(discovery)", "discover", seg, "page.tsx")),
      ).toBe(false);
    },
  );

  // The Places test tab (MESITA-2402) is deleted (MESITA-2405).
  it("/discover and /places have no page and 308 to Home", async () => {
    const bare = (await nextConfig.redirects!()).find(
      (r) => r.source === "/discover",
    );
    expect(bare?.destination).toBe(CONSUMER_ROUTES.home);
    expect(existsSync(join(SHELL, "(discovery)", "discover"))).toBe(false);
    const hop = (await nextConfig.redirects!()).find(
      (r) => r.source === "/places",
    );
    expect(hop?.destination).toBe(CONSUMER_ROUTES.home);
    expect(existsSync(join(SHELL, "(discovery)", "places", "page.tsx"))).toBe(
      false,
    );
  });
});

// ── T6 — Activity is pages on Me, not a container ──────────────────────────
//
// This used to pin InboxSectionNav.SECTIONS, the hand-listed pill row a guest
// actually saw, because the contract's key order pinned nothing at runtime.
// MESITA-1626 deleted the row and the container under it: the Me boxes each
// deep-linked past that nav into one section, so its only job was asking the
// guest to re-choose what they had just chosen.
//
// The same class of bug still exists one layer over — a box wired to the wrong
// page, or a page dropped in a refactor — so the pin moves rather than dies.
describe("T6 — Activity's sections are pages on Me", () => {
  const ME = readFileSync(join(SHELL, "me", "ProfileClient.tsx"), "utf8");

  it("routes each box to its page: notifications on Me, reservations to Saved › Reservations", () => {
    expect(ME).toContain("CONSUMER_ROUTES.mePages.notifications");
    expect(ME).not.toContain("CONSUMER_ROUTES.mePages.visits");
    // The list is the bar's Saved tab, Reservations (MESITA-2518, MESITA-2521).
    expect(ME).toContain("SAVED_TAB_HREF.reservations");
    expect(ME).not.toContain("CONSUMER_ROUTES.mePages.reservations");
    expect(ME).not.toMatch(/<(AlertsModal|VisitsModal|BookingsModal)\b/);
  });

  it("no box routes into a container any more", () => {
    expect(ME).not.toContain("CONSUMER_ROUTES.inbox");
  });

  it("the /inbox route tree is gone from the app", () => {
    expect(existsSync(join(SHELL, "inbox"))).toBe(false);
  });
});

// ── T8 — the destination grid holds only things that work ──────────────────
//
// Me is a 2-up grid (MESITA-1628). In a grid a dead cell reads as broken
// rather than upcoming, so the grid holds live doors only.
//
// The regression this catches is a tile for a surface that does not exist
// — `DestTile` has no `soon` prop and its `href` is required, so such a tile
// would ship as a live Link pointing at nothing.
describe("T8 — Me's grid is six live cells", () => {
  const ME = readFileSync(join(SHELL, "me", "ProfileClient.tsx"), "utf8");
  /** `<DestTile … title="X">` values, in render order. */
  const gridTitles = (source: string) => {
    const cells = [...source.matchAll(/<DestTile\b[\s\S]*?\/>/g)].map(
      (m) => m[0],
    );
    return cells
      .map((c) => c.match(/title="([^"]+)"/)?.[1])
      .filter((t): t is string => Boolean(t));
  };

  it("renders six cells in Pato's order", () => {
    // Pato, MESITA-2134, then MESITA-2169: "move support into settings".
    // PROFILE LEADS (Pato, 2026-09-08): the header states the identity, so
    // the first cell is the one that edits it. Support is a group on
    // Settings, not a cell.
    expect(gridTitles(ME)).toEqual([
      "Profile",
      "Instagram",
      "Plan",
      "Notifications",
      "Reservations",
      "Settings",
    ]);
  });

  it("holds no money door and no Second Stage door", () => {
    for (const gone of [
      "Wallet",
      "Visits",
      "Orders",
      "Share",
      "Gift",
      "Integrations",
      "Friends",
      "Diamond",
      "Cards",
      "Metrics",
    ]) {
      expect(gridTitles(ME), gone).not.toContain(gone);
    }
  });

  it("Settings closes the page", () => {
    // The tail cell (MESITA-1642). Support moved into it (MESITA-2169).
    expect(gridTitles(ME).at(-1)).toBe("Settings");
    expect(gridTitles(ME)).not.toContain("Support");
  });

  it("rows are pairs; nothing spans", () => {
    // Three `DestGrid`s, each a pair. Counting grids and spans SEPARATELY
    // on purpose: a cells-per-grid ratio stays true of any row width.
    expect([...ME.matchAll(/<DestGrid>/g)]).toHaveLength(3);
    expect([...ME.matchAll(/<DestTile\b[\s\S]*?\/>/g)]).toHaveLength(6);
    expect([...ME.matchAll(/^\s*full$/gm)]).toHaveLength(0);
    expect(ME).not.toMatch(/<DestGrid cols=/);
  });

  it("no cell is compact or parked — every cell says what it holds", () => {
    // The four-up bought its width by dropping the summary line, which left
    // Activity as the only cells on Me that named a destination without
    // saying what was in it. `DestTile` has no `compact` and no `soon` prop;
    // this pins the page so a "make it fit" or "coming soon" change cannot
    // reintroduce either idea by hand.
    const cells = [...ME.matchAll(/<DestTile\b[\s\S]*?\/>/g)].map((m) => m[0]);
    expect(cells.filter((c) => /\bcompact\b/.test(c))).toEqual([]);
    expect(cells.filter((c) => /\bsoon\b/.test(c))).toEqual([]);
    const silent = cells
      .filter((c) => /summary=""/.test(c))
      .map((c) => c.match(/title="([^"]+)"/)?.[1]);
    expect(silent).toEqual([]);
  });

  it("DestTile is ONE shape, with no second branch to drift", () => {
    const src = readFileSync(join(SHELL, "me", "profile-sections.tsx"), "utf8");
    // MESITA-1633's rule, now structural rather than a convention: there is
    // no `compact` prop and no `cols` prop, so there is no second layout for
    // a cell or a row to be rendered in.
    expect(src).not.toMatch(/compact\??:/);
    expect(src).not.toMatch(/cols\??:/);
    expect(src).not.toContain("grid-cols-4");
    // ...and no inert branch: no `soon`, `disabled`, `onClick` or `full`
    // prop, and no <button>. A cell is a Link or it is not on the page.
    for (const prop of ["soon", "disabled", "onClick", "full"]) {
      expect(src, prop).not.toMatch(new RegExp(`\\b${prop}\\??:`));
    }
    expect(src).not.toContain("<button");
  });

  it("the More drawer is gone from the codebase", () => {
    // It held exactly Gift and Share; with both on the page it held nothing,
    // and an empty drawer is worse than none.
    expect(ME).not.toContain("MoreModal");
    expect(existsSync(join(COMPONENTS, "me", "MoreModal.tsx"))).toBe(false);
  });

  it("sign out is in Settings, not in the page body", () => {
    // It was a button under the last card until MESITA-1634. Settings is
    // where the rest of the account controls are, and a stray sign-out on the
    // page is the kind of thing that quietly comes back in a refactor.
    expect(ME).not.toContain("SignOutButton");
    expect(
      readFileSync(join(COMPONENTS, "me", "SettingsModal.tsx"), "utf8"),
    ).toContain("SignOutButton");
  });

  it("Settings is the only door to terms and privacy", () => {
    // Legal moved into Settings with Support (MESITA-2169). One door:
    // the Support page is gone, and nothing else links the policy URLs.
    // Reading the URL CONSTANTS, not the words "terms"/"privacy": the
    // Export-my-data row names the privacy@ inbox, which is a different
    // constant.
    const dir = join(COMPONENTS, "me");
    const settings = readFileSync(join(dir, "SettingsModal.tsx"), "utf8");
    for (const url of ["MESITA_TERMS_URL", "MESITA_PRIVACY_URL"]) {
      expect(settings).toContain(url);
    }
    expect(existsSync(join(dir, "HelpModal.tsx"))).toBe(false);
    expect(existsSync(join(dir, "AboutModal.tsx"))).toBe(false);
    expect(existsSync(join(SHELL, "me", "help", "page.tsx"))).toBe(false);
  });

  it("the version has ONE source, and it is not a literal on the page", () => {
    // It was a hardcoded string in a <p> at the bottom of Me. Two typed
    // copies of a number that changes every release drift on release one.
    //
    // Comments STRIPPED first. The note explaining why the footer is gone
    // necessarily quotes it, so a raw scan fires on its own rationale and
    // the cheapest way to green it would be deleting the rationale.
    const settings = readFileSync(
      join(COMPONENTS, "me", "SettingsModal.tsx"),
      "utf8",
    );
    const code = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    // It renders once, on Settings (MESITA-2169 moved Support's copy here).
    // The import and the JSX both name APP_VERSION; the render line is one.
    expect(code(settings).match(/\{APP_VERSION\}/g)).toHaveLength(1);
    expect(code(settings)).not.toMatch(/v\d+\.\d+\.\d+/);
    expect(code(ME)).not.toMatch(/v\d+\.\d+\.\d+/);
  });
});

// ── T7 — a MOVED route keeps its redirect ───────────────────────────────────
//
// T4 walks nextConfig.redirects() and proves every destination resolves. It
// structurally cannot prove a redirect EXISTS: delete the entry and there is
// simply nothing left for it to check, so it passes.
//
// Every address below was live on consumer.mesita.ai, so every set of
// bookmarks is real. If an entry is ever dropped, this goes red instead of CI
// going green while those links 404.
describe("T7 — every former url still resolves after the move", () => {
  it.each([
    // Both landed on the Reservations SECTION until MESITA-1626 dissolved the
    // container; the list is Saved › Reservations now (MESITA-2521), and
    // /saved itself is the live tab again.
    ["/saved/reservations", "/saved?tab=reservations"],
    ["/saved/reservation/:id", "/reservation/:id"],
    ["/saved/place/:id", "/place/:id"],
  ])(
    "keeps the Saved-era redirect %s → %s (MESITA-1585)",
    async (source, destination) => {
      const redirects = await nextConfig.redirects!();
      const entry = redirects.find((r) => r.source === source);
      expect(entry, `${source} redirect was removed`).toBeDefined();
      expect(entry!.destination).toBe(destination);
    },
  );

  // Wallet shipped under every spelling below — standalone /credits, an
  // Activity section (/inbox/credits), a Pay section (/new-visit/wallet) and
  // its own tab (/wallet). Every spelling lands on Pay in ONE hop — first
  // match, as Next fires it — and that is why this asserts the destination
  // rather than just the entry.
  it.each([
    ["/credits", "/pay"],
    ["/inbox/credits", "/pay"],
    ["/new-visit/wallet", "/pay"],
    ["/new-visit/wallet/buy", "/pay"],
    ["/new-visit/wallet/gift", "/pay"],
    ["/new-visit/wallet/redeem", "/pay"],
    ["/new-visit/wallet/balance/bal_1", "/pay"],
  ])("keeps %s redirecting straight to %s", async (address, destination) => {
    const redirects = await nextConfig.redirects!();
    const hit = redirects.find((r) => matches(r.source, address));
    expect(hit, `${address} redirect was removed`).toBeDefined();
    expect(hit!.destination).toBe(destination);
  });
});

// ── T9 — Pay is one page ────────────────────────────────────────────────────
//
// Pay is ONE page, the Soon state, and the Second Stage route trees are
// deleted, not emptied. A change that grows Pay a child or brings a tree
// back has to delete these lines to do it, which is the review moment.
describe("T9 — Pay is one page, and the Second Stage trees are gone", () => {
  it("(shell)/pay is a page with no subdirectories", () => {
    const pay = join(SHELL, "pay");
    expect(existsSync(join(pay, "page.tsx"))).toBe(true);
    const children = readdirSync(pay).filter((e) =>
      statSync(join(pay, e)).isDirectory(),
    );
    expect(children).toEqual([]);
  });

  it("no Second Stage route tree exists", () => {
    for (const rel of [
      ["(shell)", "(visit)"],
      ["(shell)", "new-visit"],
      ["(shell)", "wallet"],
      ["(shell)", "visit"],
      ["(shell)", "order"],
      ["(shell)", "share"],
      ["(shell)", "me", "diamond"],
      ["(shell)", "me", "visits"],
      ["(shell)", "me", "settings", "metrics"],
      ["gift"],
    ]) {
      expect(existsSync(join(APP_DIR, ...rel)), rel.join("/")).toBe(false);
    }
  });

  // /pay is the live page every Second Stage spelling lands on. A redirect
  // whose SOURCE is a live route shadows it — the page never renders and
  // every gate stays green.
  it("keeps /pay itself out of the redirect table", async () => {
    const redirects = await nextConfig.redirects!();
    expect(
      redirects.find((r) => r.source === CONSUMER_ROUTES.pay),
    ).toBeUndefined();
    expect(
      redirects.find((r) => matches(r.source, CONSUMER_ROUTES.pay)),
    ).toBeUndefined();
  });
});
