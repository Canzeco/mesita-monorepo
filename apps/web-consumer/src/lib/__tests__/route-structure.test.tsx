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
    // claim still happens behind the wall, at newVisit.walletRedeem.
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
    // Home's modes (MESITA-1609 — was "Discover" before Search split out).
    // Feed is here because it is the newest (MESITA-1621) and a mode added to
    // the rail but missed in BottomNav's matchPrefixes renders with NO tab
    // lit — nothing else catches that.
    ["/discover/feed", "Home"],
    ["/discover/chat", "Home"],
    ["/discover/scroll", "Home"],
    ["/discover/feed", "Home"],
    ["/discover/favs", "Home"],
    // /place rode the Home entry until the hub was retired (2026-09-01) and
    // has no other consumer. If it is ever dropped from Home's
    // matchPrefixes, place detail lights NOTHING and this row is what says so.
    ["/place/abc", "Home"],

    // Search is its own tab AND its own route now (MESITA-1609, MESITA-1616)
    // — the same screen, promoted out of Home's mode rail and out from under
    // discover/layout.tsx.
    ["/search", "Search"],

    ["/new-visit", "Pay"],
    // Wallet is Pay's SECOND SECTION (MESITA-1581), so it lights Pay by
    // nesting — no prefix of its own. /inbox/credits and /wallet are redirect
    // SOURCES, never rendered, so neither belongs in this matrix.
    ["/new-visit/wallet", "Pay"],
    // Wallet's four children are full-screen ROUTES as of 2026-09-08, not
    // sheets. They light Pay by the same nesting, and the tab bar stays under
    // them: (shell)/layout.tsx's law is that every shell route keeps it. What
    // a full-screen wallet view drops is the SECTION row, not the tab bar —
    // PaySectionNav returns null off the two section roots.
    ["/new-visit/wallet/buy", "Pay"],
    ["/new-visit/wallet/gift", "Pay"],
    ["/new-visit/wallet/redeem", "Pay"],
    ["/new-visit/wallet/balance/bal_1", "Pay"],

    // Activity retired as a bottom tab (MESITA-1609) and then as a container
    // (MESITA-1626) — its sections are sheets on Me, and a sheet has no path
    // to light anything with. The DETAIL routes are what still has to nest
    // under Me: a visit or reservation detail that stops matching Me's
    // matchPrefixes lights NOTHING, and this is what would catch it.
    ["/visit/t1", "Me"],
    ["/reservation/r1", "Me"],
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

// MESITA-1609 — Home and Search split back apart, and Activity retires as a
// tab (its sections move to Me). This directly REVERSES the guard
// MESITA-1119 wrote below: that guard existed because a rejected mockup
// tried to add an Agents tab and a class-suffixed Me label alongside a
// Home/Search restoration nobody had reasoned through. This change is not
// that mockup — it is a reviewed, reasoned IA change (design + eng review,
// this same session), and the two tests MESITA-1119 actually cared about
// (no class stamped into Me, no Agents tab) are UNCHANGED below. Only the
// tab count and the specific "no Home or Search" assertion — the part of
// that guard this PR deliberately overturns — are rewritten.
describe("MESITA-1609 — Home/Search split, Activity retires as a tab", () => {
  async function tabLabels(): Promise<string[]> {
    vi.resetModules();
    vi.doMock("next/navigation", () => ({
      usePathname: () => "/search",
      useRouter: () => ({ push: () => {}, back: () => {} }),
    }));
    const { BottomNav } = await import("@/components/consumer/BottomNav");
    const html = renderToStaticMarkup(<BottomNav />);
    return [...html.matchAll(/text-center">([^<]+)</g)].map((m) => m[1]);
  }

  it("is exactly Home · Search · Pay · Me", async () => {
    expect(await tabLabels()).toEqual(["Home", "Search", "Pay", "Me"]);
  });

  // The MESITA-1119 guard this replaces asserted `.not.toContain("Home")` and
  // `.not.toContain("Search")` — the literal opposite of this row. That guard
  // is not being silently bypassed: it is being deliberately overturned, with
  // review, and this test is the record of that. A regression back to FIVE
  // tabs (Home, Search AND Discover all at once, say) would still be caught —
  // the count assertion above pins exactly four.
  it("has Home and Search back, on purpose (MESITA-1609)", async () => {
    const labels = await tabLabels();
    expect(labels).toContain("Home");
    expect(labels).toContain("Search");
    expect(labels).not.toContain("Discover");
  });

  // Unaffected by this PR — Docs › Apps §A still holds, MESITA-1119's other
  // finding (a class-suffixed Me label, an Agents tab) is not what this PR
  // touches.
  it("does not stamp class into Me and does not add an Agents tab", async () => {
    const labels = await tabLabels();
    expect(labels.some((l) => l.includes("·"))).toBe(false);
    expect(labels).not.toContain("Agents");
    expect(labels).not.toContain("Agent");
  });
});

// ── T5b — Home's mode rail ──────────────────────────────────────────────────
// Same job T6 does for the Inbox row, one level down. A rail whose href stops
// matching its own pathname lights NOTHING, and neither tsc nor the build nor
// any other test notices — the row just quietly loses its selected state.
//
// It also pins ORDER and COUNT. Search left this rail for its own tab
// (MESITA-1609) and then its own route (MESITA-1616); Feed joined at
// MESITA-1621. MESITA-1697 cut it to FOUR — Swipe became Scroll (same deck,
// vertical) and Catalog's body moved under Feed's name, so the two words that
// left are a rename and a merge rather than two deletions. The order is the
// input-cost ladder DiscoverModeNav documents: zero input, structured,
// freeform, recall.
describe("T5b — Home's mode rail", () => {
  it("is exactly Scroll · Feed · Chat · Favs", async () => {
    const { MODES } = await import(
      "@/components/consumer/discover/DiscoverModeNav"
    );
    expect(MODES.map((m) => m.label)).toEqual([
      "Scroll",
      "Feed",
      "Chat",
      "Favs",
    ]);
  });

  // The width budget, as an assertion rather than a comment. `auto-cols-fr`
  // sizes every column to the WIDEST pill, so the track is N x widest plus
  // (N-1) x 4px of gaps and it has to fit 359px (375 frame less px-2). Chrome
  // 26px: a 14px icon, gap-1, and px-1 either side.
  //
  // THIS IS THE ASSERTION THAT JUST DID ITS JOB. It was written when Search
  // left the rail, explicitly so "a FUTURE addition re-tightens it and gets
  // caught here first" — Feed is that addition (MESITA-1621), and at five
  // columns the budget lands at 347.5 of 359px. ~11px of margin: a SIXTH mode
  // does not fit (6 x 66.3 + 20 = 417.8), and neither does any label wider
  // than "Catalog". Do not add either without shortening a label first.
  //
  // MEASURED AT 11px (`type-label`). Feed's 25.4 is the conservative top of
  // its band rather than a fresh measurement in these units — in Inter 600 at
  // 11px it sits between Favs and Chat, and it is entered just above the
  // wider of the two so the error can only over-reserve. Catalog is the
  // widest by 15px, so nothing here turns on Feed's exact number.
  it("keeps every label inside the 359px track", async () => {
    const { MODES } = await import(
      "@/components/consumer/discover/DiscoverModeNav"
    );
    const navSrc = readFileSync(
      join(
        __dirname,
        "..",
        "..",
        "components/consumer/discover/DiscoverModeNav.tsx",
      ),
      "utf8",
    );
    // Match the `base` class string itself, not the word anywhere in the file
    // — both sizes are NAMED in that file's comment explaining the swap.
    //
    // 12px IS THE SIZE AGAIN (MESITA-1697). `type-label` (11px) was adopted
    // only because Catalog at 40.3px made five columns overflow, and Catalog's
    // label is gone. At four columns `auto-cols-fr` hands each pill ~87px for
    // ~53px of content, and an 11px label floating in that reads as an
    // unfinished render.
    expect(navSrc).toContain('"text-xs flex items-center');
    expect(navSrc).not.toContain('"type-label flex items-center');
    // Advance widths at Inter 600. The four live labels are measured at 12px;
    // the retired ones stay as the 11px figures the rail was budgeted with, so
    // the reasoning survives its own rename.
    const TEXT_PX: Record<string, number> = {
      Scroll: 32.7,
      Feed: 27.7,
      Chat: 26.7,
      Favs: 27.4,
    };
    // Chrome per pill: 16px icon + 4px gap-1 + 8px px-1 = 28 (the icon grew
    // with the type). Gaps between N columns = N-1, not N — the five-column
    // version of this line said `+ 16` for four gaps.
    const widest = Math.max(
      ...MODES.map((m) => {
        const text = TEXT_PX[m.label];
        expect(text, `unmeasured label "${m.label}" — measure it at 375px`).
          toBeTypeOf("number");
        return text + 28;
      }),
    );
    expect(widest * MODES.length + (MODES.length - 1) * 4).toBeLessThanOrEqual(
      359,
    );
  });

  it("has no parked modes — all four are real destinations", async () => {
    const { MODES } = await import(
      "@/components/consumer/discover/DiscoverModeNav"
    );
    // Scroll, Feed, Chat and Favs are all live (MESITA-1697). A `soon` flag
    // reappearing means a mode shipped unfinished;
    // that is allowed, but it should be a deliberate edit to this assertion
    // rather than a silent regression.
    expect(MODES.filter((m) => m.soon)).toEqual([]);
  });

  // Search has its own route now (MESITA-1616), fully out of the
  // discoverTabs namespace — so this rail's routes and the contract's
  // discoverTabs are an EXACT match again, the simple form this test held
  // before Search ever needed a "deliberately excluded" carve-out.
  it("every mode href is a real /discover route in the contract, one each", async () => {
    const { MODES } = await import(
      "@/components/consumer/discover/DiscoverModeNav"
    );
    const contract = Object.values(CONSUMER_ROUTES.discoverTabs);
    for (const m of MODES) {
      expect(contract, m.label).toContain(m.href);
    }
    expect(MODES).toHaveLength(contract.length);
  });

  // DEFAULT IS BACK ON THE LEADING PILL (MESITA-1609/1615), reversing the
  // "default is not first" guard this row held from 2026-09-01 through
  // MESITA-1609. That guard existed because Search — buried behind Catalog's
  // width win — was the urgent mode nobody landed on by looking; once Search
  // left the rail entirely, there was no more urgent mode among the
  // remaining four to bury, so first-pill-is-default stopped being a trap.
  // Scroll leading now (MESITA-1697; Swipe held it from MESITA-1615) doesn't
  // reopen that — it just carries the same property to a different mode. See
  // consumer-route-contract.ts's discoverDefault comment for the full
  // reasoning. Do NOT re-derive this from Activity's still-live
  // Alerts-leads/Visits-lands split (inboxDefault) — the two rows no longer
  // share a justification.
  it("lands Home on Scroll — its own leading pill", async () => {
    const { MODES } = await import(
      "@/components/consumer/discover/DiscoverModeNav"
    );
    expect(CONSUMER_ROUTES.discoverDefault).toBe(
      CONSUMER_ROUTES.discoverTabs.scroll,
    );
    expect(MODES[0].href).toBe(CONSUMER_ROUTES.discoverDefault);
    expect(MODES[0].label).toBe("Scroll");
    // The guard that makes "the first tab lands on nothing" impossible to
    // reintroduce: whatever the default points at must be a LIVE mode.
    const landed = MODES.find(
      (m) => m.href === CONSUMER_ROUTES.discoverDefault,
    );
    expect(landed?.soon ?? false).toBe(false);
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
describe("T6 — Activity's three sections are sheets on Me", () => {
  const ME = readFileSync(
    join(SHELL, "me", "ProfileClient.tsx"),
    "utf8",
  );

  it("renders one sheet per box: Alerts · Visits · Bookings", () => {
    const rendered = [
      ...ME.matchAll(/<(AlertsModal|VisitsModal|BookingsModal)\b/g),
    ].map((m) => m[1]);
    expect(rendered).toEqual(["AlertsModal", "VisitsModal", "BookingsModal"]);
  });

  it("no box routes into a container any more", () => {
    // The three boxes used to `router.push` into /inbox/*. If one comes back,
    // the guest leaves Me for a page whose section nav no longer exists.
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

  it("renders sixteen cells as eight pairs, no tail", () => {
    // Eight pairs, no four-up and no tail (MESITA-1639). MESITA-1636 broke the
    // rhythm with a four-up so the column would not read as undifferentiated,
    // and paid for it in the only four cells on the page with no summary. The
    // passport leads by being a different OBJECT — a document with a photo,
    // twice the height of a cell — not by the pairs below it varying.
    //
    // PROFILE LEADS ITS PAIR (Pato, 2026-09-08), reversing MESITA-1648: the
    // header states the identity, so the first cell is the one that edits it.
    //
    // INSTAGRAM AND CLASS ARE CELLS AGAIN (Pato, 2026-09-08). They were cells
    // (MESITA-1650), then header chips only (MESITA-1652) on the argument
    // that a chip is 1 tap from anywhere while a cell must be scrolled to.
    // The chips STAY, so this pair is a third path alongside them and the
    // PassportModal rows — deliberate duplication, re-drawn by Pato after
    // seeing the shipped screen.
    //
    // Still absent, each for its own reason: Metrics and Contact moved into
    // Settings; Cards is the same `CardsModal` Pay's Wallet already opens,
    // and Wallet is a cell right here.
    expect(gridTitles(ME)).toEqual([
      "Profile",
      "Passport",
      "Instagram",
      "Class",
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

  it("every row is a pair, and the last is a deliberate full-width cell", () => {
    // Eight `DestGrid`s of two. Counting grids and spans SEPARATELY on
    // purpose: "cells ÷ grids === 2" was true of the old four-up too, and
    // would go on being true of any row width. Eight again now that the
    // Instagram/Class pair is back as cells beside the header chips.
    expect([...ME.matchAll(/<DestGrid>/g)]).toHaveLength(8);
    // About was the only spanning cell and it folded into Help (MESITA-1650),
    // so every row is now a pair and nothing spans.
    expect([...ME.matchAll(/^\s*full$/gm)]).toHaveLength(0);
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
    const src = readFileSync(
      join(SHELL, "me", "profile-sections.tsx"),
      "utf8",
    );
    // MESITA-1633's rule, now structural rather than a convention: there is
    // no `compact` prop and no `cols` prop, so there is no second layout for
    // a cell or a row to be rendered in.
    expect(src).not.toMatch(/compact\??:/);
    expect(src).not.toMatch(/cols\??:/);
    expect(src).not.toContain("grid-cols-4");
  });

  it("no Cards cell — Wallet already opens that exact sheet", () => {
    // `new-visit/wallet/CreditsClient` imports the SAME CardsModal, and
    // Wallet is a cell here whose summary is already "Credits and cards".
    // The modal STAYS mounted on Me though: `/me?cards=` is Stripe's return.
    expect(gridTitles(ME)).not.toContain("Cards");
    expect(ME).toContain("<CardsModal");
  });

  it("the More drawer is gone from the codebase", () => {
    // It held exactly Gift and Share; with both on the page it held nothing,
    // and an empty drawer is worse than none.
    expect(ME).not.toContain("MoreModal");
    expect(
      existsSync(
        join(__dirname, "..", "..", "components", "consumer", "me", "MoreModal.tsx"),
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
        join(__dirname, "..", "..", "components", "consumer", "me", "SettingsModal.tsx"),
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
    // the cheapest way to green it would be deleting the rationale — the
    // failure mode passport-axes.test.ts documents at length.
    const help = readFileSync(
      join(__dirname, "..", "..", "components", "consumer", "me", "HelpModal.tsx"),
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
  // Wallet has now moved three times and come back: standalone /credits
  // (#1429) -> Activity section (/inbox/credits) -> Pay section
  // (/new-visit/wallet, 2026-09-01) -> its own tab (/wallet, 09-05) -> Pay
  // section again (09-06). ALL THREE old urls were live in production, so all
  // three sets of bookmarks are real.
  //
  // EACH RESOLVES IN ONE HOP, and that is why this asserts the destination
  // rather than just the entry: pointing /credits at /inbox/credits, or
  // /wallet at /inbox/credits, would still be a working redirect and would
  // still be the 3-hop chain T4 refuses. T4 can validate a destination but
  // never a redirect's ABSENCE, which is why this test exists alongside it.
  it.each([
    // Both landed on the Reservations SECTION until MESITA-1626 dissolved the
    // container; Bookings is a sheet on Me now, so Me is where they go.
    ["/saved", "/me"],
    ["/saved/reservations", "/me"],
    ["/saved/reservation/:id", "/reservation/:id"],
    ["/saved/place/:id", "/place/:id"],
  ])("keeps the Saved-era redirect %s → %s (MESITA-1585)", async (source, destination) => {
    const redirects = await nextConfig.redirects!();
    const entry = redirects.find((r) => r.source === source);
    expect(entry, `${source} redirect was removed`).toBeDefined();
    expect(entry!.destination).toBe(destination);
  });

  it.each(["/credits", "/inbox/credits", "/wallet"])(
    "keeps %s redirecting straight to Pay > Wallet",
    async (source) => {
      const redirects = await nextConfig.redirects!();
      const entry = redirects.find((r) => r.source === source);
      expect(entry, `${source} redirect was removed`).toBeDefined();
      expect(entry!.destination).toBe("/new-visit/wallet");
    },
  );
});

// ── T8 — the Pay pill row is what the guest sees ────────────────────────────
//
// Same argument as T6, one tab over: CONSUMER_ROUTES.newVisit's key order is
// inert (every consumer reads a named key), and what a guest sees is
// PaySectionNav.SECTIONS. Wallet has now been in and out of this row inside a
// week, so the row that renders is the thing worth pinning — a change that
// promotes it back to a tab has to delete this test to do it, which is exactly
// the review moment that was missing on 2026-09-05.
describe("T8 — the Pay section row renders as specified", () => {
  async function renderNav(pathname: string): Promise<string> {
    vi.resetModules();
    vi.doMock("next/navigation", () => ({
      usePathname: () => pathname,
    }));
    const { PaySectionNav } = await import(
      "@/components/consumer/pay/PaySectionNav"
    );
    return renderToStaticMarkup(<PaySectionNav />);
  }

  /** Pill labels in render order. */
  function labels(html: string): string[] {
    return [...html.matchAll(/<span>([^<]+)<\/span>/g)].map((m) => m[1]);
  }

  it("is exactly QR · Wallet, in that order", async () => {
    expect(labels(await renderNav(CONSUMER_ROUTES.newVisit.new))).toEqual([
      "QR",
      "Wallet",
    ]);
  });

  // The failure this catches: /new-visit is a PREFIX of /new-visit/wallet, so
  // a startsWith match here lights QR on both pages. PaySectionNav compares
  // exactly, and this is what proves it still does.
  const ACTIVE: [string, string][] = [
    ["/new-visit", "QR"],
    ["/new-visit/wallet", "Wallet"],
  ];

  it.each(ACTIVE)("%s lights exactly %s", async (pathname, expected) => {
    const html = await renderNav(pathname);
    const lit = html
      .split("<a ")
      .slice(1)
      .filter((chunk) => chunk.includes("bg-primary"))
      .map((chunk) => chunk.match(/<span>([^<]+)</)?.[1] ?? "?");
    expect(lit).toEqual([expected]);
  });

  // Wallet's four full-screen children inherit new-visit/layout.tsx, so the
  // section row would ride along above their own back-and-title header —
  // two rows of chrome disagreeing about where the guest is, and a lateral
  // exit out of a half-finished purchase. The failure this catches is a
  // future edit relaxing the membership test to a prefix match, which puts
  // the row back on all four without touching either of them.
  const SUBROUTES = [
    CONSUMER_ROUTES.newVisit.walletBuy,
    CONSUMER_ROUTES.newVisit.walletGift,
    CONSUMER_ROUTES.newVisit.walletRedeem,
    `${CONSUMER_ROUTES.newVisit.walletBalance.prefix}bal_1`,
  ];

  it.each(SUBROUTES)("does not render on %s", async (pathname) => {
    expect(await renderNav(pathname)).toBe("");
  });
});
