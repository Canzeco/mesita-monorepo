// Every URL the console ever owned must still land somewhere real.
//
// MESITA-1564 deleted `app/(console)` — 11 place routes plus /settings.
// MESITA-1807 moved the organization into the path, retiring `/organization`,
// `/organization/new`, the bare `/places` list and `/places/new`.
// MESITA-1892 deletes the organization outright, retiring every `/orgs/…`
// address and giving `/places` and `/places/new` back to the catalogue. Those
// URLs are in operators' bookmarks, in old emails, and — for
// `/orgs/<id>?connect=return` — stored on Stripe's side as the return_url of
// Account Links minted before the move. So the deletions are only safe if
// next.config.ts catches every one. This test is the proof: it walks the
// shapes the old console could emit and asserts each resolves the way Next
// will resolve it.
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import {
  FLAT_ROUTE_LIST,
  PLACE_PAGES,
  SHELL_ROUTES,
  placePageHref,
  placePayHref,
  placeRootHref,
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
  it("the ONE retired place segment lands on Visits, and nothing chains", async () => {
    // MESITA-1885 retired `capabilities` and `rewards` as views: the rail
    // lists all eight products and three of them were rows on the one
    // Capabilities page, so each product took a view of its own.
    //
    // REWARDS CAME BACK (MESITA-1900) and its two rules left in the same
    // commit — see the assertions at the foot of this test. Capabilities did
    // not: its six rows are six products, and landing on the container beats
    // guessing one of them.
    const all = await rules();
    expect(resolve("/places/abc/capabilities", all)).toBe("/places/abc/visits");
    // The absence IS the assertion: a rule here would shadow the live page.
    expect(resolve("/settings", all)).toBeNull();
    // AND `/places/<id>/settings` IS A LIVE PAGE NOW (MESITA-1892). It was
    // the retired spelling of a place view and forwarded to Visits; the place
    // has a Settings PAGE — the members and keys that used to hang off the
    // organization — so the rule had to go in the same commit or the page
    // would have shipped unreachable with every check green.
    // AND IT IS A RULE AGAIN (MESITA-1974), pointing the other way: Settings
    // left the place for `/settings`, so the old address forwards rather than
    // 404ing an operator with it bookmarked.
    expect(resolve("/places/abc/settings", all)).toBe("/settings");
    // NOTHING CHAINS: every destination is a route, not another source.
    expect(resolve("/places/abc/visits", all)).toBeNull();
    expect(resolve("/visits", all)).toBeNull();
    // AND THE FLAT `/credits` RULE IS GONE (MESITA-1885). Mesita Credits is a
    // rail row with a view of its own, so `/credits` is a live flat twin —
    // leaving the rule would have made it dead on arrival with every check
    // green, which is `/settings` in MESITA-1839 exactly.
    expect(resolve("/credits", all)).toBeNull();
    expect(resolve("/places/abc/credits", all)).toBeNull();
    // THE FLAT TWIN FORWARDS TOO, and forgetting it is the mirror of the
    // MESITA-1839 trap this file is mostly about: there a rule SHADOWED a
    // live address, here a MISSING rule strands a retired one. `/capabilities`
    // was a live flat resolver until MESITA-1885, and a name dropped from
    // `FLAT_ROUTES` does not fall through to anything — the `[flat]` segment
    // answers 404 for a name not in the contract, on purpose.
    expect(resolve("/capabilities", all)).toBe("/visits");
    // AND BOTH REWARDS RULES ARE GONE (MESITA-1900), which is the trap this
    // file exists for, seen from the shadow side. Pato's product list makes
    // Rewards a view again; `rewards` is back in `FLAT_ROUTES` and
    // `/places/<id>/rewards` is a route file. Either rule surviving would
    // 307 both addresses onto Visits forever, with every check green —
    // `/settings` in MESITA-1839, `/credits` in MESITA-1885, and this is the
    // third.
    expect(resolve("/rewards", all)).toBeNull();
    expect(resolve("/places/abc/rewards", all)).toBeNull();
  });

  it("a place's Activity is its own page again — no rule may catch it", async () => {
    // Activity moved up a scope in MESITA-1841 and this rule forwarded it to
    // the flat address. The organization is gone (MESITA-1892) and Activity is
    // the place's page at the address it started from, so the rule is deleted:
    // a config rule runs BEFORE filesystem routes, and leaving it would make
    // the page unreachable with every check green.
    const all = await rules();
    expect(resolve("/places/abc/activity", all)).toBeNull();
    expect(resolve("/activity", all)).toBeNull();
  });
});

// MESITA-1892. There is no organization, and every address that named one is
// in somebody's bookmarks.
describe("every organization address forwards", () => {
  it("each page lands on the flat twin that resolves the remembered place", async () => {
    const all = await rules();
    expect(resolve("/orgs/o1/settings", all)).toBe("/settings");
    expect(resolve("/orgs/o1/configuration", all)).toBe("/settings");
    expect(resolve("/orgs/o1/members", all)).toBe("/settings");
    expect(resolve("/members", all)).toBe("/settings");
    expect(resolve("/orgs/o1/products", all)).toBe("/setup");
    expect(resolve("/orgs/o1/products/pay", all)).toBe("/setup");
    expect(resolve("/orgs/o1/products/terminal", all)).toBe("/setup");
    expect(resolve("/orgs/o1/credits", all)).toBe("/setup");
    expect(resolve("/orgs/o1/payments", all)).toBe("/setup");
    expect(resolve("/payments", all)).toBe("/setup");
    // Customers is a product with a row in Setup and no page of its own
    // (MESITA-1974), so its org-era address follows the rest there.
    expect(resolve("/orgs/o1/customers", all)).toBe("/setup");
    expect(resolve("/orgs/o1/activity", all)).toBe("/activity");
  });

  it("the organization's list and ceremony become the console's own", async () => {
    const all = await rules();
    expect(resolve("/orgs/o1/places", all)).toBe("/places");
    expect(resolve("/orgs/o1/places/new", all)).toBe("/places/new");
  });

  it("the two addresses STRIPE stored land on `/`, query and all", async () => {
    // Stripe stores an Account Link's return_url when the link is MINTED, so
    // links created months ago point at the bare `/orgs/<id>` (and, older
    // still, `/organization?org=…`). `/` is the one address that reads
    // `?connect=` and hands the whole query to the selected place's Pay page.
    // Any other destination strands an owner who just spent eight minutes
    // uploading documents on a screen that does not know they came back.
    const all = await rules();
    expect(resolve("/orgs/org-9?connect=return", all)).toBe("/?connect=return");
    expect(resolve("/orgs/org-9?connect=refresh", all)).toBe("/?connect=refresh");
    expect(resolve("/organization?org=org-9&connect=return", all)).toBe(
      "/?org=org-9&connect=return",
    );
    expect(resolve("/orgs/org-9", all)).toBe("/");
    expect(resolve("/organization", all)).toBe("/");
  });

  it("the ceremony, the switcher and anything else land on the resolver", async () => {
    const all = await rules();
    expect(resolve("/orgs/new", all)).toBe("/");
    expect(resolve("/organization/new", all)).toBe("/");
    expect(resolve("/orgs/o1/switch?to=%2Fprofile", all)).toBe(
      "/?to=%2Fprofile",
    );
    // The catch-all sits LAST, so every named page above wins first.
    expect(resolve("/orgs/o1/whatever/else", all)).toBe("/");
  });

  it("an org invite lands on the page that accepts invites", async () => {
    // `organization_invites` is dropped, so a token in an old email cannot be
    // accepted by anything — but `/accept-invite` is the screen that can SAY
    // so, and a 404 could not.
    expect(resolve("/accept-org-invite?token=t", await rules())).toBe(
      "/accept-invite?token=t",
    );
  });

  it("/pool is the catalogue — the list it named is live again", async () => {
    expect(resolve("/pool", await rules())).toBe("/places");
  });
});

describe("every redirect forwards somewhere this repo serves", () => {
  // TEMPORARY where the ANSWER has moved and could move again — a 308 caches
  // today's product decision in every browser that follows it, forever.
  // Activity moved from the place to the organization and back (MESITA-1841 →
  // MESITA-1892); Credits moved out of Payments and back into it inside one
  // day; the organization's own page was Organization, then Settings, then
  // Configuration, then Settings again.
  //
  // EVERY `/orgs/…` RULE IS TEMPORARY (MESITA-1892), and for the reason this
  // file's own next rule states: they all land on a RESOLVER — `/` or a flat
  // name — whose answer depends on which place you opened last.
  const PERMANENT = new Set([
    "/unit/:id",
    "/unit/:id/:rest*",
    "/place/:id",
    "/place/:id/:rest*",
    "/pool",
    // THE FOUR-TAB MOVE (MESITA-1974). Each lands on a FIXED address — a
    // place-scoped one that carries its own `:id`, or `/settings`, which is a
    // real page and no longer a flat name — so a cached 308 can never pin a
    // browser to the wrong place. The flat `/products` and `/customers` are
    // deliberately NOT here for exactly that reason.
    "/places/:id/products/pay",
    "/places/:id/products",
    "/places/:id/customers",
    "/places/:id/settings",
    "/account",
  ]);

  it("permanent only where the destination is a fixed address", async () => {
    for (const rule of await rules()) {
      expect(rule.permanent, rule.source).toBe(PERMANENT.has(rule.source));
    }
  });

  it("a permanent rule never lands on a flat resolver", async () => {
    // A cached 308 onto `/profile` would pin a browser to whatever place it
    // resolved to the FIRST time — which is the bug MESITA-1832's cookie
    // addressing had.
    for (const rule of await rules()) {
      if (!rule.permanent) continue;
      expect(FLAT_ROUTE_LIST, rule.source).not.toContain(rule.destination);
      expect(rule.destination, rule.source).not.toBe("/");
    }
  });

  it("no rule forwards to a route this repo no longer serves", async () => {
    for (const rule of await rules()) {
      expect(rule.destination.startsWith("/place/")).toBe(false);
      expect(rule.destination.startsWith("/orgs/")).toBe(false);
      expect(rule.destination).not.toBe("/organization");
      expect(rule.destination).not.toBe("/configuration");
      // MESITA-1885 deleted `capabilities` as a view; MESITA-1892 made
      // `settings` a live page. A redirect onto a deleted route is the
      // `/unit/*` → `/place/*` chain again, and it fails silently because no
      // test walks a LEGACY source to its own destination — except the ones
      // above, which do.
      //
      // `/places/:id/rewards` LEFT THIS LIST (MESITA-1900) for the opposite
      // reason: it is a live route again, so a rule pointing AT it would be
      // fine and a rule pointing FROM it is the one that must not exist. The
      // test above asserts that absence.
      expect(rule.destination).not.toBe("/places/:id/capabilities");
      expect(rule.destination).not.toBe("/places/:id/settings");
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

  it("the catalogue and its ceremony fall through (MESITA-1892)", async () => {
    // Both were PERMANENT redirect sources — the riskiest deletions in
    // `next.config.ts`, because a 308 is cached on disk by every browser that
    // followed it. They are the catalogue and Add place now.
    const all = await rules();
    expect(resolve("/places", all)).toBeNull();
    expect(resolve("/places/new", all)).toBeNull();
    // And a place route was never caught by the list's forward either.
    expect(resolve("/places/abc", all)).toBeNull();
    expect(resolve("/places/abc/profile", all)).toBeNull();
  });

  it("every place view's address falls through", async () => {
    const all = await rules();
    for (const tab of PLACE_TABS) {
      const href = placeTabHref("abc", tab);
      expect(resolve(href, all), `${href} is caught by a redirect`).toBeNull();
    }
  });

  it("every place PAGE's address falls through", async () => {
    const all = await rules();
    for (const page of PLACE_PAGES) {
      const href = placePageHref("abc", page);
      expect(resolve(href, all), `${href} is caught by a redirect`).toBeNull();
    }
    expect(resolve(placePayHref("abc"), all)).toBeNull();
    // The bare place address is the Stripe catcher and must never forward.
    expect(resolve(placeRootHref("abc"), all)).toBeNull();
    expect(resolve(`${placeRootHref("abc")}?connect=return`, all)).toBeNull();
  });

  // THE HALF THIS GUARD WAS STILL MISSING (MESITA-1841). The three tests above
  // walk the CANONICAL addresses. `/settings` — the address that actually
  // broke in MESITA-1839 — was a FLAT one, and flat addresses are exactly the
  // ones a legacy rule is likely to collide with, because they are short,
  // unscoped, and the console has used several of them for something else
  // before.
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
