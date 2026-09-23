import { readdirSync, existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  CONSUMER_ROUTES,
  isModalContractPath,
} from "@/lib/consumer-route-contract";
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
    // MESITA-1677: the public gift landing page. A recipient who has never
    // heard of Mesita would hit OTP before a single pixel of the org's
    // identity rendered otherwise — sign-in is step TWO here, after the
    // guest has seen what they were given. Renders server-side from a
    // possession code (gift-web-preview-code, verify_jwt=false); the actual
    // claim still happens behind the wall, at wallet.redeem.
    "gift/[code]/page.tsx",
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
// SlideOverShell and BottomSheetShell both open with
// `if (!isModalContractPath(pathname)) return null`. They are the only
// consumers of that predicate, and they are mounted only from
// @modal/(.)X/layout.tsx. So adding an intercept directory WITHOUT adding its
// path to the predicate ships a silently blank modal: the URL changes, the
// page underneath stays, nothing opens. Typecheck, build and the contract test
// all stay green.
//
// ONE DIRECTION ONLY. The reverse is not an invariant: the predicate carries
// /rewards/ticket/ with no intercept directory, deliberately — that surface is
// a plain full page.
describe("T2 — every @modal intercept is allowed by isModalContractPath", () => {
  it("catches the blank-modal trap", () => {
    const modalRoot = join(SHELL, "@modal");
    const intercepts = findDirs(modalRoot, (n) => n.startsWith("(.)"));

    const blank = intercepts
      // Only LEAF intercepts render — an intermediate dir like (.)place is
      // just structure holding [id]; it has no page and paints nothing.
      .filter((dir) => existsSync(join(dir, "page.tsx")))
      .map((dir) => {
        // (shell)/@modal/(.)me/class -> /me/class ; [id] -> a sample value
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
    const redirects = await nextConfig.redirects!();
    const sources = new Set(redirects.map((r) => r.source));

    // A destination resolves if a real page matches it, or if it is itself a
    // redirect source (a legal one-hop chain).
    const pages = allPages().map(
      (p) =>
        "/" +
        p
          .replace(/\/page\.tsx$/, "")
          .split("/")
          .filter((seg) => !seg.startsWith("(") && !seg.startsWith("@"))
          .join("/"),
    );

    const resolves = (dest: string) => {
      if (sources.has(dest)) return true;
      // :id / :tab params in a destination correspond to [id] / [tab] segments.
      const normalized = dest.replace(/:[a-zA-Z]+/g, "[param]");
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
// the contract test, not the build. Renaming /rewards/ticket/[id] to
// /visit/[id] is precisely that severing, so this matrix is the only mechanism
// that can hold the "visit detail lights Inbox" requirement.
//
// Renders the real component with renderToStaticMarkup (react-dom/server is
// already a direct dependency; vitest runs environment:node) and reads the
// active tab off the pink underline span that only the active item renders.
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
    ["/discover/scroll", "Home"],
    ["/discover/chat", "Home"],
    ["/discover/favs", "Home"],
    ["/place/abc", "Home"],
    ["/search", "Search"],
    ["/new-visit", "Visit"],
    ["/visit/t1", "Visit"],

    // Wallet is a tab again, and its four full-screen children light it by
    // nesting under /wallet. /credits, /inbox/credits and every
    // /new-visit/wallet* path are redirect SOURCES, never rendered, so none
    // of them belongs in this matrix.
    ["/wallet", "Wallet"],
    ["/wallet/buy", "Wallet"],
    ["/wallet/gift", "Wallet"],
    ["/wallet/redeem", "Wallet"],
    ["/wallet/balance/bal_1", "Wallet"],

    // Me's pages, and the one detail route it still owns: a reservation is
    // reached from a place AND from Me › Reservations.
    ["/me", "Me"],
    ["/me/visits", "Me"],
    ["/reservation/r1", "Me"],
  ];

  it.each(MATRIX)("%s lights exactly %s", async (path, expected) => {
    const lit = await activeTabFor(path);
    expect(lit).toEqual([expected]);
  });

  // Non-overlap is currently naming luck (/rewards vs /reservation share no
  // prefix). Pin it so a future rename that creates an overlap fails here.
  // /new-visit vs /visit is a genuine prefix hazard: "/visit".startsWith is
  // false for "/new-visit". Both light Visit now, but /wallet vs /new-visit
  // is the live hazard — Wallet left /new-visit/wallet for its own tab, and a
  // stale prefix would light two tabs. Pin the cardinality.
  it("never lights two tabs at once", async () => {
    for (const [path] of MATRIX) {
      expect((await activeTabFor(path)).length, path).toBe(1);
    }
  });
});

// MESITA-2055 — the visit-optimised bar is Home · Search · Visit · Wallet · Me.
//
// This REPLACES the MESITA-1609 guard (Home · Search · Pay · Me), which had
// itself reversed MESITA-1119's. Two things MESITA-1119 cared about are
// unchanged below: no class stamped into Me, and no Agents tab.
describe("MESITA-2055 — the bar is Home · Search · Visit · Wallet · Me", () => {
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

  it("is exactly Home · Search · Visit · Wallet · Me", async () => {
    expect(await tabLabels()).toEqual([
      "Home",
      "Search",
      "Visit",
      "Wallet",
      "Me",
    ]);
  });

  it("keeps Order off the visit-optimised bar", async () => {
    expect(await tabLabels()).not.toContain("Order");
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
      CONSUMER_ROUTES.discoverDefault,
      CONSUMER_ROUTES.search,
      CONSUMER_ROUTES.newVisit.root,
      CONSUMER_ROUTES.wallet.root,
      CONSUMER_ROUTES.me,
    ]);
    const sources = new Set(
      (await nextConfig.redirects!()).map((r) => r.source),
    );
    expect(hrefs.filter((h) => sources.has(h))).toEqual([]);
  });
});

// ── T5b — Home's supporting rail ───────────────────────────────────────────
// A rail whose href stops matching its own pathname lights NOTHING, and
// neither tsc nor the build nor any other test notices — the row just quietly
// loses its selected state. This pins ORDER, COUNT, the width budget, and
// that every pill is a real page.
//
// The order is Pato's, verbatim (MESITA-2050): "Home(scroll). Search. Chat.
// Favs. Pay." and "Order must have Home."
describe("T5b — Home's supporting rail", () => {
  it("is exactly Home · Chat · Favs", async () => {
    const { HOME_MODES } = await import("@/components/consumer/ModeRail");
    expect(HOME_MODES.map((m) => m.label)).toEqual(["Home", "Chat", "Favs"]);
  });

  // Feed left the rail (MESITA-2050). Its segment is a redirect source again,
  // and the pill must not come back pointing at a 308.
  it("has no Feed pill, and /discover/feed forwards to Home in one hop", async () => {
    const { HOME_MODES } = await import("@/components/consumer/ModeRail");
    expect(HOME_MODES.map((m) => m.label)).not.toContain("Feed");
    const hop = (await nextConfig.redirects!()).find(
      (r) => r.source === "/discover/feed",
    );
    expect(hop?.destination).toBe(CONSUMER_ROUTES.discoverTabs.scroll);
    expect(
      existsSync(join(SHELL, "(visit)", "discover", "feed", "page.tsx")),
    ).toBe(false);
  });

  // The width budget, as an assertion rather than a comment. `auto-cols-fr`
  // sizes every column to the WIDEST pill, so the track is N x widest plus
  // (N-1) x 4px of gaps, and it has to fit 359px (375 frame less px-2).
  //
  it("keeps every Home label inside the 359px track", async () => {
    const { HOME_MODES } = await import("@/components/consumer/ModeRail");
    const navSrc = readFileSync(
      join(__dirname, "..", "..", "components/consumer/ModeRail.tsx"),
      "utf8",
    );
    // Match the class strings themselves, not the words anywhere in the file.
    expect(navSrc).toContain('"text-xs flex items-center');
    expect(navSrc).toContain('className="h-3.5 w-3.5 shrink-0"');
    const TEXT_PX: Record<string, number> = {
      Home: 34.2,
      Search: 40.9,
      Chat: 27.3,
      Favs: 27.6,
      Pay: 21.7,
    };
    const widest = Math.max(
      ...HOME_MODES.map((m) => {
        const text = TEXT_PX[m.label];
        expect(
          text,
          `unmeasured label "${m.label}" — measure it at 12px`,
        ).toBeTypeOf("number");
        return text + 26;
      }),
    );
    expect(
      widest * HOME_MODES.length + (HOME_MODES.length - 1) * 4,
    ).toBeLessThanOrEqual(359);
  });

  // Every pill is a LIVE page — never a redirect source, which would cost a
  // hop and light no pill while it ran.
  it("every pill href is a real page, one each", async () => {
    const { HOME_MODES } = await import("@/components/consumer/ModeRail");
    const pages = new Set(
      allPages().map(
        (p) =>
          "/" +
          p
            .replace(/\/?page\.tsx$/, "")
            .split("/")
            .filter(
              (seg) => seg && !seg.startsWith("(") && !seg.startsWith("@"),
            )
            .join("/"),
      ),
    );
    const hrefs = HOME_MODES.map((m) => m.href);
    for (const href of hrefs) expect(pages, href).toContain(href);
    expect(new Set(HOME_MODES.map((m) => m.href)).size).toBe(HOME_MODES.length);
    // The three /discover pills are exactly the contract's discoverTabs.
    expect(
      HOME_MODES.map((m) => m.href).filter((h) => h.startsWith("/discover/")),
    ).toEqual(Object.values(CONSUMER_ROUTES.discoverTabs));
  });

  // First pill is the default, the property this rail has preserved since
  // MESITA-1609. Visit's bottom-tab href is Home's href.
  it("lands Home on its leading pill", async () => {
    const { HOME_MODES } = await import("@/components/consumer/ModeRail");
    expect(CONSUMER_ROUTES.discoverDefault).toBe(
      CONSUMER_ROUTES.discoverTabs.scroll,
    );
    expect(HOME_MODES[0].href).toBe(CONSUMER_ROUTES.discoverDefault);
    expect(HOME_MODES[0].label).toBe("Home");
  });

  it("every Home pill's page lives under discover", () => {
    for (const rel of [
      ["discover", "scroll"],
      ["discover", "chat"],
      ["discover", "favs"],
    ]) {
      expect(
        existsSync(join(SHELL, "(visit)", ...rel, "page.tsx")),
        rel.join("/"),
      ).toBe(true);
    }
    const layout = readFileSync(
      join(SHELL, "(visit)", "discover", "layout.tsx"),
      "utf8",
    );
    expect(layout).toContain("<ModeRail modes={HOME_MODES} />");
  });
});

// ── T6 — Activity is three sheets on Me, not a container ───────────────────
//
// This used to pin InboxSectionNav.SECTIONS, the hand-listed pill row a guest
// actually saw, because the contract's key order pinned nothing at runtime.
// MESITA-1626 deleted the row and the container under it: the three Me boxes
// each deep-linked past that nav into one section, so its only job was asking
// the guest to re-choose what they had just chosen.
//
// The same class of bug still exists one layer over — a box wired to the wrong
// sheet, or a sheet dropped in a refactor — so the pin moves rather than dies.
describe("T6 — Activity's three sections are pages on Me", () => {
  const ME = readFileSync(join(SHELL, "me", "ProfileClient.tsx"), "utf8");

  it("routes each box to its own /me page: notifications · visits · reservations", () => {
    expect(ME).toContain("CONSUMER_ROUTES.mePages.notifications");
    expect(ME).toContain("CONSUMER_ROUTES.mePages.visits");
    expect(ME).toContain("CONSUMER_ROUTES.mePages.reservations");
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
// MESITA-1628 moved Me's long tail onto the page as a 2-up grid and left the
// PARKED tail behind More. That split is the whole product decision: three
// greyed cells out of eleven is a quarter of the block, and in a grid a dead
// cell reads as broken rather than upcoming.
//
// The regression this catches is a parked feature drifting up into the grid
// because it "looks ready" — the grid cell has no `soon` prop at all, so it
// would ship as a live tile pointing at nothing.
describe("T8 — Me's grid is live cells, More is the parked tail", () => {
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

  it("renders fifteen cells: Profile full-width, then seven pairs", () => {
    // Seven pairs, no four-up and no tail (MESITA-1639). MESITA-1636 broke the
    // rhythm with a four-up so the column would not read as undifferentiated,
    // and paid for it in the only four cells on the page with no summary. The
    // passport leads by being a different OBJECT — a document with a photo,
    // twice the height of a cell — not by the pairs below it varying.
    //
    // PROFILE LEADS (Pato, 2026-09-08), reversing MESITA-1648: the header
    // states the identity, so the first cell is the one that edits it. It
    // spans the row since the Passport died (MESITA-2043: "we don't have
    // passports"), because fifteen cells cannot pair.
    //
    // INSTAGRAM AND DIAMOND ARE CELLS (Pato, MESITA-2040: "so add instagram
    // and then diamond"). Read the history before assuming this is a revert:
    // the pair was cells (MESITA-1650), then header chips only (MESITA-1652),
    // then cells again (MESITA-1682), then Passport rows (MESITA-1787) — and
    // every one of those rounds was about where ONE AXIS lives, with "the
    // header already says the rung" as the argument against a cell. There is
    // no rung. These are two unrelated destinations, and the ORDER is
    // load-bearing: Instagram first, on all three surfaces that print them
    // (header chips, this grid). The chips STAY.
    //
    // Still absent, each for its own reason: Metrics and Contact moved into
    // Settings; Cards is the same `CardsModal` Pay's Wallet already opens,
    // and Wallet is a cell right here.
    expect(gridTitles(ME)).toEqual([
      "Profile",
      "Instagram",
      "Diamond",
      "Wallet",
      "Plan",
      "Notifications",
      "Visits",
      "Orders",
      "Reservations",
      "Share",
      "Gift",
      "Settings",
      "Help",
      "Integrations",
      "Friends",
    ]);
  });

  it("the fully-parked row sits BELOW Settings and Help", () => {
    // Connector and Friends are both `soon`, so that row opens nothing at
    // all. Settings and Help are the most-reached cells in the tail, so they
    // come first — MESITA-1641 made exactly this argument and then shipped
    // the inverse, which is why the ordering is pinned rather than merely
    // commented (MESITA-1642). About stays last: it is the version and legal
    // footer, the least-reached cell on the page.
    const order = gridTitles(ME);
    expect(order.indexOf("Settings")).toBeLessThan(
      order.indexOf("Integrations"),
    );
    expect(order.indexOf("Help")).toBeLessThan(order.indexOf("Friends"));
    expect(order.at(-1)).toBe("Friends");
  });

  it("Profile is the one full-width row; every other row is a pair", () => {
    // Eight `DestGrid`s of two. Counting grids and spans SEPARATELY on
    // purpose: "cells ÷ grids === 2" was true of the old four-up too, and
    // would go on being true of any row width. Eight since Instagram and
    // Diamond became their own pair (MESITA-2040).
    expect([...ME.matchAll(/<DestGrid>/g)]).toHaveLength(8);
    // About was the only spanning cell and it folded into Help (MESITA-1650).
    // Profile spans now (MESITA-2043) — exactly one, and it is Profile.
    expect([...ME.matchAll(/^\s*full$/gm)]).toHaveLength(1);
    const cells = [...ME.matchAll(/<DestTile\b[\s\S]*?\/>/g)].map((m) => m[0]);
    expect(
      cells
        .filter((c) => /^\s*full$/m.test(c))
        .map((c) => c.match(/title="([^"]+)"/)?.[1]),
    ).toEqual(["Profile"]);
    expect(ME).not.toMatch(/<DestGrid cols=/);
  });

  it("no cell is compact — every live cell says what it holds", () => {
    // The four-up bought its width by dropping the summary line, which left
    // Activity as the only cells on Me that named a destination without
    // saying what was in it. The prop is gone from `DestTile` entirely; this
    // pins the page so a "make it fit" change cannot reintroduce the idea by
    // hand. Parked cells are the exception — the Soon pill takes that slot.
    const cells = [...ME.matchAll(/<DestTile\b[\s\S]*?\/>/g)].map((m) => m[0]);
    expect(cells.filter((c) => /\bcompact\b/.test(c))).toEqual([]);
    const silent = cells
      .filter((c) => !/\bsoon\b/.test(c))
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
  });

  it("no Cards cell — Wallet already lists cards inline", () => {
    expect(gridTitles(ME)).not.toContain("Cards");
    expect(ME).not.toContain("<CardsModal");
  });

  it("the More drawer is gone from the codebase", () => {
    // It held exactly Gift and Share; with both on the page it held nothing,
    // and an empty drawer is worse than none.
    expect(ME).not.toContain("MoreModal");
    expect(
      existsSync(
        join(
          __dirname,
          "..",
          "..",
          "components",
          "consumer",
          "me",
          "MoreModal.tsx",
        ),
      ),
    ).toBe(false);
  });

  it("sign out is in Settings, not in the page body", () => {
    // It was a button under the last card until MESITA-1634. Settings is
    // where the rest of the account controls are, and a stray sign-out on the
    // page is the kind of thing that quietly comes back in a refactor.
    expect(ME).not.toContain("SignOutButton");
    expect(
      readFileSync(
        join(
          __dirname,
          "..",
          "..",
          "components",
          "consumer",
          "me",
          "SettingsModal.tsx",
        ),
        "utf8",
      ),
    ).toContain("SignOutButton");
  });

  it("every parked cell is marked `soon`, and only those four are", () => {
    // Nothing is hidden a tap deeper any more, so the page carries its own
    // roadmap: five cells wear the pill. A sixth live-looking cell pointing
    // at nothing — or one of these five quietly losing the flag — is the
    // regression this catches. Five of thirteen is a lot; T8's own opening
    // note says a dead cell in a grid reads as broken rather than upcoming,
    // so treat this list growing as a signal, not a formality.
    const parkedCells = [...ME.matchAll(/<DestTile\b[\s\S]*?\/>/g)]
      .map((m) => m[0])
      .filter((c) => /\bsoon\b/.test(c))
      .map((c) => c.match(/title="([^"]+)"/)?.[1]);
    expect(parkedCells).toEqual([
      "Orders",
      "Share",
      "Gift",
      "Integrations",
      "Friends",
    ]);
  });

  it("Help is the only door to terms and privacy", () => {
    // Legal has moved twice — out of Settings (MESITA-1641) into About, then
    // into Help when the About cell was cut (MESITA-1650). It has never had
    // two doors and must not gain one. Reading the URL CONSTANTS, not the
    // words "terms"/"privacy": Settings still has a Privacy GROUP about the
    // account's visibility, which has nothing to do with the policy.
    const dir = join(__dirname, "..", "..", "components", "consumer", "me");
    const settings = readFileSync(join(dir, "SettingsModal.tsx"), "utf8");
    const help = readFileSync(join(dir, "HelpModal.tsx"), "utf8");
    for (const url of ["MESITA_TERMS_URL", "MESITA_PRIVACY_URL"]) {
      expect(settings).not.toContain(url);
      expect(help).toContain(url);
    }
    expect(existsSync(join(dir, "AboutModal.tsx"))).toBe(false);
  });

  it("the version has ONE source, and it is not a literal on the page", () => {
    // It was a hardcoded string in a <p> at the bottom of Me. It now renders
    // twice — the About cell's summary and the About sheet — and two typed
    // copies of a number that changes every release drift on release one.
    //
    // Comments STRIPPED first. The note explaining why the footer is gone
    // necessarily quotes it, so a raw scan fires on its own rationale and
    // the cheapest way to green it would be deleting the rationale.
    const help = readFileSync(
      join(
        __dirname,
        "..",
        "..",
        "components",
        "consumer",
        "me",
        "HelpModal.tsx",
      ),
      "utf8",
    );
    const code = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    // It renders in Help now, not on the page (MESITA-1650).
    expect(code(help)).toContain("APP_VERSION");
    expect(code(help)).not.toMatch(/v\d+\.\d+\.\d+/);
    expect(code(ME)).not.toMatch(/v\d+\.\d+\.\d+/);
  });
});

// ── T7 — a MOVED route keeps its redirect ───────────────────────────────────
//
// T4 walks nextConfig.redirects() and proves every destination resolves. It
// structurally cannot prove a redirect EXISTS: delete the entry and there is
// simply nothing left for it to check, so it passes.
//
// /credits shipped standalone (#1429), went live on consumer.mesita.ai, and
// then moved under Inbox when it became a section. The bookmarks are real. If
// the redirect is ever dropped, this goes red instead of CI going green while
// those links 404.
describe("T7 — every former Wallet url still resolves after the move", () => {
  // Wallet has moved five times: standalone /credits (#1429) -> Activity
  // section (/inbox/credits) -> Pay section (/new-visit/wallet, 2026-09-01)
  // -> its own tab (/wallet, 09-05) -> Pay section again (09-06) -> its own
  // tab again (/wallet, MESITA-2050). Every old url was live in production,
  // so every set of bookmarks is real.
  //
  // EACH RESOLVES IN ONE HOP, and that is why this asserts the destination
  // rather than just the entry: pointing /credits at /new-visit/wallet would
  // still be a working redirect and would still be a two-hop chain.
  it.each([
    // Both landed on the Reservations SECTION until MESITA-1626 dissolved the
    // container; Bookings is a sheet on Me now, so Me is where they go.
    ["/saved", "/me"],
    ["/saved/reservations", "/me/reservations"],
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

  it.each([
    ["/credits", "/wallet"],
    ["/inbox/credits", "/wallet"],
    ["/new-visit/wallet", "/wallet"],
    ["/new-visit/wallet/buy", "/wallet/buy"],
    ["/new-visit/wallet/gift", "/wallet/gift"],
    ["/new-visit/wallet/redeem", "/wallet/redeem"],
    ["/new-visit/wallet/balance/:id", "/wallet/balance/:id"],
  ])("keeps %s redirecting straight to %s", async (source, destination) => {
    const redirects = await nextConfig.redirects!();
    const entry = redirects.find((r) => r.source === source);
    expect(entry, `${source} redirect was removed`).toBeDefined();
    expect(entry!.destination).toBe(destination);
  });

  // /wallet is the live page again. A redirect whose SOURCE is a live route
  // shadows it — the page never renders and every gate stays green.
  it("keeps /wallet itself out of the redirect table", async () => {
    const redirects = await nextConfig.redirects!();
    expect(redirects.find((r) => r.source === "/wallet")).toBeUndefined();
  });
});

// ── T9 — Wallet is a tab, and Pay is one page ───────────────────────────────
//
// Wallet has been in and out of Pay three times. The Pay section row (QR ·
// Wallet) is deleted, not emptied: a one-pill row that switches nothing is
// chrome pretending to be a control. A change that puts Wallet back inside
// Pay has to delete these lines to do it, which is the review moment.
describe("T9 — Wallet is its own tab, and Pay has no section row", () => {
  it("the Pay section row is gone from the codebase", () => {
    expect(
      existsSync(
        join(
          __dirname,
          "..",
          "..",
          "components",
          "consumer",
          "pay",
          "PaySectionNav.tsx",
        ),
      ),
    ).toBe(false);
    const layout = readFileSync(
      join(SHELL, "(visit)", "new-visit", "layout.tsx"),
      "utf8",
    );
    expect(layout).not.toMatch(/<\w+SectionNav\b/);
  });

  it("Wallet's pages live under /wallet, outside Visit's rail", () => {
    for (const rel of [
      [],
      ["buy"],
      ["gift"],
      ["redeem"],
      ["balance", "[id]"],
    ]) {
      expect(
        existsSync(join(SHELL, "wallet", ...rel, "page.tsx")),
        rel.join("/"),
      ).toBe(true);
    }
    expect(existsSync(join(SHELL, "(visit)", "new-visit", "wallet"))).toBe(
      false,
    );
  });

  // The layout's force-dynamic is what covers the four children; a page's own
  // declaration never reaches below it (found the hard way on 2026-09-05).
  it("Wallet's layout forces the whole tab dynamic", () => {
    const layout = readFileSync(join(SHELL, "wallet", "layout.tsx"), "utf8");
    expect(layout).toContain('export const dynamic = "force-dynamic"');
  });
});
