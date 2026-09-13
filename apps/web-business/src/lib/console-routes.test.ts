// The 2am-Friday test: every href the console can emit maps to a real
// route file on disk, so a rename can never ship a dead nav link.
//
// MESITA-1807: the organization is in the path. `?org=` is gone from every
// href, `withOrg` with it, and the old addresses forward from next.config.ts
// (asserted in legacy-redirects.test.ts).
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FLAT_ROUTES,
  ORG_PAGES,
  ORG_PAGE_LABEL,
  PLACES_OWNED,
  SHELL_ROUTES,
  flatViewFromPathname,
  isFlatRoute,
  orgHref,
  viewHref,
  orgIdFromPathname,
  orgPageFromPathname,
  orgPlacesHref,
  orgPlacesNewHref,
  ownedFromParam,
  placeHref,
  placeIdFromPathname,
  withQuery,
} from "./console-routes";
import { PLACE_TABS, placeTabHref } from "./place-tabs";

const SHELL_DIR = path.resolve(__dirname, "..", "app", "(shell)");

/** The route file a concrete href resolves to; ids become their segment.
 *  The five place views live in the `(place)` route group (MESITA-1832), so
 *  a flat view href resolves there. */
function routeFile(href: string, dynamic: Record<string, string> = {}): string {
  const segments = href === "/" ? [] : href.split("?")[0].slice(1).split("/");
  const direct = path.join(SHELL_DIR, ...segments.map((s) => dynamic[s] ?? s), "page.tsx");
  if (existsSync(direct)) return direct;
  return path.join(SHELL_DIR, "(place)", ...segments.map((s) => dynamic[s] ?? s), "page.tsx");
}

describe("SHELL_ROUTES are the addresses that need no id", () => {
  it("is root, the six pages, admin, and the create ceremony (MESITA-1832)", () => {
    expect(Object.keys(SHELL_ROUTES)).toEqual([
      "root",
      "account",
      "profile",
      "reviews",
      "payments",
      "activity",
      "settings",
      "admin",
      "orgNew",
    ]);
    expect(FLAT_ROUTES).toEqual(["/account", "/profile", "/reviews", "/payments", "/activity", "/settings", "/admin"]);
    for (const r of FLAT_ROUTES) expect(isFlatRoute(r)).toBe(true);
    expect(isFlatRoute("/orgs/x")).toBe(false);
    expect(isFlatRoute("/profile/")).toBe(false);
  });
  for (const [name, href] of Object.entries(SHELL_ROUTES)) {
    it(`${name} → ${href} is a route file with its own loading boundary`, () => {
      const file = routeFile(href);
      expect(existsSync(file), file).toBe(true);
      if (href !== "/") {
        expect(existsSync(path.join(path.dirname(file), "loading.tsx")), `${href} loading`).toBe(true);
      }
    });
  }
  it("the place views read the flat address, and the flat reader agrees", () => {
    for (const tab of PLACE_TABS) {
      expect(viewHref(tab)).toBe(`/${tab}`);
      expect(flatViewFromPathname(viewHref(tab))).toBe(tab);
    }
    expect(flatViewFromPathname("/payments")).toBeNull();
    expect(flatViewFromPathname(placeTabHref("p-1", "profile"))).toBeNull();
    expect(flatViewFromPathname("/profiles")).toBeNull();
  });
  it("the create ceremony has its own loading boundary", () => {
    expect(existsSync(path.join(SHELL_DIR, "orgs", "new", "loading.tsx"))).toBe(
      true,
    );
  });
});

describe("the organization's pages (MESITA-1807)", () => {
  const ID: Record<string, string> = { "org-x": "[orgId]" };

  it("the organization is the bare /orgs/<id>; the list hangs beneath it", () => {
    // ONE page (MESITA-1810): Stripe, Partner, Members and Places are boxes
    // on it, not routes. The old subpages must not come back.
    expect(ORG_PAGES).toEqual(["overview", "places"]);
    expect(ORG_PAGE_LABEL.overview).toBe("Organization");
    expect(orgHref("org-x")).toBe("/orgs/org-x");
    expect(orgHref("org-x", "overview")).toBe("/orgs/org-x");
    expect(orgHref("org-x", "places")).toBe("/orgs/org-x/places");
    expect(orgPlacesNewHref("org-x")).toBe("/orgs/org-x/places/new");
    for (const gone of ["payments", "members", "overview"]) {
      expect(
        existsSync(path.join(SHELL_DIR, "orgs", "[orgId]", gone, "page.tsx")),
      ).toBe(false);
    }
  });

  it("the organization is a FORWARDER, and its list a page with a loading boundary (MESITA-1832)", () => {
    // /orgs/<id> selects the organization and lands on /payments: a route
    // handler, not a page — Stripe's return links keep working.
    expect(existsSync(path.join(SHELL_DIR, "orgs", "[orgId]", "route.ts"))).toBe(true);
    expect(existsSync(path.join(SHELL_DIR, "orgs", "[orgId]", "page.tsx"))).toBe(false);
    for (const page of ORG_PAGES) {
      if (page === "overview") continue;
      const file = routeFile(orgHref("org-x", page), ID);
      expect(existsSync(file), `${page}: ${file}`).toBe(true);
      expect(existsSync(path.join(path.dirname(file), "loading.tsx"))).toBe(
        true,
      );
    }
    const claim = routeFile(orgPlacesNewHref("org-x"), ID);
    expect(existsSync(claim)).toBe(true);
    expect(existsSync(path.join(path.dirname(claim), "loading.tsx"))).toBe(true);
    expect(
      existsSync(path.join(SHELL_DIR, "orgs", "[orgId]", "layout.tsx")),
    ).toBe(true);
  });

  it("every route directory under the organization is a known page", () => {
    // The reverse direction: a directory nobody linked is a page nobody can
    // reach, and a bijection is what keeps the rail and the filesystem in step.
    const dir = path.join(SHELL_DIR, "orgs", "[orgId]");
    const dirs = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    expect(dirs.sort()).toEqual(
      ORG_PAGES.filter((p) => p !== "overview").sort(),
    );
  });

  it("labels every page", () => {
    for (const page of ORG_PAGES) expect(ORG_PAGE_LABEL[page]).toBeTruthy();
  });

  it("encodes the id, so a slash in one cannot forge a route", () => {
    expect(orgHref("a/b")).toBe("/orgs/a%2Fb");
    expect(orgIdFromPathname(orgHref("a/b"))).toBe("a/b");
  });

  it("reads the id back out of any organization pathname", () => {
    for (const page of ORG_PAGES) {
      expect(orgIdFromPathname(orgHref("org-x", page))).toBe("org-x");
    }
    expect(orgIdFromPathname(orgPlacesNewHref("org-x"))).toBe("org-x");
    expect(orgIdFromPathname("/orgs/org-x/")).toBe("org-x");
  });

  it("the ceremony is not an id, and other routes name no organization", () => {
    expect(orgIdFromPathname(SHELL_ROUTES.orgNew)).toBeNull();
    expect(orgIdFromPathname(SHELL_ROUTES.account)).toBeNull();
    expect(orgIdFromPathname(placeHref("p-1"))).toBeNull();
    expect(orgIdFromPathname("/")).toBeNull();
  });

  it("names the page a pathname is on, and lights Places for the claim step", () => {
    expect(orgPageFromPathname(orgHref("org-x"))).toBe("overview");
    expect(orgPageFromPathname(orgHref("org-x", "places"))).toBe("places");
    expect(orgPageFromPathname(orgPlacesNewHref("org-x"))).toBe("places");
    expect(orgPageFromPathname("/orgs/org-x/places/")).toBe("places");
  });

  it("is null off the organization, on the ceremony, and on a segment that is not a page", () => {
    expect(orgPageFromPathname(SHELL_ROUTES.orgNew)).toBeNull();
    expect(orgPageFromPathname(placeHref("p-1"))).toBeNull();
    expect(orgPageFromPathname("/orgs/org-x/billing")).toBeNull();
    expect(orgPageFromPathname("/orgs/org-x/payments")).toBeNull();
    expect(orgPageFromPathname("/orgs/org-x/members")).toBeNull();
    expect(orgPageFromPathname("/orgs/org-x/places/p-1")).toBeNull();
  });
});

describe("the list's two filters are filters, not routes (MESITA-1614)", () => {
  it("both resolve to the SAME route the list uses", () => {
    for (const owned of PLACES_OWNED) {
      expect(orgPlacesHref("org-x", owned).split("?")[0]).toBe(
        orgHref("org-x", "places"),
      );
    }
  });

  it("the unfiltered list is the comparison view", () => {
    expect(orgPlacesHref("org-x")).toBe("/orgs/org-x/places");
    expect(orgPlacesHref("org-x", null)).toBe("/orgs/org-x/places");
  });

  it("names the filter in the query, not the path", () => {
    expect(orgPlacesHref("org-x", "org")).toBe("/orgs/org-x/places?owned=org");
    expect(orgPlacesHref("org-x", "public")).toBe(
      "/orgs/org-x/places?owned=public",
    );
  });

  it("neither filter grew a route file on disk", () => {
    for (const seg of ["org", "public", "pool"]) {
      expect(
        existsSync(
          path.join(SHELL_DIR, "orgs", "[orgId]", "places", seg, "page.tsx"),
        ),
      ).toBe(false);
    }
  });
});

describe("ownedFromParam", () => {
  it("reads the two real values", () => {
    expect(ownedFromParam("org")).toBe("org");
    expect(ownedFromParam("public")).toBe("public");
  });

  it("is null for anything else — an unknown filter shows the FULL list", () => {
    // The dangerous failure is the other way: a typo that filters everything
    // out renders an empty screen and reads as data loss.
    for (const junk of ["", "ORG", "owned", "true", "1", "../org"]) {
      expect(ownedFromParam(junk)).toBeNull();
    }
  });

  it("is null for a repeated param, which Next hands over as an array", () => {
    expect(ownedFromParam(["org", "public"])).toBeNull();
    expect(ownedFromParam(undefined)).toBeNull();
  });
});

describe("the place addresses SELECT and FORWARD (MESITA-1832)", () => {
  it("placeHref names the place; the address is a route handler that selects it and lands on /profile", () => {
    expect(placeHref("p-x")).toBe("/places/p-x/profile");
    expect(existsSync(path.join(SHELL_DIR, "places", "[id]", "[view]", "route.ts"))).toBe(true);
    expect(existsSync(path.join(SHELL_DIR, "places", "[id]", "route.ts"))).toBe(true);
    // No page lives under /places/<id> any more: the views are flat.
    expect(existsSync(path.join(SHELL_DIR, "places", "[id]", "page.tsx"))).toBe(false);
    expect(existsSync(path.join(SHELL_DIR, "places", "[id]", "profile"))).toBe(false);
    for (const tab of PLACE_TABS) {
      expect(existsSync(path.join(SHELL_DIR, "(place)", tab, "page.tsx")), tab).toBe(true);
    }
  });

  it("encodes the id, so a slash in one cannot forge a route", () => {
    expect(placeHref("a/b")).toBe("/places/a%2Fb/profile");
  });

  it("carries no organization: the place id names its holder", () => {
    expect(placeHref("p-x")).not.toContain("?");
    for (const tab of PLACE_TABS) {
      expect(placeTabHref("p-x", tab)).not.toContain("org=");
    }
  });
});

describe("placeIdFromPathname — the rail's place scope", () => {
  it("reads the id back out of a Place pathname", () => {
    expect(placeIdFromPathname(placeHref("p-x"))).toBe("p-x");
    expect(placeIdFromPathname("/places/p-x/")).toBe("p-x");
    expect(placeIdFromPathname(placeHref("a/b"))).toBe("a/b");
  });
  it("is null on the old list address and on the old claim ceremony", () => {
    // Both forward from next.config.ts now; neither was ever a place id.
    expect(placeIdFromPathname("/places")).toBeNull();
    expect(placeIdFromPathname("/places/")).toBeNull();
    expect(placeIdFromPathname("/places/new")).toBeNull();
  });
  it("survives every real tab segment", () => {
    for (const tab of PLACE_TABS) {
      expect(placeIdFromPathname(placeTabHref("p-x", tab))).toBe("p-x");
    }
  });
  it("is still null two segments deep, and on organization routes", () => {
    expect(placeIdFromPathname("/places/p-x/profile/basics")).toBeNull();
    expect(placeIdFromPathname(orgHref("org-x", "places"))).toBeNull();
    expect(placeIdFromPathname(orgPlacesNewHref("org-x"))).toBeNull();
  });
});

describe("withQuery — the resolver forwards its whole query", () => {
  // `/` resolves to a place or an organization. Stripe stores an Account
  // Link's return_url when the link is MINTED, so a link created before
  // MESITA-1727 shipped still points at `/?org=<id>&connect=return`. If the
  // forward drops the query, the operator finishes Stripe onboarding on a
  // screen that never shows the return notice. This is the assertion that
  // stops it.
  const PAY = "/orgs/org-9/payments";

  it("is a no-op with nothing to carry", () => {
    expect(withQuery(PAY, {})).toBe(PAY);
    expect(withQuery(PAY, { connect: undefined })).toBe(PAY);
  });

  it("carries the Stripe return exactly as Stripe will send it", () => {
    expect(withQuery(PAY, { connect: "return" })).toBe(`${PAY}?connect=return`);
    expect(withQuery(PAY, { connect: "refresh" })).toBe(
      `${PAY}?connect=refresh`,
    );
  });

  it("keeps every value of a repeated param, in order", () => {
    // Next types a repeated `?a=1&a=2` as an array. Keeping only the first
    // would quietly change what the destination reads.
    expect(withQuery(PAY, { a: ["1", "2"] })).toBe(`${PAY}?a=1&a=2`);
  });

  it("escapes what belongs in a query string", () => {
    expect(withQuery(PAY, { note: "a b&c=d" })).toBe(`${PAY}?note=a+b%26c%3Dd`);
  });
});

describe("the old addresses are gone from disk", () => {
  it("no organization, places-list or claim route survives outside /orgs", () => {
    for (const rel of [
      ["organization", "page.tsx"],
      ["organization", "new", "page.tsx"],
      ["places", "page.tsx"],
      ["places", "new", "page.tsx"],
      ["pool", "page.tsx"],
    ]) {
      expect(existsSync(path.join(SHELL_DIR, ...rel))).toBe(false);
    }
  });
});
