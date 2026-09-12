// Two contracts the console depends on.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SHELL_ROUTES } from "./console-routes";
import { SIGNED_IN_BOUNCE, shouldGate } from "./supabase/middleware";
import { canClaim, canRelease, resolveActiveOrg } from "./active-organization";
import type { Organization } from "./api/organizations";

describe("middleware contract", () => {
  it("does not bounce signed-in visitors off /", () => {
    expect(SIGNED_IN_BOUNCE.has("/")).toBe(false);
  });
  it("bounces signed-in visitors off the auth surface", () => {
    expect(SIGNED_IN_BOUNCE.has("/signin")).toBe(true);
  });
  it("gates every console screen that reads real data", () => {
    // Organization is in this list for the first time (MESITA-1727). While its
    // address was `/` it could not be: these are PREFIX matches, so listing `/`
    // would have gated the whole app, /signin included. The screen reads the
    // Stripe account, the members, so it belongs here.
    expect(shouldGate(SHELL_ROUTES.organization)).toBe(true);
    expect(shouldGate(SHELL_ROUTES.organizationNew)).toBe(true);
    expect(shouldGate(SHELL_ROUTES.places)).toBe(true);
    expect(shouldGate(SHELL_ROUTES.account)).toBe(true);
    // Place — the fourth screen. It reads one org's holdings, so it sits
    // behind the same wall the list does.
    expect(shouldGate("/places/abc")).toBe(true);
  });
  it("leaves the root ungated — it renders nothing to protect", () => {
    // `/` forwards to the Organization screen and reads no data of its own.
    // Gating it would bounce a signed-out visitor through sign-in only to
    // reach a redirect. Its destination carries the wall, and so does
    // (shell)/layout.tsx, which is the real boundary either way.
    expect(shouldGate("/")).toBe(false);
  });
  it("does not gate routes that no longer exist", () => {
    expect(shouldGate("/central")).toBe(false);
    expect(shouldGate("/onboard")).toBe(false);
    // MESITA-1564 deleted the legacy console. next.config.ts redirects these
    // before the proxy sees them, so gating them would guard a dead path.
    expect(shouldGate("/place/abc")).toBe(false);
    expect(shouldGate("/settings")).toBe(false);
    // MESITA-1614 merged the two lists; /pool is a redirect now, resolved
    // before the proxy sees it, so gating it would guard a dead path.
    expect(shouldGate("/pool")).toBe(false);
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

const org = (id: string, myRole: Organization["myRole"]): Organization => ({
  id,
  name: id,
  legalName: null,
  rfc: null,
  currency: "MXN",
  myRole,
  placeCount: 0,
  places: [],
});

describe("resolveActiveOrg", () => {
  const orgs = [org("a", "owner"), org("b", "editor")];
  it("honours ?org= when you belong to it", () => {
    expect(resolveActiveOrg(orgs, "b")?.id).toBe("b");
  });
  it("falls back to the first when ?org= is absent", () => {
    expect(resolveActiveOrg(orgs, undefined)?.id).toBe("a");
  });
  it("falls back rather than erroring on a foreign or stale id", () => {
    // Never leak whether an id exists: an org you are not in resolves
    // exactly like one that does not exist at all.
    expect(resolveActiveOrg(orgs, "someone-elses-org")?.id).toBe("a");
  });
  it("is null when you belong to none", () => {
    expect(resolveActiveOrg([], "a")).toBeNull();
  });
});

describe("action permissions mirror the EF guards", () => {
  it("claim: owner and editor, never viewer", () => {
    expect(canClaim("owner")).toBe(true);
    expect(canClaim("editor")).toBe(true);
    expect(canClaim("viewer")).toBe(false);
  });
  it("release: owner only — an editor could otherwise re-claim elsewhere", () => {
    expect(canRelease("owner")).toBe(true);
    expect(canRelease("editor")).toBe(false);
    expect(canRelease("viewer")).toBe(false);
  });
});
