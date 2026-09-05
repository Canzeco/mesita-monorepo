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

describe("middleware contract (mock era)", () => {
  it("does not bounce signed-in visitors off /", () => {
    expect(SIGNED_IN_BOUNCE.has("/")).toBe(false);
  });
  it("keeps the old console protected", () => {
    expect(shouldGate("/central")).toBe(true);
    expect(shouldGate("/place/abc")).toBe(true);
    expect(shouldGate("/onboard")).toBe(true);
  });
  it("leaves every shell route outside the signed-out wall", () => {
    for (const href of Object.values(SHELL_ROUTES)) {
      expect(shouldGate(href)).toBe(false);
    }
    expect(shouldGate("/places/p-x/profile")).toBe(false);
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe("shell import ban", () => {
  const roots = [
    path.resolve(__dirname, "..", "app", "(shell)"),
    path.resolve(__dirname, "mock"),
    path.resolve(__dirname, "..", "components", "console"),
  ];
  it("never imports lib/supabase or lib/api", () => {
    const offenders: string[] = [];
    for (const root of roots) {
      for (const file of walk(root)) {
        const src = readFileSync(file, "utf8");
        if (/from\s+["']@\/lib\/(supabase|api)/.test(src)) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
