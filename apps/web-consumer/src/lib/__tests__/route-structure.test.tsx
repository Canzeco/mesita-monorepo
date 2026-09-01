import { readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { isModalContractPath } from "@/lib/consumer-route-contract";
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
      expect(hops, `redirect chain too long from ${source}`).toBeLessThanOrEqual(2);
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
    ["/home/swipe", "Home"],
    ["/home/catalog", "Home"],
    ["/home/favorites", "Home"],
    ["/place/abc", "Home"],
    ["/search", "Search"],
    ["/new-visit", "Pay"],
    // THE requirement from the routing v2 design review: the visit detail
    // lights INBOX, not the centre tab, because that is where the list lives.
    // It lit the centre tab before only by nesting under /rewards; the rename
    // severed that nesting and this row is what holds the replacement.
    ["/visit/t1", "Inbox"],
    ["/inbox/credits", "Inbox"],
    ["/inbox/visits", "Inbox"],
    ["/inbox/reservations", "Inbox"],
    ["/reservation/r1", "Inbox"],
    ["/me", "Me"],
  ];

  it.each(MATRIX)("%s lights exactly %s", async (path, expected) => {
    const lit = await activeTabFor(path);
    expect(lit).toEqual([expected]);
  });

  // Non-overlap is currently naming luck (/rewards vs /reservation share no
  // prefix). Pin it so a future rename that creates an overlap fails here.
  // /new-visit vs /visit is a genuine prefix hazard: "/visit".startsWith is
  // false for "/new-visit", but a careless future rename could make the centre
  // tab swallow its own detail route. Pin the cardinality.
  it("never lights two tabs at once", async () => {
    for (const [path] of MATRIX) {
      expect((await activeTabFor(path)).length, path).toBe(1);
    }
  });
});

// MESITA-1119 — a mockup showed a sixth "Agents" tab and "Me · {class}".
// Product Rules §C (later, Pato-owned): five tabs, plain labels; class is
// status on /me, never chrome; Inbox is not named for a mechanism.
describe("MESITA-1119 — chrome matches Product Rules §C, not the mockup", () => {
  async function tabLabels(): Promise<string[]> {
    vi.resetModules();
    vi.doMock("next/navigation", () => ({
      usePathname: () => "/home/swipe",
      useRouter: () => ({ push: () => {}, back: () => {} }),
    }));
    const { BottomNav } = await import("@/components/consumer/BottomNav");
    const html = renderToStaticMarkup(<BottomNav />);
    return [...html.matchAll(/text-center">([^<]+)</g)].map((m) => m[1]);
  }

  it("is exactly Home · Search · Pay · Inbox · Me", async () => {
    expect(await tabLabels()).toEqual([
      "Home",
      "Search",
      "Pay",
      "Inbox",
      "Me",
    ]);
  });

  it("does not stamp class into Me and does not add an Agents tab", async () => {
    const labels = await tabLabels();
    expect(labels.some((l) => l.includes("·"))).toBe(false);
    expect(labels).not.toContain("Agents");
    expect(labels).not.toContain("Agent");
  });
});

// ── T6 — the Inbox pill row is what the guest sees ──────────────────────────
//
// consumer-route-contract.test.ts pins the ORDER OF THE CONTRACT's keys and
// calls it the product decision. It isn't, quite: nothing iterates
// CONSUMER_ROUTES.inbox at runtime — every consumer reads a named key — so
// that object's key order has no effect on anything a guest experiences. The
// order they actually see is InboxSectionNav.SECTIONS, a separate hand-listed
// array, and mobile keeps a third copy.
//
// So the contract pin would stay green with Credits first in the object and
// Credits third on screen. This is the test that would go red.
describe("T6 — the Inbox section row renders as specified", () => {
  async function renderNav(pathname: string): Promise<string> {
    vi.resetModules();
    vi.doMock("next/navigation", () => ({
      usePathname: () => pathname,
      useRouter: () => ({ push: () => {}, back: () => {} }),
    }));
    const { InboxSectionNav } = await import(
      "@/components/consumer/inbox/InboxSectionNav"
    );
    return renderToStaticMarkup(<InboxSectionNav />);
  }

  /** Pill labels in render order. */
  function labels(html: string): string[] {
    return [...html.matchAll(/<span>([^<]+)<\/span>/g)].map((m) => m[1]);
  }

  it("is exactly Credits · Visits · Orders · Bookings · Alerts, in that order", async () => {
    expect(labels(await renderNav("/inbox/visits"))).toEqual([
      "Credits",
      "Visits",
      "Orders",
      "Bookings",
      "Alerts",
    ]);
  });

  it("catches a dropped or added pill", async () => {
    expect(labels(await renderNav("/inbox/visits"))).toHaveLength(5);
  });

  // The failure this catches: a section whose href stops matching its own
  // pathname lights NOTHING, and the row silently loses its active state.
  // Same shape as T5, one level down.
  const ACTIVE: [string, string][] = [
    ["/inbox/credits", "Credits"],
    ["/inbox/visits", "Visits"],
    ["/inbox/orders", "Orders"],
    ["/inbox/reservations", "Bookings"],
    ["/inbox/notifications", "Alerts"],
  ];

  it.each(ACTIVE)("%s lights exactly %s", async (pathname, expected) => {
    const html = await renderNav(pathname);
    // The active pill is the only one carrying the solid primary fill.
    const lit = html
      .split("<a ")
      .slice(1)
      .filter((chunk) => chunk.includes("bg-primary"))
      .map((chunk) => chunk.match(/<span>([^<]+)</)?.[1] ?? "?");
    expect(lit).toEqual([expected]);
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
describe("T7 — legacy /credits still resolves after the move", () => {
  it("keeps /credits redirecting to the Inbox section", async () => {
    const redirects = await nextConfig.redirects!();
    const entry = redirects.find((r) => r.source === "/credits");
    expect(entry, "/credits redirect was removed").toBeDefined();
    expect(entry!.destination).toBe("/inbox/credits");
  });
});
