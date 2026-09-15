// The rail, RENDERED (MESITA-1807; six pages since MESITA-1832).
//
// Source-reading contracts cannot see two pills: two rows computing `active`
// for one pathname pass every regex and light up together on screen. This
// file renders the real Sidebar over a pathname matrix with a mocked router
// and counts `aria-current="page"` — exactly one, on every route, in every
// viewer state — and proves the rail at zero, at one, with no place, on a
// pool place, and at `w-16`. It is the strongest proof this app has: no
// browser can get past the OTP wall.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { resolveRailScope, type RailOrg } from "@/lib/rail-scope";
import {
  FLAT_ROUTES,
  FLAT_ROUTE_LIST,
  ORG_PAGES,
  RAIL_ROWS,
  SHELL_ROUTES,
  orgHref,
  orgPlacesNewHref,
} from "@/lib/console-routes";
import { PLACE_TABS, placeTabHref } from "@/lib/place-tabs";

/** The canonical address of a view on the fixture place the rail resolves. */
const view = (tab: (typeof PLACE_TABS)[number]) => placeTabHref("p-1", tab);

const nav = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(""),
}));

import { Sidebar } from "./Sidebar";

const ORGS: RailOrg[] = [
  {
    id: "org-a",
    name: "Strana Group",
    myRole: "owner",
    places: [
      { id: "p-1", name: "Strana Del Valle", photoUrl: null },
      { id: "p-2", name: "Strana Polanco", photoUrl: null },
    ],
  },
  { id: "org-b", name: "Org Test", myRole: "owner", places: [] },
];

/** A solo organization whose one place is the fixture `p-1`, so the canonical
 *  view addresses in this file resolve against it. */
const SOLO_AT_P1: RailOrg[] = [
  {
    id: "org-solo1",
    name: "Hoster",
    myRole: "owner",
    places: [{ id: "p-1", name: "Strana Del Valle", photoUrl: null }],
  },
];

/** The majority customer: one organization holding one place. */
const SOLO: RailOrg[] = [
  {
    id: "org-solo",
    name: "Pato",
    myRole: "owner",
    places: [{ id: "p-solo", name: "Hoster Brewing Company", photoUrl: null }],
  },
];

type Over = {
  organizations?: RailOrg[];
  isSuperAdmin?: boolean;
  viewerError?: boolean;
  collapsed?: boolean;
  rememberedPlaceId?: string | null;
  rememberedOrgId?: string | null;
  lastPlaceId?: string | null;
};

function scopeFor(pathname: string, over: Over = {}) {
  nav.pathname = pathname;
  const organizations = over.organizations ?? ORGS;
  return {
    organizations,
    scope: resolveRailScope({
      organizations,
      pathname,
      lastPlaceId: over.lastPlaceId ?? null,
      rememberedPlaceId: over.rememberedPlaceId ?? null,
      rememberedOrgId: over.rememberedOrgId ?? null,
    }),
  };
}

function render(pathname: string, over: Over = {}): string {
  const { organizations, scope } = scopeFor(pathname, over);
  return renderToStaticMarkup(
    <Sidebar
      scope={scope}
      organizations={organizations}
      isSuperAdmin={over.isSuperAdmin ?? false}
      viewerError={over.viewerError ?? false}
      accountLabel="pato@canzeco.com"
      collapsed={over.collapsed ?? false}
      onToggleCollapse={() => {}}
    />,
  );
}

const pills = (html: string) => html.match(/aria-current="page"/g) ?? [];
const hrefs = (html: string) => (html.match(/href="([^"]*)"/g) ?? []).map((m) => m.slice(6, -1));
const pillText = (html: string) =>
  (html.match(/<a[^>]*aria-current="page"[^>]*>[\s\S]*?<\/a>/)?.[0] ?? "").replace(/<[^>]+>/g, "");
const navOf = (html: string) => html.slice(html.indexOf("<nav"), html.indexOf("</nav>"));
/** The footer — Collapse alone since MESITA-1844, pinned so the rail's empty
 *  space falls above it rather than between two footer items. */
const footerOf = (html: string) => html.slice(html.indexOf("</nav>"));
const rows = (html: string) => html.match(/<a [^>]*href="[^"]*"/g) ?? [];
/** Every DESTINATION label, in render order. The two selectors render their
 *  subject's name in a different span, so they never appear here — a name is
 *  not a place to go (MESITA-1848). */
const labels = (html: string) =>
  (html.match(/<span class="truncate">([^<]*)<\/span>/g) ?? [])
    .map((m) => m.replace(/<[^>]+>/g, ""))
    // `Collapse` is the rail's own control, not a destination.
    .filter((l) => l !== "Collapse");

// THE ROW LIST IS NOT WRITTEN HERE. It is `RAIL_ROWS` in console-routes, and
// this file derives its expectations from it — so a row added there without a
// render is a failure, and a row rendered here without an address is too. A
// second hand-typed list is how the rail came to mean three different things
// in one document (MESITA-1879).
const ROW_LABEL: Record<string, string> = {
  settings: "Settings",
  products: "Products",
  customers: "Customers",
  activity: "Activity",
  profile: "Profile",
  menus: "Menus",
  reviews: "Reviews",
};
/** The seven, in `RAIL_ROWS` order, then Account at the foot. */
const RAIL_LABELS = RAIL_ROWS.map((r) =>
  ROW_LABEL[r.kind === "org" ? r.target : r.view],
);
const ALL_LABELS = [...RAIL_LABELS, "Account"];

describe("exactly one pill, on every route (MESITA-1879)", () => {
  const ROUTES: [string, string][] = [
    [SHELL_ROUTES.account, "Account"],
    // The create ceremony has no organization to name yet, so it lights
    // Settings — the row you would go back through.
    [SHELL_ROUTES.orgNew, "Settings"],
    [orgHref("org-a", "settings"), "Settings"],
    [orgHref("org-a", "products"), "Products"],
    [orgHref("org-a", "customers"), "Customers"],
    [orgHref("org-a", "activity"), "Activity"],
    [view("profile"), "Profile"],
    [view("menus"), "Menus"],
    [view("reviews"), "Reviews"],
    // The flat names an operator can still type light the same row while the
    // forward is in flight.
    [FLAT_ROUTES.customers, "Customers"],
    [FLAT_ROUTES.products, "Products"],
    [FLAT_ROUTES.activity, "Activity"],
    [FLAT_ROUTES.profile, "Profile"],
    [FLAT_ROUTES.menus, "Menus"],
    [FLAT_ROUTES.reviews, "Reviews"],
  ];
  for (const [pathname, label] of ROUTES) {
    it(`${pathname} lights ${label} and nothing else`, () => {
      const html = render(pathname, { rememberedPlaceId: "p-1" });
      expect(pills(html)).toHaveLength(1);
      expect(pillText(html)).toBe(label);
    });
  }

  // THE OTHER HALF OF THE CONTRACT (MESITA-1879). Capabilities, Rewards,
  // Places and Admin kept their addresses and lost their rows, so each must
  // light NOTHING — and "nothing" is a real answer here, not an oversight.
  // A row lighting for an address it does not own is the two-pill bug; an
  // address lighting a row that is not its own is the same bug, quieter.
  const ROWLESS = [
    view("capabilities"),
    view("rewards"),
    view("admin"),
    FLAT_ROUTES.capabilities,
    FLAT_ROUTES.rewards,
    FLAT_ROUTES.admin,
    orgHref("org-a", "places"),
    orgPlacesNewHref("org-a"),
  ];
  for (const pathname of ROWLESS) {
    it(`${pathname} is live and lights no row`, () => {
      const html = render(pathname, { rememberedPlaceId: "p-1", isSuperAdmin: true });
      expect(pills(html)).toHaveLength(0);
    });
  }

  it("never lights two rows, on any address in the whole vocabulary", () => {
    // The union of every address the console owns — canonical and flat — is
    // walked, and the rule is the same for all of them: at most one pill.
    const every = [
      ...FLAT_ROUTE_LIST,
      ...PLACE_TABS.map(view),
      ...ORG_PAGES.map((t) => orgHref("org-a", t)),
      SHELL_ROUTES.account,
      SHELL_ROUTES.orgNew,
      orgPlacesNewHref("org-a"),
    ];
    for (const href of every) {
      const n = pills(render(href, { isSuperAdmin: true, rememberedPlaceId: "p-1" })).length;
      expect(n, href).toBeLessThanOrEqual(1);
    }
  });

  it("the create ceremony never lights TWO rows", () => {
    expect(pillText(render(SHELL_ROUTES.orgNew, { rememberedPlaceId: "p-1" }))).toBe("Settings");
    expect(pills(render(SHELL_ROUTES.orgNew, { organizations: [] }))).toHaveLength(1);
    expect(pillText(render(SHELL_ROUTES.orgNew, { organizations: [] }))).toBe("Create organization");
  });
});

describe("one flat column, and Account at the foot (MESITA-1879)", () => {
  it("renders RAIL_ROWS in order, then Account — and nothing else", () => {
    const html = render(view("profile"), { rememberedPlaceId: "p-1", organizations: SOLO_AT_P1 });
    expect(labels(html)).toEqual(ALL_LABELS);
    expect(rows(html)).toHaveLength(8);
    // WHAT LOST ITS ROW. Each of these keeps its address and is reachable;
    // none is a row. Asserted by NAME, because the failure mode is a row
    // creeping back in a later pass without anyone noticing the column grew.
    for (const gone of ["Capabilities", "Rewards", "Places", "Admin"]) {
      expect(labels(html), gone).not.toContain(gone);
    }
    // NO WORDMARK (MESITA-1842). Pato: "no mesita logo, fuck it."
    expect(html).not.toContain("<svg viewBox=\"0 0 293.03 100\"");
    expect(html).not.toContain(">business<");
    // Credits and Payments are products, not rows (MESITA-1845, MESITA-1869).
    expect(labels(html)).not.toContain("Credits");
    expect(labels(html)).not.toContain("Payments");
    expect(hrefs(html).some((h) => h.includes("credits"))).toBe(false);
    expect(hrefs(html).some((h) => h.includes("payments"))).toBe(false);
    // NO ROW SAYS "SOON": Customers renders at full strength and its page
    // carries the badge (MESITA-1833).
    expect(html).not.toContain("Soon");
    // NO ID IS VISIBLE, though every href carries one (MESITA-1839).
    expect(labels(html).some((l) => l.includes("p-") || l.includes("org-"))).toBe(false);
  });

  it("has ONE depth: the selectors are gone, so nothing indents", () => {
    // The indent existed to say "these rows are under that selector". With no
    // selector there is nothing to sit under, and an indent would be a tree
    // line drawn from nowhere.
    const n = navOf(render(view("profile"), { rememberedPlaceId: "p-1", organizations: SOLO_AT_P1 }));
    expect(n).not.toContain("pl-7");
    expect(n).not.toContain("pl-6");
    expect(n).not.toContain("pl-10");
    expect(n).not.toContain("border-l");
    expect(n).not.toContain("list-disc");
    // ONE SEAM IN THE NAV, over Account — the person, below the business.
    // The footer's own, over Collapse, is the second and last.
    expect((n.match(/border-t/g) ?? []).length).toBe(1);
    expect((footerOf(render(view("profile"), { rememberedPlaceId: "p-1" })).match(/border-t/g) ?? []).length).toBe(1);
    // The seam is a wrapper's border, never a row's: a row that grew a rule
    // would be a second row shape.
    expect(n).not.toMatch(/<a [^>]*class="[^"]*border-t/);
  });

  it("each row wears the mark of its subject", () => {
    const html = render(view("profile"), { rememberedPlaceId: "p-1", organizations: SOLO_AT_P1 });
    for (const mark of [
      "lucide-settings", // Settings — the gear (MESITA-1871)
      "lucide-store", // Profile — the place's public page
      "lucide-utensils-crossed", // Menus — what the place serves
      "lucide-star", // Reviews
      "lucide-layout-grid", // Products — the catalogue IS a grid of tiles
      "lucide-users", // Customers — people, plural, against Account's one
      "lucide-chart-no-axes-column", // Activity — counts over time
      "lucide-user-round", // Account — the person, one of them
    ]) {
      expect(html, mark).toContain(mark);
    }
    // The marks that left WITH their rows. Each still exists in the app on
    // the page it belongs to; none belongs in this column any more.
    for (const gone of [
      "lucide-layers", // Places
      "lucide-sliders-horizontal", // Capabilities
      "lucide-gift", // Rewards
      "lucide-shield", // Admin
    ]) {
      expect(html, gone).not.toContain(gone);
    }
    // And the marks that never belonged.
    expect(html).not.toContain("lucide-coins");
    expect(html).not.toContain("lucide-wallet");
    expect(html).not.toContain("lucide-building2");
    expect(html).not.toContain("lucide-cog");
    expect(html).not.toContain("lucide-settings-2");
    // The gear is on ONE row: a second would be two screens claiming to be
    // where you configure things.
    expect(html.match(/lucide-settings\b/g) ?? []).toHaveLength(1);
  });

  it("the rows are the CANONICAL addresses — one hop, and shareable", () => {
    const html = render(view("profile"), { rememberedPlaceId: "p-1", organizations: SOLO_AT_P1 });
    expect(hrefs(html)).toEqual([
      orgHref("org-solo1", "settings"),
      view("profile"),
      view("menus"),
      view("reviews"),
      orgHref("org-solo1", "products"),
      orgHref("org-solo1", "customers"),
      orgHref("org-solo1", "activity"),
      SHELL_ROUTES.account,
    ]);
  });

  it("the Account row says the page; the email is its tooltip", () => {
    const html = render(view("profile"), { rememberedPlaceId: "p-1" });
    expect(html).toContain(">Account<");
    expect(html).toContain('title="Account · pato@canzeco.com"');
    expect(html).not.toContain(">pato@canzeco.com<");
  });

  it("a viewer loses no row: the two that write had none to lose", () => {
    // Capabilities and Rewards both WRITE, and the matrix still withholds
    // them from a viewer — but neither is a row any more, so a viewer's
    // column is the SAME seven. The role gate did not move: it is still
    // `tabsForAccess`, still enforced by PlaceTabGate on a typed URL.
    const viewer: RailOrg[] = [{ ...SOLO_AT_P1[0], myRole: "viewer" }];
    const html = render(FLAT_ROUTES.profile, { organizations: viewer, rememberedPlaceId: "p-1" });
    expect(labels(html)).toEqual(ALL_LABELS);
  });
});

describe("the four shapes the console can be in (MESITA-1879)", () => {
  it("zero organizations: Account and Create organization, nothing else", () => {
    const html = render(SHELL_ROUTES.orgNew, { organizations: [] });
    expect(labels(html)).toEqual(["Create organization", "Account"]);
    expect(pills(html)).toHaveLength(1);
    expect(pillText(html)).toBe("Create organization");
  });

  it("unknown — the read FAILED: a muted line, never the create row", () => {
    // MESITA-1793's law. And it must not read as the ZERO state either: an
    // empty array is a successful read of nothing, which gets a different
    // screen entirely.
    const html = render(SHELL_ROUTES.account, { organizations: [], viewerError: true });
    expect(html).toContain("Couldn&#x27;t load organizations");
    expect(html).not.toContain("Create organization");
    // One link in the landmark: Account. The muted line is a div, not a row.
    expect(rows(html)).toHaveLength(1);
    expect(pillText(html)).toBe("Account");
  });

  it("zero PLACES: the ceremony, the org's pages, and no row about a place", () => {
    // The filter, not a second array. The PLACE rows go — a place row with no
    // place opens a page about nothing, which is the "a row lands somewhere
    // real" law failing quietly (MESITA-1833). The ORGANIZATION rows stay:
    // each is a real page that works with no place, and Products is where the
    // cards say "Add a place".
    //
    // And the ceremony takes a row, which it does in no other state. A rail
    // with no door to the one thing a new operator came to do is a worse
    // empty state than a muted row ever was — and production holds zero
    // places, so this is every fresh environment.
    const html = render(SHELL_ROUTES.account, {
      organizations: [{ id: "org-b", name: "Org Test", myRole: "owner", places: [] }],
      rememberedOrgId: "org-b",
    });
    expect(labels(html)).toEqual([
      "Add your place",
      "Settings",
      "Products",
      "Customers",
      "Activity",
      "Account",
    ]);
    expect(hrefs(html)).toEqual([
      orgPlacesNewHref("org-b"),
      orgHref("org-b", "settings"),
      orgHref("org-b", "products"),
      orgHref("org-b", "customers"),
      orgHref("org-b", "activity"),
      SHELL_ROUTES.account,
    ]);
    // No place row, by name: the failure mode is one creeping back.
    for (const gone of ["Profile", "Menus", "Reviews"]) {
      expect(labels(html), gone).not.toContain(gone);
    }
    expect(html).not.toContain("opacity-60");
  });

  it("zero places, and NOT the owner: the pages stay, the ceremony does not", () => {
    // Add place is owner-only (`canAddPlace`, matching the EF's own guard), so
    // an editor gets no row for a door that would 403. They are not stranded:
    // the organization's pages are all still there.
    const html = render(SHELL_ROUTES.account, {
      organizations: [{ id: "org-b", name: "Org Test", myRole: "editor", places: [] }],
      rememberedOrgId: "org-b",
    });
    expect(labels(html)).toEqual(["Settings", "Products", "Customers", "Activity", "Account"]);
  });

  it("solo — the customer this console is for: seven rows, nothing muted", () => {
    const html = render(FLAT_ROUTES.reviews, { organizations: SOLO });
    expect(labels(html)).toEqual(ALL_LABELS);
    expect(html).not.toContain("opacity-60");
    expect(pillText(html)).toBe("Reviews");
    // NO SELECTOR. One organization, one place: neither control has anything
    // to select, and a control over nothing is the thing this issue removed.
    expect(html).not.toContain('aria-label="Switch organization"');
    expect(html).not.toContain('aria-label="Switch place"');
  });

  it("multi — two places: the selector comes back, and nothing is picked for you", () => {
    // The franchise path is DEFERRED, not deleted. `RailSelector` still
    // renders, still switches, still guards — behind the one condition where
    // the question is real.
    const html = render(SHELL_ROUTES.account, { rememberedOrgId: "org-a" });
    expect(html).toContain('aria-label="Switch place"');
    expect(html).toContain(">Pick a place<");
    // The rows still render; none of them lights, because no address names a
    // place and the rail refuses to choose one.
    expect(labels(html)).toEqual(ALL_LABELS);
    expect(pillText(html)).toBe("Account");
  });

  it("multi — but the ADDRESS names one: that place's rows light normally", () => {
    const html = render(view("menus"), { rememberedOrgId: "org-a" });
    expect(html).toContain('aria-label="Switch place"');
    expect(html).toContain(">Strana Del Valle<");
    expect(pills(html)).toHaveLength(1);
    expect(pillText(html)).toBe("Menus");
  });

  it("two organizations: the org selector returns too, on its own axis", () => {
    // Multi-ORG and multi-PLACE are different questions. An operator in two
    // organizations each holding one place gets the org selector and a flat
    // place column.
    const html = render(view("profile"), { rememberedPlaceId: "p-1" });
    expect(html).toContain('aria-label="Switch organization"');
    expect(html).toContain(">Strana Group<");
  });

  it("a pool place published by the layout: Profile alone among the place rows", () => {
    const html = render(FLAT_ROUTES.profile, { lastPlaceId: "p-x" });
    expect(labels(html)).toEqual(["Settings", "Profile", "Products", "Customers", "Activity", "Account"]);
    expect(pills(html)).toHaveLength(1);
    expect(pillText(html)).toBe("Profile");
  });

  it("collapsed: every label a title, one pill, the same seams", () => {
    const html = render(FLAT_ROUTES.reviews, { collapsed: true, organizations: SOLO });
    expect(rows(html)).toHaveLength(8);
    expect(html).toContain('title="Reviews"');
    expect(html).toContain('title="Settings"');
    expect(html).toContain('title="Account · pato@canzeco.com"');
    expect(pills(html)).toHaveLength(1);
    // Every row has a glyph, which is the whole reason `w-16` is legible.
    const n = navOf(html);
    expect((n.match(/border-t/g) ?? []).length).toBe(1);
    expect((footerOf(html).match(/border-t/g) ?? []).length).toBe(1);
  });
});
