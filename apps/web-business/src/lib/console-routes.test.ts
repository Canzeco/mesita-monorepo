// The 2am-Friday test: every href the console can emit maps to a real
// route file on disk, so a rename can never ship a dead nav link.
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SHELL_ROUTES, withOrg } from "./console-routes";
import { placePath } from "./business-route-contract";

const SHELL_DIR = path.resolve(__dirname, "..", "app", "(shell)");

function routeFile(href: string): string {
  const segments = href === "/" ? [] : href.slice(1).split("/");
  return path.join(SHELL_DIR, ...segments, "page.tsx");
}

describe("SHELL_ROUTES map to route files", () => {
  for (const [name, href] of Object.entries(SHELL_ROUTES)) {
    it(`${name} → ${href}`, () => {
      expect(existsSync(routeFile(href))).toBe(true);
    });
  }
});

describe("the four screens Pato specified", () => {
  it("is exactly Account, Organization, Org Places, Public Places", () => {
    expect(Object.keys(SHELL_ROUTES)).toEqual([
      "account",
      "organization",
      "places",
      "pool",
    ]);
  });
});

describe("place detail lives in the real console, not the shell", () => {
  it("placePath targets the (console) route tree", () => {
    expect(placePath("p-x")).toBe("/place/p-x/place/preview");
    expect(
      existsSync(
        path.resolve(
          __dirname,
          "..",
          "app",
          "(console)",
          "place",
          "[id]",
          "place",
          "[tab]",
          "page.tsx",
        ),
      ),
    ).toBe(true);
  });
  it("the shell owns no per-place route", () => {
    expect(existsSync(path.join(SHELL_DIR, "places", "[id]"))).toBe(false);
  });
});

describe("withOrg", () => {
  it("is a no-op without an organization", () => {
    expect(withOrg("/places", null)).toBe("/places");
  });
  it("carries the organization through", () => {
    expect(withOrg("/places", "org-1")).toBe("/places?org=org-1");
    expect(withOrg("/pool?q=taco", "org-1")).toBe("/pool?q=taco&org=org-1");
  });
  it("encodes the id", () => {
    expect(withOrg("/places", "a b")).toBe("/places?org=a%20b");
  });
});
