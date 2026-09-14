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
  ORG_PAGES,
  SHELL_ROUTES,
  orgHref,
  orgPlacesNewHref,
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
  it("/settings is NOT forwarded — it is a live address", async () => {
    expect(resolve("/settings", await rules())).toBeNull();
  });

  it("the Capabilities view forwards to Settings (MESITA-1815), one hop", async () => {
    const all = await rules();
    expect(resolve("/places/abc/capabilities", all)).toBe("/places/abc/settings");
    // The new address is a route, not a redirect — nothing chains.
    expect(resolve("/places/abc/settings", all)).toBeNull();
  });
});

// MESITA-1807. The organization moved from `?org=` into the path.
describe("the ?org= addresses forward into the path", () => {
  it("/organization?org=<id> is that organization's Overview", async () => {
    expect(resolve("/organization?org=org-9", await rules())).toBe(
      "/orgs/org-9",
    );
  });

  it("a Stripe return link minted before the move keeps its query", async () => {
    // Stripe stored `/organization?org=<id>&connect=return` when the Account
    // Link was minted. `org` becomes the segment; `connect` rides through to
    // Overview, which hands it on to Payments.
    expect(
      resolve("/organization?org=org-9&connect=return", await rules()),
    ).toBe("/orgs/org-9?connect=return");
  });

  it("/organization with no org is the resolver", async () => {
    expect(resolve("/organization", await rules())).toBe("/");
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
    for (const source of ["/organization", "/places", "/places/new"]) {
      const withHas = all.findIndex((r) => r.source === source && r.has);
      const bare = all.findIndex((r) => r.source === source && !r.has);
      expect(withHas).toBeGreaterThan(-1);
      expect(bare).toBeGreaterThan(-1);
      expect(withHas).toBeLessThan(bare);
    }
  });
});

describe("every redirect is permanent, and forwards somewhere this repo serves", () => {
  it("permanent — these moves are not coming back", async () => {
    for (const rule of await rules()) expect(rule.permanent).toBe(true);
  });

  it("no rule forwards to a route this repo no longer serves", async () => {
    for (const rule of await rules()) {
      expect(rule.destination.startsWith("/place/")).toBe(false);
      expect(rule.destination).not.toBe("/settings");
      expect(rule.destination).not.toBe("/places");
      expect(rule.destination.startsWith("/organization")).toBe(false);
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
});
