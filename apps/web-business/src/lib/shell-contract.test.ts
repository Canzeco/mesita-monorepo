// Two contracts the console depends on.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SHELL_ROUTES, placePageHref } from "./console-routes";
import { SIGNED_IN_BOUNCE, shouldGate } from "./supabase/middleware";
import { canRelease, canVerify, findPlace, pickPlace } from "./active-place";

describe("middleware contract", () => {
  it("does not bounce signed-in visitors off /", () => {
    expect(SIGNED_IN_BOUNCE.has("/")).toBe(false);
  });
  it("bounces signed-in visitors off the auth surface", () => {
    expect(SIGNED_IN_BOUNCE.has("/signin")).toBe(true);
  });
  it("gates every console screen that reads real data", () => {
    // Every page the console has sits under /places now (MESITA-1892) — the
    // place's own views, its four pages, the catalogue and the ceremony —
    // except Account, which is its own.
    expect(shouldGate(SHELL_ROUTES.places)).toBe(true);
    expect(shouldGate(SHELL_ROUTES.placesNew)).toBe(true);
    expect(shouldGate("/places/abc")).toBe(true);
    expect(shouldGate("/places/abc/activity")).toBe(true);
    expect(shouldGate(placePageHref("abc", "settings"))).toBe(true);
    expect(shouldGate(SHELL_ROUTES.account)).toBe(true);
  });
  it("leaves the root ungated — it renders nothing to protect", () => {
    // `/` resolves to a place and reads no data of its own that a visitor
    // could see. Gating it would bounce a signed-out
    // visitor through sign-in only to reach a redirect. Its destination
    // carries the wall, and so does (shell)/layout.tsx, which is the real
    // boundary either way.
    expect(shouldGate("/")).toBe(false);
  });
  it("does not gate routes that no longer exist", () => {
    expect(shouldGate("/central")).toBe(false);
    expect(shouldGate("/onboard")).toBe(false);
    // MESITA-1564 deleted the legacy console. next.config.ts redirects these
    // before the proxy sees them, so gating them would guard a dead path.
    expect(shouldGate("/place/abc")).toBe(false);
    expect(shouldGate("/settings")).toBe(false);
    expect(shouldGate("/pool")).toBe(false);
    // MESITA-1807 moved the organization into the path and MESITA-1892
    // deleted it; every one of these is a redirect now, resolved before the
    // proxy sees it.
    expect(shouldGate("/organization")).toBe(false);
    expect(shouldGate("/organization/new")).toBe(false);
    expect(shouldGate("/orgs/abc")).toBe(false);
    expect(shouldGate("/orgs/abc/settings")).toBe(false);
  });
});

// The console reaches Supabase only through lib/api and lib/supabase on the
// server. A client component importing them would ship a service path into
// the browser bundle; the (shell) client components must stay dumb.
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** Is this a client component?
 *
 *  NOT `startsWith('"use client"')` any more. Generated files carry a notice
 *  comment above the directive (scripts/sync-shared.ts, MESITA-1614), which is
 *  legal — comments may precede a directive — but a naive prefix test reads
 *  such a file as a SERVER component and silently stops guarding it. A guard
 *  that quietly skips its subject is worse than no guard. */
function isClientComponent(src: string): boolean {
  for (const line of src.split("\n")) {
    const t = line.trim();
    if (t === "" || t.startsWith("//")) continue;
    return t.startsWith('"use client"') || t.startsWith("'use client'");
  }
  return false;
}

describe("client components never import the server data layer", () => {
  it('no "use client" file under components/console imports lib/supabase', () => {
    const root = path.resolve(__dirname, "..", "components", "console");
    const offenders: string[] = [];
    for (const file of walk(root)) {
      const src = readFileSync(file, "utf8");
      if (!isClientComponent(src)) continue;
      if (/from\s+["']@\/lib\/supabase/.test(src)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("the rail's scope rule and the place vocabulary stay server-free", () => {
    // Both are imported by "use client" chrome; a server import in either
    // drags the data layer into the browser bundle graph.
    for (const rel of ["rail-scope.ts", "place-tabs.ts", "active-place.ts", "console-routes.ts"]) {
      const src = readFileSync(path.join(__dirname, rel), "utf8");
      expect(src, rel).not.toMatch(/from\s+["']@\/lib\/supabase/);
      expect(src, rel).not.toMatch(/from\s+["']@\/lib\/api\/_invoke/);
      expect(src, rel).not.toMatch(/from\s+["']next\/headers/);
    }
  });
});

// The 2am-Friday test.
//
// `business-web-get-overview` resolves a non-super-admin's places from
// `place_members` alone, so it cannot load an org-claimed place — that is
// the whole reason the shell has its own `business-web-get-place`. Anything
// that reaches back into `lib/api/places` (the overview's `MyPlace` type) or
// re-couples the live shell to the broken read. (The second rule below used
// to also forbid `components/business/place/**`; MESITA-1564 deleted that tree
// outright, so there is nothing left to forbid.)
//
// It walks BOTH roots and does NOT filter on "use client": the edge that
// actually matters is a SERVER component under app/(shell) importing the
// overview type, which the guard above cannot see from either direction.
const FORBIDDEN_IMPORTS: { pattern: RegExp; why: string }[] = [
  {
    pattern: /from\s+["']@\/lib\/api\/places["']/,
    why: "lib/api/places is the business-web-get-overview shape; the shell reads business-web-get-place",
  },
];

describe("the shell never re-couples to the overview EF", () => {
  it("no file under app/(shell) or components/console imports the forbidden modules", () => {
    const roots = [
      path.resolve(__dirname, "..", "app", "(shell)"),
      path.resolve(__dirname, "..", "components", "console"),
    ];
    const offenders: string[] = [];
    for (const root of roots) {
      for (const file of walk(root)) {
        if (!/\.tsx?$/.test(file)) continue;
        const src = readFileSync(file, "utf8");
        for (const { pattern, why } of FORBIDDEN_IMPORTS) {
          if (pattern.test(src)) {
            offenders.push(`${path.relative(root, file)} — ${why}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the walker actually reaches server components (guard on the guard)", () => {
    // The previous version of this rule filtered on `"use client"` and rooted
    // only at components/console, so it could never have failed. If this
    // count ever drops to zero the rule above has silently stopped looking.
    const shell = path.resolve(__dirname, "..", "app", "(shell)");
    const serverFiles = walk(shell).filter(
      (f) => /\.tsx$/.test(f) && !isClientComponent(readFileSync(f, "utf8")),
    );
    expect(serverFiles.length).toBeGreaterThan(0);
  });
});

const place = (id: string, myRole: "owner" | "editor" | "viewer") => ({
  id,
  myRole,
});

// NEVER AN ORACLE (MESITA-1807). The path names the place, and the place
// layout answers 404 for one the caller does not hold exactly as for one that
// does not exist. These pin the pure rules under it.
//
// ONE SUBJECT (MESITA-1892). `findOrg`, `preferredOrg` and `findHolder` were
// three functions about the layer above the place; the layer is gone, so the
// portfolio is a flat list and one lookup answers all three questions.
describe("the place rules", () => {
  const places = [place("a", "owner"), place("b", "editor")];

  it("findPlace answers a membership the caller actually has", () => {
    expect(findPlace(places, "b")?.id).toBe("b");
  });

  it("findPlace answers null for a foreign id AND for a nonexistent one", () => {
    // The same answer for both, or the path becomes a membership oracle.
    expect(findPlace(places, "someone-elses-place")).toBeNull();
    expect(findPlace(places, "")).toBeNull();
    expect(findPlace(places, null)).toBeNull();
    expect(findPlace([], "a")).toBeNull();
  });

  it("pickPlace is the remembered one when still held, else the first", () => {
    expect(pickPlace(places, "b")?.id).toBe("b");
    expect(pickPlace(places, "someone-elses-place")?.id).toBe("a");
    expect(pickPlace(places, null)?.id).toBe("a");
    expect(pickPlace([], "a")).toBeNull();
  });
});

describe("action permissions mirror the EF guards", () => {
  it("release: owner only — an editor could otherwise re-claim elsewhere", () => {
    expect(canRelease("owner")).toBe(true);
    expect(canRelease("editor")).toBe(false);
    expect(canRelease("viewer")).toBe(false);
    expect(canRelease(null)).toBe(false);
  });
  it("verify: owner only, matching business-web-verify-place's own guard", () => {
    expect(canVerify("owner")).toBe(true);
    expect(canVerify("editor")).toBe(false);
    expect(canVerify("viewer")).toBe(false);
    expect(canVerify(undefined)).toBe(false);
  });
  it("claim has NO predicate left, and that is the assertion (MESITA-1892)", async () => {
    // `canClaim` and `canAddPlace` asked what rank the caller held in the
    // ORGANIZATION the place was about to join. `claim_place(p_place_id,
    // p_claimer)` mints the caller's own owner row, so there is nothing to
    // hold first and a predicate answering `true` for everyone would be a
    // lock drawn on a door with no bolt in it.
    const mod = await import("./active-place");
    expect(Object.keys(mod)).not.toContain("canClaim");
    expect(Object.keys(mod)).not.toContain("canAddPlace");
  });
});
