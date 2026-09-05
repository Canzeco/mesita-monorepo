// The 2am-Friday test: every href the shell can emit maps to a real route
// file on disk, so a rename can never ship a dead nav link.
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { placePath, SHELL_ROUTES, withOrg } from "./console-routes";

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

describe("placePath maps to a route file", () => {
  it("place detail page exists", () => {
    expect(placePath("p-x")).toBe("/places/p-x");
    expect(existsSync(path.join(SHELL_DIR, "places", "[id]", "page.tsx"))).toBe(
      true,
    );
  });
});

describe("withOrg", () => {
  it("keeps default-org URLs clean", () => {
    expect(withOrg("/places", "grupo-ruiz")).toBe("/places");
    expect(withOrg("/places", null)).toBe("/places");
  });
  it("appends the switch for the other org", () => {
    expect(withOrg("/places", "nuevo")).toBe("/places?org=nuevo");
    expect(withOrg("/x?a=1", "nuevo")).toBe("/x?a=1&org=nuevo");
  });
});
