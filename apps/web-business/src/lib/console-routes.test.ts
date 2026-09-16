// The 2am-Friday test: every href the console can emit maps to a real
// route file on disk, so a rename can never ship a dead nav link.
//
// MESITA-1807: the organization is in the path. MESITA-1892: there is no
// organization. Every `/orgs/<id>/…` address is now the PLACE's at the same
// segment, `/places` is the catalogue and `/places/new` the ceremony, and the
// old addresses forward from next.config.ts (asserted in
// legacy-redirects.test.ts).
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FLAT_ROUTES,
  PLACE_PAGES,
  PLACE_PAGE_LABEL,
  PLACES_OWNED,
  SHELL_ROUTES,
  FLAT_ROUTE_LIST,
  flatPlacePageFromPathname,
  flatViewFromPathname,
  isFlatRoute,
  ownedFromParam,
  placeHref,
  placeIdFromPathname,
  placePageFromPathname,
  placePageHref,
  placePayHref,
  placeRootHref,
  placesHref,
  placesNewHref,
  withQuery,
} from "./console-routes";
import { PLACE_TABS, placeTabHref } from "./place-tabs";

const SHELL_DIR = path.resolve(__dirname, "..", "app", "(shell)");

/** The route file a concrete href resolves to; ids become their segment. */
function routeFile(href: string, dynamic: Record<string, string> = {}): string {
  const segments = href === "/" ? [] : href.split("?")[0].slice(1).split("/");
  return path.join(SHELL_DIR, ...segments.map((s) => dynamic[s] ?? s), "page.tsx");
}

describe("SHELL_ROUTES are the addresses that name no place", () => {
  it("is root, the person, the catalogue and its ceremony (MESITA-1892)", () => {
    // The page NAMES moved to FLAT_ROUTES when they became resolvers. What is
    // left here is the four addresses that are about no single place: where
    // you land, who you are, every place there is, and how to take one.
    //
    // `orgNew` LEFT (MESITA-1892). There is no legal person to create — a
    // claim mints the claimer's own owner row on the place itself — so the
    // ceremony that remains is Add place, which is the catalogue's.
    expect(Object.keys(SHELL_ROUTES)).toEqual([
      "root",
      "account",
      "places",
      "placesNew",
    ]);
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

  it("the catalogue's helpers answer the contract's own addresses", () => {
    expect(placesHref()).toBe(SHELL_ROUTES.places);
    expect(placesNewHref()).toBe(SHELL_ROUTES.placesNew);
  });

  it("the create-organization ceremony is gone from disk", () => {
    expect(existsSync(path.join(SHELL_DIR, "orgs"))).toBe(false);
  });
});

describe("FLAT_ROUTES are the scope-free addresses that resolve (MESITA-1839)", () => {
  it("is the place's ten views, then its four pages", () => {
    // The order is the declaration's: the views, then the pages. MESITA-1841
    // added `capabilities` (was `settings`), `rewards`, `organization` and
    // `credits`, and moved `activity` out of the first group. MESITA-1845
    // swaps `credits` for `customers`. MESITA-1847 drops `members`: the people
    // are CONTENT on the Settings page now. MESITA-1848 adds `menus` (split
    // out of Profile). MESITA-1869 swaps `payments` for `products`.
    // MESITA-1871 gets `settings` back by deleting the rule that shadowed it.
    //
    // MESITA-1885 SWAPS TWO FOR FIVE: `capabilities` and `rewards` are not
    // views any more — the rail lists all eight products, and three of them
    // were rows on the one Capabilities page — so each product got a view.
    // Both old names are redirect sources now and may never come back here.
    //
    // MESITA-1892 CHANGES WHAT THE LAST FOUR RESOLVE, not which they are:
    // `settings`, `products`, `customers` and `activity` resolved an
    // ORGANIZATION and resolve this place's own pages now.
    //
    // MESITA-1900 GIVES `rewards` ITS NAME BACK, and the assertion two lines
    // below is why it is safe: `capabilities` is STILL a redirect source and
    // still forbidden here, while `rewards` is not one any more — its two
    // rules left next.config.ts in the same commit this entry arrived. A name
    // in both places is the MESITA-1839 trap, and `legacy-redirects.test.ts`
    // walks this whole contract through the table to prove neither is.
    //
    // MESITA-1919 TAKES `menus` AND `reviews` OUT, and the same assertion two
    // lines below is why that is safe rather than a new trap: neither is a
    // redirect source, so neither name exists in two places. They are cards on
    // Profile now — an address that stopped existing, not one that moved.
    expect(Object.keys(FLAT_ROUTES)).toEqual([
      "profile",
      "visits",
      "orders",
      "reservations",
      "rewards",
      "pay",
      "credits",
      "admin",
      "settings",
      "products",
      "customers",
      "activity",
    ]);
    expect(Object.keys(FLAT_ROUTES)).not.toContain("capabilities");
    expect(Object.keys(FLAT_ROUTES)).not.toContain("payments");
    // `places` is a LIVE PAGE now (MESITA-1892), so a flat twin would be
    // shadowed by a real static route rather than merely fail to resolve —
    // Next resolves static segments before dynamic ones.
    expect(Object.keys(FLAT_ROUTES)).not.toContain("places");
    expect(Object.keys(FLAT_ROUTES)).not.toContain("configuration");
    for (const r of FLAT_ROUTE_LIST) expect(isFlatRoute(r)).toBe(true);
    expect(isFlatRoute("/places")).toBe(false);
    expect(isFlatRoute("/account")).toBe(false);
    // A trailing slash is the same address.
    expect(isFlatRoute("/profile/")).toBe(true);
  });

  // ONE ROUTE FILE FOR ALL FOURTEEN (MESITA-1842). They were ten directories
  // holding one line each, and adding the eleventh meant remembering to create
  // a directory, a page and a loading boundary that no compiler would miss.
  it("every one is served by the ONE `[flat]` segment, with its own boundary", () => {
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
    // the catalogue owns that name, so a flat `places` could never resolve.
    expect(statics).toContain("places");
    expect(Object.keys(FLAT_ROUTES)).not.toContain("places");
  });

  it("a flat place view reads as that view, and the canonical one does not", () => {
    for (const tab of PLACE_TABS) {
      expect(flatViewFromPathname(FLAT_ROUTES[tab])).toBe(tab);
    }
    expect(flatViewFromPathname(FLAT_ROUTES.products)).toBeNull();
    expect(flatViewFromPathname(placeTabHref("p-1", "profile"))).toBeNull();
    expect(flatViewFromPathname("/profiles")).toBeNull();
  });

  it("a flat page reads as that page, and a place view does not", () => {
    // The rail lights a page row for the flat address too — an operator who
    // typed `/settings` is on Settings while the forward is in flight, and a
    // row that goes dark for that instant reads as a glitch (MESITA-1841).
    for (const page of PLACE_PAGES) {
      expect(flatPlacePageFromPathname(`/${page}`)).toBe(page);
    }
    expect(flatPlacePageFromPathname(FLAT_ROUTES.profile)).toBeNull();
    // A canonical address is never a flat one, and a name that merely STARTS
    // with a live one is not either.
    expect(flatPlacePageFromPathname(placePageHref("p-x", "products"))).toBeNull();
    expect(flatPlacePageFromPathname("/productsx")).toBeNull();
    // Neither `/payments` (MESITA-1869) nor `/places` is a flat address: the
    // redirect table owns the first, the catalogue owns the second.
    expect(flatPlacePageFromPathname("/payments")).toBeNull();
    expect(flatPlacePageFromPathname("/places")).toBeNull();
  });

  it("THE TWO READERS NEVER BOTH ANSWER for one address", () => {
    // If both readers claimed one name the rail would paint two pills, and
    // "exactly one pill" is the rule every rail test asserts.
    for (const href of FLAT_ROUTE_LIST) {
      const asView = flatViewFromPathname(href);
      const asPage = flatPlacePageFromPathname(href);
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

  it("every directory under the place is a known view or page — a bijection", () => {
    // A directory nobody linked is a page nobody can reach; a link with no
    // directory is a 404. Assert the set, not the membership.
    //
    // THE SET GREW BY FOUR (MESITA-1892). Settings, Products, Customers and
    // Activity were the organization's directories; they are the place's now,
    // beside its nine views, which is why this bijection takes two lists.
    const dir = path.join(SHELL_DIR, "places", "[id]");
    const dirs = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    expect(dirs.sort()).toEqual([...PLACE_TABS, ...PLACE_PAGES].sort());
  });
});

describe("the place's pages (MESITA-1892)", () => {
  const ID: Record<string, string> = { "p-x": "[id]" };

  it("is the four the organization used to hold, at the place's address", () => {
    // ONE LIST (MESITA-1848): the pages, the rail's rows and the contract's
    // targets are the same array. Two lists is how an address ends up live in
    // one and dead in the other.
    expect(PLACE_PAGES).toEqual([
      "settings",
      "products",
      "customers",
      "activity",
    ]);
    // `places` IS NOT ONE (MESITA-1892). The catalogue lists every place you
    // hold AND every place you could claim, so scoping it under one place
    // would be asking a venue to list its siblings. It is `SHELL_ROUTES.places`.
    expect(PLACE_PAGES).not.toContain("places");
    // CREDITS IS NOT ONE EITHER (MESITA-1845) — it is a place VIEW since
    // MESITA-1885, and `/orgs/<id>/credits` still forwards from
    // `next.config.ts`, so a name in BOTH lists would be the MESITA-1839 trap.
    expect(PLACE_PAGES).not.toContain("credits");
    expect(Object.keys(FLAT_ROUTES)).toContain("credits");
    // PAYMENTS IS NOT AN ADDRESS ANY MORE (MESITA-1869): it is a product in
    // the catalogue, and both its spellings forward there.
    expect(PLACE_PAGES).not.toContain("payments");
    // EVERY page is a named segment, exactly two under the place's id.
    for (const p of PLACE_PAGES) {
      expect(placePageHref("p-x", p), p).toBe(`/places/p-x/${p}`);
    }
    expect(placeRootHref("p-x")).toBe("/places/p-x");
    expect(placeHref("p-x")).toBe("/places/p-x/profile");
  });

  it("the ONE sub-step hangs under Products and is not a page", () => {
    // Terminal's was the other one, and it went with the product
    // (MESITA-1900). `isPlaceTerminalPathname` and `placeTerminalHref` are
    // deleted with it — the two helpers existed only because that one row
    // could not be addressed like the other seven.
    expect(placePayHref("p-x")).toBe("/places/p-x/products/pay");
    expect(PLACE_PAGES).not.toContain("pay");
    expect(PLACE_PAGES).not.toContain("terminal");
  });

  it("every page is a route file with its own loading boundary", () => {
    for (const page of PLACE_PAGES) {
      const file = routeFile(placePageHref("p-x", page), ID);
      expect(existsSync(file), `${page}: ${file}`).toBe(true);
      expect(existsSync(path.join(path.dirname(file), "loading.tsx")), page).toBe(
        true,
      );
    }
    expect(existsSync(routeFile(placePayHref("p-x"), ID))).toBe(true);
    // AND TERMINAL'S IS GONE FROM DISK (MESITA-1900). A retired product whose
    // route file survives is a page nothing links to and nothing forwards
    // from — reachable by typing, and stating a product that is not sold.
    expect(
      existsSync(routeFile("/places/p-x/products/terminal", ID)),
    ).toBe(false);
  });

  it("labels every page", () => {
    for (const p of PLACE_PAGES) expect(PLACE_PAGE_LABEL[p]).toBeTruthy();
  });

  it("encodes the id, so a slash in one cannot forge a route", () => {
    expect(placePageHref("a/b", "settings")).toBe("/places/a%2Fb/settings");
    expect(placeRootHref("a/b")).toBe("/places/a%2Fb");
    expect(placePayHref("a/b")).toBe("/places/a%2Fb/products/pay");
    expect(placeHref("a/b")).toBe("/places/a%2Fb/profile");
    expect(placeIdFromPathname(placePageHref("a/b", "settings"))).toBe("a/b");
    expect(placeIdFromPathname(placeRootHref("a/b"))).toBe("a/b");
  });

  it("names the page a pathname is on, and Pay reads as Products", () => {
    for (const p of PLACE_PAGES) {
      expect(placePageFromPathname(placePageHref("p-x", p))).toBe(p);
    }
    expect(placePageFromPathname(placePayHref("p-x"))).toBe("products");
    expect(placePageFromPathname("/places/p-x/products/")).toBe("products");
  });

  it("is null for a view and for the bare address", () => {
    // THE BARE ADDRESS ANSWERS NULL, which is the one difference from the
    // organization's version of this reader: it is a 307 onto PROFILE, a
    // VIEW, so the row that must not go dark in flight is Profile's.
    expect(placePageFromPathname(placeRootHref("p-x"))).toBeNull();
    expect(placePageFromPathname("/places/p-x/")).toBeNull();
    expect(placePageFromPathname(placeHref("p-x"))).toBeNull();
    expect(placePageFromPathname("/places/p-x/billing")).toBeNull();
    expect(placePageFromPathname("/places/p-x/settings/x")).toBeNull();
    expect(placePageFromPathname(SHELL_ROUTES.places)).toBeNull();
    expect(placePageFromPathname(SHELL_ROUTES.placesNew)).toBeNull();
    expect(placePageFromPathname(SHELL_ROUTES.account)).toBeNull();
  });
});

describe("the catalogue's two filters are filters, not routes (MESITA-1614)", () => {
  it("both resolve to the SAME route the list uses", () => {
    for (const owned of PLACES_OWNED) {
      expect(placesHref(owned).split("?")[0]).toBe(SHELL_ROUTES.places);
    }
  });

  it("the unfiltered list is the comparison view", () => {
    expect(placesHref()).toBe("/places");
    expect(placesHref(null)).toBe("/places");
  });

  it("names the filter in the query, not the path", () => {
    expect(placesHref("mine")).toBe("/places?owned=mine");
    expect(placesHref("public")).toBe("/places?owned=public");
  });

  it("neither filter grew a route file on disk", () => {
    for (const seg of ["mine", "org", "public", "pool"]) {
      expect(
        existsSync(path.join(SHELL_DIR, "places", seg, "page.tsx")),
        seg,
      ).toBe(false);
    }
  });
});

describe("ownedFromParam", () => {
  it("reads the two real values", () => {
    expect(ownedFromParam("mine")).toBe("mine");
    expect(ownedFromParam("public")).toBe("public");
  });

  it("is null for anything else — an unknown filter shows the FULL list", () => {
    // The dangerous failure is the other way: a typo that filters everything
    // out renders an empty screen and reads as data loss. `org` is in that
    // set on purpose: it was the first value's name until MESITA-1892, so a
    // bookmark carrying it lands on the whole catalogue rather than on
    // nothing.
    for (const junk of ["", "org", "MINE", "owned", "true", "1", "../mine"]) {
      expect(ownedFromParam(junk), junk).toBeNull();
    }
  });

  it("is null for a repeated param, which Next hands over as an array", () => {
    expect(ownedFromParam(["mine", "public"])).toBeNull();
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

  it("carries no organization: the place id IS the scope", () => {
    expect(placeHref("p-x")).not.toContain("?");
    for (const tab of PLACE_TABS) {
      expect(placeTabHref("p-x", tab)).not.toContain("org=");
    }
    for (const page of PLACE_PAGES) {
      expect(placePageHref("p-x", page)).not.toContain("org=");
    }
  });
});

describe("placeIdFromPathname — the rail's scope", () => {
  it("reads the id back out of a place pathname", () => {
    expect(placeIdFromPathname(placeHref("p-x"))).toBe("p-x");
    expect(placeIdFromPathname("/places/p-x/")).toBe("p-x");
    expect(placeIdFromPathname(placeHref("a/b"))).toBe("a/b");
  });
  it("is null on the catalogue and on the ceremony", () => {
    // `new` is refused BY NAME: it was never a place id, and `/places` names
    // no single place at all.
    expect(placeIdFromPathname(SHELL_ROUTES.places)).toBeNull();
    expect(placeIdFromPathname("/places/")).toBeNull();
    expect(placeIdFromPathname(SHELL_ROUTES.placesNew)).toBeNull();
  });
  it("survives every real segment, however deep (MESITA-1892)", () => {
    // A reader that stopped at ONE optional segment — which is what the place
    // had before its pages arrived — would answer null on `products/pay`, and
    // the rail would lose its scope on the one screen Stripe returns to.
    for (const tab of PLACE_TABS) {
      expect(placeIdFromPathname(placeTabHref("p-x", tab))).toBe("p-x");
    }
    for (const page of PLACE_PAGES) {
      expect(placeIdFromPathname(placePageHref("p-x", page))).toBe("p-x");
    }
    expect(placeIdFromPathname(placePayHref("p-x"))).toBe("p-x");
  });
  it("is null on every address that names no place", () => {
    expect(placeIdFromPathname(SHELL_ROUTES.account)).toBeNull();
    expect(placeIdFromPathname("/")).toBeNull();
    expect(placeIdFromPathname("/profile")).toBeNull();
  });
});

describe("withQuery — the resolver forwards its whole query", () => {
  // `/` resolves to a place. Stripe stores an Account Link's return_url when
  // the link is MINTED, so a link created before MESITA-1727 shipped still
  // points at `/?org=<id>&connect=return`. If the forward drops the query, the
  // operator finishes Stripe onboarding on a screen that never shows the
  // return notice. This is the assertion that stops it.
  const PAY = placePayHref("p-9");

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
  it("no organization tree, and no invite page for one", () => {
    for (const rel of [
      ["orgs"],
      ["organization"],
      ["pool"],
    ]) {
      expect(existsSync(path.join(SHELL_DIR, ...rel)), rel.join("/")).toBe(false);
    }
    // `/accept-org-invite` sat outside the shell, beside its place twin.
    expect(
      existsSync(path.resolve(SHELL_DIR, "..", "accept-org-invite")),
    ).toBe(false);
    expect(existsSync(path.resolve(SHELL_DIR, "..", "accept-invite"))).toBe(true);
  });
});
