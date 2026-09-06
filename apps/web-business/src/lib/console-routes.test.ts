// The 2am-Friday test: every href the console can emit maps to a real
// route file on disk, so a rename can never ship a dead nav link.
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  SHELL_ROUTES,
  placeHref,
  placeIdFromPathname,
  withOrg,
} from "./console-routes";
import { PLACE_TABS, placeTabHref } from "./place-view";

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

describe("the five screens Pato specified", () => {
  it("SHELL_ROUTES is the four that need no id", () => {
    expect(Object.keys(SHELL_ROUTES)).toEqual([
      "account",
      "organization",
      "places",
      "pool",
    ]);
  });
  it("Place is the fifth, and the shell owns it", () => {
    expect(placeHref("p-x")).toBe("/places/p-x");
    expect(existsSync(path.join(SHELL_DIR, "places", "[id]", "page.tsx"))).toBe(
      true,
    );
  });
  it("encodes the id, so a slash in one cannot forge a route", () => {
    expect(placeHref("a/b")).toBe("/places/a%2Fb");
  });
});

describe("placeIdFromPathname — the nav's Org Places / Place split", () => {
  it("reads the id back out of a Place pathname", () => {
    expect(placeIdFromPathname(placeHref("p-x"))).toBe("p-x");
    expect(placeIdFromPathname("/places/p-x/")).toBe("p-x");
    expect(placeIdFromPathname(placeHref("a/b"))).toBe("a/b");
  });
  it("is null on the list itself, which is a different screen", () => {
    expect(placeIdFromPathname("/places")).toBeNull();
    expect(placeIdFromPathname("/places/")).toBeNull();
  });
  // Iterate the REAL tab set, not a hardcoded list. The previous version
  // named partnership/performance/settings — tabs #1508 replaced — and passed
  // vacuously, because the regex accepts any single segment.
  it("survives every real tab segment (MESITA-1537)", () => {
    for (const tab of PLACE_TABS) {
      expect(placeIdFromPathname(placeTabHref("p-x", tab))).toBe("p-x");
    }
  });
  it("is still null two segments deep", () => {
    expect(placeIdFromPathname("/places/p-x/profile/basics")).toBeNull();
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
