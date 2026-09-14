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
  ORG_TARGET_LABEL,
  ORG_RAIL_TARGETS,
  ORG_TARGETS,
  PLACES_OWNED,
  SHELL_ROUTES,
  FLAT_ROUTE_LIST,
  flatOrgTargetFromPathname,
  flatViewFromPathname,
  isFlatRoute,
  orgHref,
  orgSwitchHref,
  orgIdFromPathname,
  orgTargetFromPathname,
  orgPlacesHref,
  orgPlacesNewHref,
  orgRootHref,
  ownedFromParam,
  placeHref,
  placeIdFromPathname,
  withQuery,
} from "./console-routes";
import { PLACE_TABS, placeTabHref } from "./place-tabs";

const SHELL_DIR = path.resolve(__dirname, "..", "app", "(shell)");

/** The route file a concrete href resolves to; ids become their segment. */
function routeFile(href: string, dynamic: Record<string, string> = {}): string {
  const segments = href === "/" ? [] : href.split("?")[0].slice(1).split("/");
  return path.join(SHELL_DIR, ...segments.map((s) => dynamic[s] ?? s), "page.tsx");
}

describe("SHELL_ROUTES are the addresses with no scope at all", () => {
  it("is root, the person, and the create ceremony (MESITA-1839)", () => {
    // The six page NAMES moved to FLAT_ROUTES when they became resolvers.
    // What is left here is the three addresses that are about nothing you
    // can switch: where you land, who you are, and how to make a first
    // organization.
    expect(Object.keys(SHELL_ROUTES)).toEqual(["root", "account", "orgNew"]);
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

  it("the create ceremony has its own loading boundary", () => {
    expect(existsSync(path.join(SHELL_DIR, "orgs", "new", "loading.tsx"))).toBe(
      true,
    );
  });
});

describe("FLAT_ROUTES are the scope-free addresses that resolve (MESITA-1839)", () => {
  it("is the place's five views, then the organization's four pages", () => {
    // The order is the declaration's: the place's group, then the
    // organization's. MESITA-1841 added `capabilities` (was `settings`),
    // `rewards`, `organization` and `credits`, and moved `activity` from the
    // first group to the second — it resolves an ORGANIZATION now.
    // MESITA-1845 swaps `credits` for `customers`: Credits merged back into
    // Payments and has no address of its own, and Customers gained a row.
    // MESITA-1847 drops `members`: the people are CONTENT on the Organization
    // page now, so the address has nothing left to be.
    expect(Object.keys(FLAT_ROUTES)).toEqual([
      "profile",
      "reviews",
      "capabilities",
      "rewards",
      "admin",
      "organization",
      "customers",
      "payments",
      "activity",
    ]);
    for (const r of FLAT_ROUTE_LIST) expect(isFlatRoute(r)).toBe(true);
    expect(isFlatRoute("/orgs/x")).toBe(false);
    expect(isFlatRoute("/account")).toBe(false);
    // A trailing slash is the same address; `?to=` arrives from a real browser.
    expect(isFlatRoute("/profile/")).toBe(true);
  });

  // ONE ROUTE FILE FOR ALL TEN (MESITA-1842). They were ten directories
  // holding one line each, and adding the eleventh meant remembering to create
  // a directory, a page and a loading boundary that no compiler would miss.
  it("all ten are served by the ONE `[flat]` segment, with its own boundary", () => {
    const dir = path.join(SHELL_DIR, "[flat]");
    expect(existsSync(path.join(dir, "page.tsx"))).toBe(true);
    expect(existsSync(path.join(dir, "loading.tsx"))).toBe(true);
    // The old ten are gone, not orphaned: a leftover directory would WIN over
    // the dynamic segment (Next resolves static first) and serve whatever it
    // still contained, silently, forever.
    for (const href of FLAT_ROUTE_LIST) {
      expect(
        existsSync(routeFile(href)),
        `${href} still has a directory of its own — it would shadow [flat]`,
      ).toBe(false);
    }
  });

  // THE HAZARD THE COLLAPSE INTRODUCES, and the only one: a dynamic segment at
  // the root sees every name no static route claimed. Next resolves static
  // FIRST, so a flat name that collides with a real directory is dead on
  // arrival — and it dies quietly, because the directory still answers.
  it("no flat name collides with a static route, in either direction", () => {
    const statics = readdirSync(SHELL_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith("[") && !e.name.startsWith("("))
      .map((e) => e.name);
    for (const name of Object.keys(FLAT_ROUTES)) {
      expect(statics, `/${name} is shadowed by a static route of the same name`).not.toContain(name);
    }
    // `places` is the reverse case and the reason it is NOT in the vocabulary:
    // the place segment owns that name, so a flat `places` could never resolve.
    expect(statics).toContain("places");
    expect(Object.keys(FLAT_ROUTES)).not.toContain("places");
  });

  it("a flat place view reads as that view, and the canonical one does not", () => {
    for (const tab of PLACE_TABS) {
      expect(flatViewFromPathname(FLAT_ROUTES[tab])).toBe(tab);
    }
    expect(flatViewFromPathname(FLAT_ROUTES.payments)).toBeNull();
    expect(flatViewFromPathname(placeTabHref("p-1", "profile"))).toBeNull();
    expect(flatViewFromPathname("/profiles")).toBeNull();
  });

  it("a flat organization page reads as that page, and a place view does not", () => {
    // The rail lights an organization row for the flat address too — an
    // operator who typed `/credits` is on Credits while the forward is in
    // flight, and a row that goes dark for that instant reads as a glitch
    // (MESITA-1841).
    for (const page of ORG_PAGES) {
      if (page === "places") continue; // no flat twin: the list lives under its org
      expect(flatOrgTargetFromPathname(`/${page}`)).toBe(page);
    }
    expect(flatOrgTargetFromPathname(FLAT_ROUTES.profile)).toBeNull();
    // A canonical address is never a flat one, and a name that merely STARTS
    // with a live one is not either.
    expect(flatOrgTargetFromPathname(orgHref("org-x", "payments"))).toBeNull();
    expect(flatOrgTargetFromPathname("/paymentsx")).toBeNull();
    // `/credits` is not a flat address at all now (MESITA-1845) — the
    // redirect table owns it.
    expect(flatOrgTargetFromPathname("/credits")).toBeNull();
  });

  it("THE TWO READERS NEVER BOTH ANSWER for one address", () => {
    // `/activity` moved from the place group to the organization's in
    // MESITA-1841. If both readers claimed it the rail would paint two pills,
    // and "exactly one pill" is the rule every rail test asserts.
    for (const href of FLAT_ROUTE_LIST) {
      const asView = flatViewFromPathname(href);
      const asPage = flatOrgTargetFromPathname(href);
      expect(asView === null || asPage === null, href).toBe(true);
    }
  });
});

describe("the place is addressed by its id again (MESITA-1839)", () => {
  const ID: Record<string, string> = { "p-1": "[id]" };

  it("every view is a route file with its own loading boundary", () => {
    for (const tab of PLACE_TABS) {
      const file = routeFile(placeTabHref("p-1", tab), ID);
      expect(existsSync(file), `${tab}: ${file}`).toBe(true);
    }
    // ONE loading boundary for the segment, which every view shares.
    expect(
      existsSync(path.join(SHELL_DIR, "places", "[id]", "loading.tsx")),
    ).toBe(true);
    expect(
      existsSync(path.join(SHELL_DIR, "places", "[id]", "layout.tsx")),
    ).toBe(true);
  });

  it("the bare place URL is a page that forwards, not a 404", () => {
    expect(
      existsSync(path.join(SHELL_DIR, "places", "[id]", "page.tsx")),
    ).toBe(true);
  });

  it("every view directory is a known view — a bijection, both ways", () => {
    // A directory nobody linked is a page nobody can reach; a link with no
    // directory is a 404. Assert the set, not the membership.
    const dir = path.join(SHELL_DIR, "places", "[id]");
    const dirs = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    expect(dirs.sort()).toEqual([...PLACE_TABS].sort());
  });
});

describe("the organization's pages (MESITA-1807)", () => {
  const ID: Record<string, string> = { "org-x": "[orgId]" };

  it("the organization IS `/orgs/<id>`, and says its name once", () => {
    // MESITA-1810 folded Payments and Members INTO one Organization page;
    // MESITA-1832 dissolved that page and scattered them to flat addresses;
    // MESITA-1839 gave each its own address under the organization; MESITA-1841
    // brought Organization back — at `/orgs/<id>/organization`, which says the
    // word twice; MESITA-1842 gave it the bare address, because the only thing
    // squatting there was a cookie-writing forwarder that now lives at
    // `/switch`.
    expect(ORG_PAGES).toEqual(["customers", "payments", "activity", "places"]);
    expect(ORG_TARGETS).toEqual([
      "organization",
      "customers",
      "payments",
      "activity",
      "places",
    ]);
    // CREDITS IS NOT AN ADDRESS ANY MORE (MESITA-1845). It merged into
    // Payments on Pato's one word, and both its spellings forward from
    // `next.config.ts` — so a name in this contract would be a live address
    // the redirect table shadows, which is the MESITA-1839 trap exactly.
    expect(ORG_TARGETS).not.toContain("credits");
    expect(Object.keys(FLAT_ROUTES)).not.toContain("credits");
    // EVERY TARGET IS A NAMED SEGMENT (MESITA-1846), Organization included:
    // the rail draws its five as siblings, so their addresses look alike. The
    // bare id is a forwarder with its own helper, never `orgHref`'s output.
    expect(orgHref("org-x")).toBe("/orgs/org-x/organization");
    expect(orgHref("org-x", "organization")).toBe("/orgs/org-x/organization");
    expect(orgRootHref("org-x")).toBe("/orgs/org-x");
    expect(orgHref("org-x", "payments")).toBe("/orgs/org-x/payments");
    expect(orgHref("org-x", "customers")).toBe("/orgs/org-x/customers");
    expect(orgHref("org-x", "activity")).toBe("/orgs/org-x/activity");
    expect(orgHref("org-x", "places")).toBe("/orgs/org-x/places");
    expect(orgPlacesNewHref("org-x")).toBe("/orgs/org-x/places/new");
    // EVERY target is exactly two segments under /orgs — one shape for five
    // sibling rows (MESITA-1846). `organization` repeating its parent's noun
    // is the one cost, and it is what buys the symmetry.
    for (const t of ORG_TARGETS) {
      expect(orgHref("org-x", t), t).toBe(`/orgs/org-x/${t}`);
    }
  });

  it("the switcher's forwarder has its OWN address, and it is not a target", () => {
    // A page cannot set a cookie on the way through, which is the entire
    // reason this address exists. Keeping it OUT of ORG_TARGETS is what stops
    // the rail from ever lighting a row for a redirect (MESITA-1842).
    expect(orgSwitchHref("org-x", "/profile")).toBe("/orgs/org-x/switch?to=%2Fprofile");
    expect(ORG_TARGETS).not.toContain("switch");
    expect(orgTargetFromPathname("/orgs/org-x/switch")).toBeNull();
    expect(existsSync(path.join(SHELL_DIR, "orgs", "[orgId]", "switch", "route.ts"))).toBe(true);
  });

  it("THE RAIL LISTS THEM ALL — there are no doors left (MESITA-1847)", () => {
    // Members was the last organization address with no row of its own,
    // reached through a chevron on the Organization page. Pato: "members and
    // places in organization i mean, fuck nested things display shit there."
    // The people are ON that page now, so the rail's list and the contract's
    // list are the same list — and an address in the contract that no row can
    // light would render a screen with no pill at all.
    expect(ORG_RAIL_TARGETS).toEqual([
      "organization",
      "customers",
      "payments",
      "activity",
      "places",
    ]);
    expect([...ORG_RAIL_TARGETS].sort()).toEqual([...ORG_TARGETS].sort());
  });

  it("every organization address is a PAGE, the bare id included (MESITA-1846)", () => {
    // The bare `/orgs/<id>` is a page, not a route handler — a PAGE can
    // redirect even though it cannot set a cookie, which is what lets it
    // catch Stripe's stored `?connect=` and hand it to Payments. It needs no
    // loading boundary of its own: it renders nothing and redirects.
    expect(existsSync(path.join(SHELL_DIR, "orgs", "[orgId]", "route.ts"))).toBe(false);
    expect(existsSync(path.join(SHELL_DIR, "orgs", "[orgId]", "page.tsx"))).toBe(true);
    for (const page of ORG_TARGETS) {
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
    // `switch` is the one directory that is not a target — it is the cookie
    // forwarder, and its absence from ORG_TARGETS is deliberate.
    const dir = path.join(SHELL_DIR, "orgs", "[orgId]");
    const dirs = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    expect(dirs.sort()).toEqual([...ORG_TARGETS, "switch"].sort());
  });

  it("labels every target", () => {
    for (const t of ORG_TARGETS) expect(ORG_TARGET_LABEL[t]).toBeTruthy();
  });

  it("encodes the id, so a slash in one cannot forge a route", () => {
    expect(orgHref("a/b")).toBe("/orgs/a%2Fb/organization");
    expect(orgRootHref("a/b")).toBe("/orgs/a%2Fb");
    expect(orgHref("a/b", "payments")).toBe("/orgs/a%2Fb/payments");
    expect(orgSwitchHref("a/b", "/profile")).toBe("/orgs/a%2Fb/switch?to=%2Fprofile");
    expect(orgIdFromPathname(orgHref("a/b"))).toBe("a/b");
    expect(orgIdFromPathname(orgRootHref("a/b"))).toBe("a/b");
  });

  // Both spellings answer "organization" (MESITA-1846). The bare id is a 307
  // in flight, and a rail row that goes dark for that instant reads as a
  // glitch — the same courtesy every flat resolver already gets.
  it("the bare id and the segment both light the Organization row", () => {
    expect(orgTargetFromPathname("/orgs/org-x")).toBe("organization");
    expect(orgTargetFromPathname("/orgs/org-x/organization")).toBe("organization");
  });

  it("reads the id back out of any organization pathname", () => {
    for (const t of ORG_TARGETS) {
      expect(orgIdFromPathname(orgHref("org-x", t))).toBe("org-x");
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
    for (const t of ORG_TARGETS) {
      expect(orgTargetFromPathname(orgHref("org-x", t))).toBe(t);
    }
    expect(orgTargetFromPathname(orgPlacesNewHref("org-x"))).toBe("places");
    expect(orgTargetFromPathname("/orgs/org-x/places/")).toBe("places");
  });

  it("is null off the organization, on the ceremony, and on a segment that is not a page", () => {
    expect(orgTargetFromPathname(SHELL_ROUTES.orgNew)).toBeNull();
    expect(orgTargetFromPathname(placeHref("p-1"))).toBeNull();
    expect(orgTargetFromPathname("/orgs/org-x/billing")).toBeNull();
    expect(orgTargetFromPathname("/orgs/org-x/places/p-1")).toBeNull();
    // A third segment under a page is not that page.
    expect(orgTargetFromPathname("/orgs/org-x/payments/x")).toBeNull();
    // The BARE address IS the Organization page since MESITA-1842, trailing
    // slash included — it used to answer null, because it was a forwarder.
    expect(orgTargetFromPathname(orgHref("org-x"))).toBe("organization");
    expect(orgTargetFromPathname("/orgs/org-x/")).toBe("organization");
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

describe("the place addresses are PAGES again (MESITA-1839)", () => {
  it("placeHref is Profile's address, and every view is a real page", () => {
    expect(placeHref("p-x")).toBe("/places/p-x/profile");
    // The two forwarders MESITA-1832 put here are gone: `[view]/route.ts`
    // selected a place and bounced to the flat address, and the bare
    // `route.ts` did the same. The bare URL is a page that redirects to
    // Profile; the views are pages that render.
    expect(existsSync(path.join(SHELL_DIR, "places", "[id]", "[view]"))).toBe(false);
    expect(existsSync(path.join(SHELL_DIR, "places", "[id]", "route.ts"))).toBe(false);
    expect(existsSync(path.join(SHELL_DIR, "places", "[id]", "page.tsx"))).toBe(true);
    for (const tab of PLACE_TABS) {
      expect(existsSync(path.join(SHELL_DIR, "places", "[id]", tab, "page.tsx")), tab).toBe(true);
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
      // NOT `organization/page.tsx`: that is a LIVE flat resolver again
      // (MESITA-1841). The ceremony under it is what stayed dead.
      ["organization", "new", "page.tsx"],
      ["places", "page.tsx"],
      ["places", "new", "page.tsx"],
      ["pool", "page.tsx"],
    ]) {
      expect(existsSync(path.join(SHELL_DIR, ...rel))).toBe(false);
    }
  });
});
