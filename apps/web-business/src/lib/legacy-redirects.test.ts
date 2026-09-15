// Every URL the console ever owned must still land somewhere real.
//
// MESITA-1564 deleted `app/(console)` — 11 place routes plus /settings.
// MESITA-1807 moved the organization into the path, retiring `/organization`,
// `/organization/new`, the bare `/places` list and `/places/new`, all of which
// carried the organization as `?org=`. Those URLs are in operators' bookmarks,
// in old emails, and — for `/organization?org=&connect=return` — stored on
// Stripe's side as the return_url of Account Links minted before the move. So
// the deletions are only safe if next.config.ts catches every one. This test
// is the proof: it walks the shapes the old console could emit and asserts
// each resolves the way Next will resolve it.
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import {
  FLAT_ROUTE_LIST,
  ORG_PAGES,
  SHELL_ROUTES,
  orgHref,
  orgPlacesNewHref,
  orgRootHref,
} from "./console-routes";
import { PLACE_TABS, placeTabHref } from "./place-tabs";

type Has = { type: string; key: string; value?: string };
type Rule = {
  source: string;
  destination: string;
  permanent?: boolean;
  has?: Has[];
};

async function rules(): Promise<Rule[]> {
  const r = await nextConfig.redirects?.();
  return (r ?? []) as Rule[];
}

/** Resolve a URL through the rule list the way Next does: first match wins,
 *  `:param` binds one segment, `:rest*` binds the remainder, and a `has`
 *  query rule must match too — its named capture is usable in the
 *  destination. Unmatched query params ride through to the destination. */
function resolve(url: string, all: Rule[]): string | null {
  const [pathname, search = ""] = url.split("?");
  const query = new URLSearchParams(search);
  for (const rule of all) {
    const names: string[] = [];
    const pattern = rule.source
      .split("/")
      .filter(Boolean)
      .map((seg) => {
        if (seg.endsWith("*") && seg.startsWith(":")) {
          names.push(seg.slice(1, -1));
          return "(.*)";
        }
        if (seg.startsWith(":")) {
          names.push(seg.slice(1));
          return "([^/]+)";
        }
        return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      })
      .join("/");
    const m = pathname.match(new RegExp(`^/${pattern}/?$`));
    if (!m) continue;
    const params: Record<string, string> = {};
    names.forEach((n, i) => {
      params[n] = m[i + 1] ?? "";
    });
    let hasMatched = true;
    for (const h of rule.has ?? []) {
      if (h.type !== "query") throw new Error(`unexpected has type ${h.type}`);
      const v = query.get(h.key);
      if (v === null) {
        hasMatched = false;
        break;
      }
      if (h.value) {
        const hm = v.match(new RegExp(`^${h.value}$`));
        if (!hm) {
          hasMatched = false;
          break;
        }
        Object.assign(params, hm.groups ?? {});
      }
    }
    if (!hasMatched) continue;
    let out = rule.destination;
    for (const [n, v] of Object.entries(params)) {
      out = out.replace(`:${n}*`, v).replace(`:${n}`, v);
    }
    const rest = new URLSearchParams(search);
    for (const h of rule.has ?? []) rest.delete(h.key);
    const q = rest.toString();
    return q ? `${out}?${q}` : out;
  }
  return null;
}

// The tab slugs the deleted console used. Partnership and Settings merged into
// Capabilities and Performance became Activity, so none of these map one to
// one — every one is expected to land on the place itself.
const LEGACY_TABS = [
  "home",
  "performance",
  "place",
  "place/preview",
  "place/basics",
  "place/media",
  "promos",
  "promos/perks",
  "reservations",
  "scan",
  "settings",
  "team",
  "tickets",
];

// Destinations are Profile's real address, not the bare place URL (MESITA-1732).
// These four are `permanent: true`, so their 308 is already cached on disk in
// every browser that followed them; pointing them at the bare URL would chain
// that spent 308 into the new 307 forever. One hop beats two.
describe("the legacy console's URLs all still resolve", () => {
  it("every /place/<id>/<tab> lands on that place, never a 404", async () => {
    const all = await rules();
    for (const tab of LEGACY_TABS) {
      expect(resolve(`/place/abc/${tab}`, all)).toBe("/places/abc/profile");
    }
  });

  it("the bare /place/<id> lands on that place", async () => {
    expect(resolve("/place/abc", await rules())).toBe("/places/abc/profile");
  });

  it("/unit/* is repointed, not left chaining through a deleted route", async () => {
    const all = await rules();
    expect(resolve("/unit/abc", all)).toBe("/places/abc/profile");
    expect(resolve("/unit/abc/place/preview", all)).toBe("/places/abc/profile");
  });

  // MESITA-1839. This test used to assert `/settings` -> `/account`, which is
  // what the rule did — and the rule was the bug. MESITA-1832 shipped a live
  // page at `/settings`; config redirects run before filesystem routes, so the
  // page was unreachable and the rail's Settings row 308'd to Account. CI was
  // green the whole time, because this file pinned the redirect rather than
  // the reachability. Now it pins the absence.
  // MESITA-1841 reversed this pair: Capabilities took its name back, so
  // `/settings` became the legacy spelling at BOTH addresses.
  //
  // MESITA-1871 SPLITS THEM. The PLACE-scoped rule stays — `/places/<id>/
  // settings` is still the retired spelling of a place view. The FLAT rule is
  // deleted, because it was the one thing standing between the organization's
  // own page and its real name: a permanent 308 on `/settings` meant the
  // contract could name that page and Next would never serve it, which is
  // MESITA-1839 exactly, and it is why MESITA-1852 called the page
  // `configuration` instead. Deleting it was checked against the live
  // response first (`308` with `max-age=0, must-revalidate`, so every browser
  // revalidates), not assumed.
  it("the three retired place segments all land on Visits, and nothing chains", async () => {
    // MESITA-1885 retired `capabilities` and `rewards` as views: the rail
    // lists all eight products and three of them were rows on the one
    // Capabilities page, so each product took a view of its own.
    //
    // ALL THREE LAND ON VISITS, including `/settings` — which was aimed at
    // `capabilities` and had to be repointed in the same commit. A redirect
    // onto a DELETED route is the `/unit/*` -> `/place/*` chain again, and it
    // fails silently because no test walks a legacy source to its own
    // destination. This one does.
    const all = await rules();
    for (const gone of ["settings", "capabilities", "rewards"]) {
      expect(resolve(`/places/abc/${gone}`, all), gone).toBe("/places/abc/visits");
    }
    // The absence IS the assertion: a rule here would shadow the live page.
    expect(resolve("/settings", all)).toBeNull();
    // NOTHING CHAINS: every destination is a route, not another source.
    expect(resolve("/places/abc/visits", all)).toBeNull();
    expect(resolve("/visits", all)).toBeNull();
    // AND THE FLAT `/credits` RULE IS GONE (MESITA-1885). Mesita Credits is a
    // rail row with a view of its own, so `/credits` is a live flat twin —
    // leaving the rule would have made it dead on arrival with every check
    // green, which is `/settings` in MESITA-1839 exactly.
    expect(resolve("/credits", all)).toBeNull();
    expect(resolve("/places/abc/credits", all)).toBeNull();
    // THE FLAT TWINS FORWARD TOO, and forgetting them is the mirror of the
    // MESITA-1839 trap this file is mostly about: there a rule SHADOWED a
    // live address, here a MISSING rule strands a retired one. `/capabilities`
    // and `/rewards` were live flat resolvers until MESITA-1885, and a name
    // dropped from `FLAT_ROUTES` does not fall through to anything — the
    // `[flat]` segment answers 404 for a name not in the contract, on purpose.
    // So a bookmark would have 404ed with every check green.
    expect(resolve("/capabilities", all)).toBe("/visits");
    expect(resolve("/rewards", all)).toBe("/visits");
    // The ORG-scoped Credits rule stays: a different path, and still the
    // retired spelling of an organization page.
    expect(resolve("/orgs/o1/credits", all)).toBe("/orgs/o1/products");
  });

  it("a place's Activity forwards to the organization's, which resolves", async () => {
    // Activity moved up a scope (MESITA-1841) and there is no org id in the
    // old path to forward to, so it lands on the FLAT address — which reads
    // the remembered organization at request time.
    const all = await rules();
    expect(resolve("/places/abc/activity", all)).toBe("/activity");
    expect(resolve("/activity", all)).toBeNull();
  });
});

// MESITA-1807. The organization moved from `?org=` into the path.
describe("the ?org= addresses forward into the path", () => {
  it("/organization?org=<id> is that organization's own page", async () => {
    expect(resolve("/organization?org=org-9", await rules())).toBe("/orgs/org-9");
  });

  it("a Stripe return link minted before the move keeps its query", async () => {
    // Stripe stored `/organization?org=<id>&connect=return` when the Account
    // Link was minted. `org` becomes the segment; `connect` rides through to
    // the bare organization address, which hands it on to Products where the
    // Stripe account and the notice that reads it live (MESITA-1869).
    expect(
      resolve("/organization?org=org-9&connect=return", await rules()),
    ).toBe("/orgs/org-9?connect=return");
  });

  it("the address Stripe actually stored is walked, query and all", async () => {
    // THE ONE ADDRESS THIS FILE WALKED BY LITERAL, NOT BY CONTRACT
    // (MESITA-1879). The return_url is minted at
    // `(shell)/actions/organizations.ts` as
    // `${origin}${orgRootHref(orgId)}?connect=return` — from `orgRootHref`,
    // the one console-routes export this test did not import. The check below
    // hardcoded "/orgs/org-9", so a change to `orgRootHref`'s shape would
    // leave this suite green while every Account Link Stripe has stored for
    // months returned to a 404.
    //
    // Derive it, and carry the query: `?connect=` is the whole reason the
    // bare address exists, and a rule that dropped it would land the operator
    // on a screen that does not know they just came back from onboarding.
    const all = await rules();
    const stored = `${orgRootHref("org-9")}?connect=return`;
    expect(stored).toBe("/orgs/org-9?connect=return");
    expect(resolve(stored, all)).toBeNull();
    // And the refresh half of the same pair, which Stripe stores alongside it.
    expect(resolve(`${orgRootHref("org-9")}?connect=refresh`, all)).toBeNull();
  });

  // MESITA-1842. `/orgs/<id>/organization` shipped in MESITA-1841 and lived
  // one issue: the segment said the word its parent already carries. It
  // forwards onto the bare address, one hop, and nothing chains.
  // MESITA-1846. A rule pointing `/orgs/<id>/organization` at the bare id
  // lived here between MESITA-1842 and now. The PAGE is back at that segment,
  // and config redirects run BEFORE filesystem routes — so the rule's absence
  // is the assertion: leaving it would make the rail's first row unreachable
  // with every check green, which is `/settings` in MESITA-1839 exactly.
  it("nothing forwards away from a live organization address", async () => {
    const all = await rules();
    expect(resolve("/orgs/org-9/organization", all)).toBeNull();
    // Derived, not typed: this is the address Stripe stored (see above).
    expect(resolve(orgRootHref("org-9"), all)).toBeNull();
    // PAYMENTS IS NOT A LIVE ADDRESS ANY MORE (MESITA-1869) — it forwards
    // onto the catalogue, so it belongs in the walk below, not here. Products
    // is the live one this rule must never shadow.
    expect(resolve("/orgs/org-9/products", all)).toBeNull();
    // The switcher's own address is live and must never be forwarded.
    expect(resolve("/orgs/org-9/switch", all)).toBeNull();
  });

  // MESITA-1841. The bare rule is GONE, and its absence is the assertion:
  // `/organization` is a live flat resolver again, and a rule matching it
  // would make that page unreachable exactly the way `/settings` was in
  // MESITA-1839. Config redirects run before filesystem routes.
  it("bare /organization is NOT forwarded — it is a live address", async () => {
    expect(resolve("/organization", await rules())).toBeNull();
  });

  it("/organization/new is the ceremony's new address", async () => {
    expect(resolve("/organization/new", await rules())).toBe("/orgs/new");
  });

  it("/places?org=<id> is that organization's list, filter intact", async () => {
    const all = await rules();
    expect(resolve("/places?org=org-9", all)).toBe("/orgs/org-9/places");
    expect(resolve("/places?owned=org&org=org-9", all)).toBe(
      "/orgs/org-9/places?owned=org",
    );
  });

  it("/places/new?org=<id> is that organization's claim ceremony", async () => {
    expect(resolve("/places/new?org=org-9", await rules())).toBe(
      "/orgs/org-9/places/new",
    );
  });

  it("the no-org list and claim forms are the resolver", async () => {
    const all = await rules();
    expect(resolve("/places", all)).toBe("/");
    expect(resolve("/places/new", all)).toBe("/");
  });

  it("/pool is the resolver too — the list lives under its organization", async () => {
    expect(resolve("/pool", await rules())).toBe("/");
  });

  it("a place route is NOT caught by the list's forward", async () => {
    // `/places` and `/places/new` are exact sources; `/places/<id>/…` is the
    // live place console and must fall through to it.
    const all = await rules();
    expect(resolve("/places/abc", all)).toBeNull();
    expect(resolve("/places/abc/profile", all)).toBeNull();
  });

  it("the has-rules sit ABOVE their bare twins — first match wins", async () => {
    const all = await rules();
    // `/organization` left this list in MESITA-1841: it has no bare twin any
    // more, because the bare address is a live page.
    for (const source of ["/places", "/places/new"]) {
      const withHas = all.findIndex((r) => r.source === source && r.has);
      const bare = all.findIndex((r) => r.source === source && !r.has);
      expect(withHas).toBeGreaterThan(-1);
      expect(bare).toBeGreaterThan(-1);
      expect(withHas).toBeLessThan(bare);
    }
    // The `?org=` rule for /organization survives WITHOUT a bare twin.
    expect(all.some((r) => r.source === "/organization" && r.has)).toBe(true);
    expect(all.some((r) => r.source === "/organization" && !r.has)).toBe(false);
  });
});

describe("every redirect forwards somewhere this repo serves", () => {
  // ONE rule is temporary, and it is named here so a second cannot appear by
  // accident. `/places/<id>/activity` forwards to a RESOLVER, and where a
  // place's numbers live has now moved once (MESITA-1841) — a 308 would cache
  // this answer in every browser forever.
  // TEMPORARY where the ANSWER has moved and could move again — a 308 caches
  // today's product decision in every browser that follows it, forever.
  // Activity moved from the place to the organization (MESITA-1841); Credits
  // moved out of Payments and back into it inside one day (MESITA-1841 →
  // MESITA-1845); the organization's own page has been Organization, then
  // Settings, then Configuration (MESITA-1846 → 1848 → 1852).
  // Payments joined them (MESITA-1869): a page that has been a row four
  // times and is now a card in a catalogue is the definition of an answer
  // that could move again.
  // And `configuration` joined them (MESITA-1871), swapping places with
  // `settings`: the organization's own page has now been called Organization,
  // Settings, Configuration and Settings again.
  const TEMPORARY = new Set([
    "/places/:id/activity",
    "/orgs/:orgId/configuration",
    "/configuration",
    "/orgs/:orgId/credits",
    // MESITA-1885: the three place segments that became products. Where the
    // place's switches live has now moved three times, and a 308 would cache
    // today's answer in every browser forever. `/places/:id/settings` moved
    // OFF permanent for the same reason — it used to point at `capabilities`,
    // a route this repo no longer serves.
    "/places/:id/settings",
    "/places/:id/capabilities",
    "/places/:id/rewards",
    "/capabilities",
    "/rewards",
    "/orgs/:orgId/payments",
    "/payments",
    "/orgs/:orgId/members",
    "/members",
  ]);

  it("permanent, except the forwards onto an answer that has moved", async () => {
    for (const rule of await rules()) {
      expect(rule.permanent, rule.source).toBe(!TEMPORARY.has(rule.source));
    }
  });

  it("a permanent rule never lands on a flat resolver", async () => {
    // A cached 308 onto `/profile` would pin a browser to whatever place it
    // resolved to the FIRST time — which is the bug MESITA-1832's cookie
    // addressing had. `/settings` -> `/capabilities` is the exception and is
    // safe: both sides are resolvers, so the answer is recomputed either way.
    for (const rule of await rules()) {
      if (!rule.permanent) continue;
      if (rule.source === "/settings") continue;
      expect(FLAT_ROUTE_LIST, rule.source).not.toContain(rule.destination);
    }
  });

  it("no rule forwards to a route this repo no longer serves", async () => {
    for (const rule of await rules()) {
      expect(rule.destination.startsWith("/place/")).toBe(false);
      // `/settings` was on this list until MESITA-1871 made it live again;
      // `/configuration` took its place as the name nothing may land on.
      expect(rule.destination).not.toBe("/configuration");
      expect(rule.destination).not.toBe("/orgs/:orgId/configuration");
      expect(rule.destination).not.toBe("/places");
      expect(rule.destination).not.toBe("/places/:id/settings");
      // MESITA-1885 deleted these two views. `/places/:id/settings` pointed
      // at `capabilities` until this issue, which is exactly the chain-onto-a
      // -deleted-route mistake this test exists to catch.
      expect(rule.destination).not.toBe("/places/:id/capabilities");
      expect(rule.destination).not.toBe("/places/:id/rewards");
    }
  });
});

// THE GUARD THIS FILE WAS MISSING (MESITA-1839).
//
// Every test above asks "does this DEAD address still land somewhere?". None
// asked the mirror question: "is this LIVE address still reachable?" So when
// MESITA-1832 named a page `/settings` — a path a MESITA-1564-era rule already
// forwarded to `/account` — nothing failed. Config redirects run before
// filesystem routes, so the page shipped unreachable and stayed that way,
// green, for a day.
//
// A redirect table and a route table are two halves of one namespace, and
// nothing was comparing them. This does.
describe("no live address is swallowed by the redirect table", () => {
  it("every SHELL_ROUTES entry falls through to its route", async () => {
    const all = await rules();
    for (const [name, href] of Object.entries(SHELL_ROUTES)) {
      expect(
        resolve(href, all),
        `SHELL_ROUTES.${name} (${href}) is caught by a redirect — the page at that path can never be reached`,
      ).toBeNull();
    }
  });

  it("every place view's address falls through", async () => {
    const all = await rules();
    for (const tab of PLACE_TABS) {
      const href = placeTabHref("abc", tab);
      expect(resolve(href, all), `${href} is caught by a redirect`).toBeNull();
    }
  });

  it("every organization page's address falls through", async () => {
    const all = await rules();
    for (const page of ORG_PAGES) {
      const href = orgHref("org-9", page);
      expect(resolve(href, all), `${href} is caught by a redirect`).toBeNull();
    }
    expect(resolve(orgPlacesNewHref("org-9"), all)).toBeNull();
  });

  // THE HALF THIS GUARD WAS STILL MISSING (MESITA-1841). The three tests above
  // walk the CANONICAL addresses. `/settings` — the address that actually
  // broke in MESITA-1839 — was a FLAT one, and flat addresses are exactly the
  // ones a legacy rule is likely to collide with, because they are short,
  // unscoped, and the console has used several of them for something else
  // before. `/organization` was one such collision waiting in this very
  // change.
  it("every FLAT address falls through — the shape that broke before", async () => {
    const all = await rules();
    for (const href of FLAT_ROUTE_LIST) {
      expect(
        resolve(href, all),
        `${href} is caught by a redirect — the resolver at that path can never be reached`,
      ).toBeNull();
    }
  });
});
