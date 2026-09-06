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
    expect(shouldGate(SHELL_ROUTES.places)).toBe(true);
    expect(shouldGate(SHELL_ROUTES.pool)).toBe(true);
    expect(shouldGate(SHELL_ROUTES.account)).toBe(true);
    expect(shouldGate("/place/abc")).toBe(true);
    // Place — the fifth screen. It reads one org's holdings, so it sits
    // behind the same wall the list does.
    expect(shouldGate("/places/abc")).toBe(true);
  });
  it("does not gate routes that no longer exist", () => {
    expect(shouldGate("/central")).toBe(false);
    expect(shouldGate("/onboard")).toBe(false);
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

describe("client components never import the server data layer", () => {
  it('no "use client" file under components/console imports lib/supabase', () => {
    const root = path.resolve(__dirname, "..", "components", "console");
    const offenders: string[] = [];
    for (const file of walk(root)) {
      const src = readFileSync(file, "utf8");
      if (!src.startsWith('"use client"')) continue;
      if (/from\s+["']@\/lib\/supabase/.test(src)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
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
