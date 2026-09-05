// Two contracts the mock era depends on:
// 1. Middleware: `/` no longer bounces signed-in users (it hosts the shell)
//    and none of the shell routes sit behind the signed-out wall, while the
//    old console stays protected.
// 2. Import ban: nothing under (shell) or lib/mock touches lib/supabase or
//    lib/api — the mock layer is the only data door, so the future EF swap
//    is mechanical.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SHELL_ROUTES } from "./console-routes";
import { SIGNED_IN_BOUNCE, shouldGate } from "./supabase/middleware";

describe("middleware contract", () => {
  it("does not bounce signed-in visitors off /", () => {
    expect(SIGNED_IN_BOUNCE.has("/")).toBe(false);
  });
  it("bounces signed-in visitors off the auth surface", () => {
    expect(SIGNED_IN_BOUNCE.has("/signin")).toBe(true);
  });
  it("gates the catalog layer, which reads real data", () => {
    expect(shouldGate("/places")).toBe(true);
  });
  it("keeps the old console protected", () => {
    expect(shouldGate("/central")).toBe(true);
    expect(shouldGate("/place/abc")).toBe(true);
    expect(shouldGate("/onboard")).toBe(true);
  });
  it("leaves the still-mock shell routes open", () => {
    expect(shouldGate(SHELL_ROUTES.organization)).toBe(false);
    expect(shouldGate(SHELL_ROUTES.account)).toBe(false);
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

// The mock layer is still the only data door for the routes that have not
// been wired yet. /places reads the real catalog, so it is exempt BY NAME —
// keeping the ban narrow instead of deleting the guard.
describe("mock-route import ban", () => {
  const roots = [
    path.resolve(__dirname, "..", "app", "(shell)"),
    path.resolve(__dirname, "mock"),
    path.resolve(__dirname, "..", "components", "console"),
  ];
  const WIRED = [path.join("(shell)", "places", "page.tsx")];
  it("still-mock routes never import lib/supabase or lib/api", () => {
    const offenders: string[] = [];
    for (const root of roots) {
      for (const file of walk(root)) {
        if (WIRED.some((w) => file.endsWith(w))) continue;
        const src = readFileSync(file, "utf8");
        if (/from\s+["']@\/lib\/(supabase|api)/.test(src)) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});

// #1488 moved the auth surface off "/" (the mock Organization shell took
// it) and onto /signin. Any server-side redirect still pointing a
// signed-out visitor at "/" drops them on a mock page with no sign-in
// form and silently loses their ?next=.
describe("no route sends a signed-out visitor to the old auth surface", () => {
  it('has zero redirect("/") or redirect("/?next=...") calls', () => {
    const roots = [path.resolve(__dirname, "..", "app")];
    const offenders: string[] = [];
    for (const root of roots) {
      for (const file of walk(root)) {
        if (!file.endsWith(".tsx") && !file.endsWith(".ts")) continue;
        const src = readFileSync(file, "utf8");
        if (/redirect\(\s*[`"]\/(\?next=)?[`"]/.test(src)) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
