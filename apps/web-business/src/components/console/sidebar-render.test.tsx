// The rail, RENDERED (MESITA-1807; six pages since MESITA-1832).
//
// Source-reading contracts cannot see two pills: two rows computing `active`
// for one pathname pass every regex and light up together on screen. This
// file renders the real Sidebar over a pathname matrix with a mocked router
// and counts `aria-current="page"` — exactly one, on every route, in every
// viewer state — and proves the rail at zero, at one, with no place, on a
// pool place, and at `w-16`. It is the strongest proof this app has: no
// browser can get past the OTP wall.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { resolveRailScope, type RailOrg } from "@/lib/rail-scope";
import {
  FLAT_ROUTES,
  FLAT_ROUTE_LIST,
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

describe("exactly one pill, on every route (MESITA-1832)", () => {
  const ROUTES: [string, string][] = [
    [SHELL_ROUTES.account, "Account"],
    // The create ceremony has no organization to name yet, so it lights
    // Settings — the row you would go back through (MESITA-1848).
    [SHELL_ROUTES.orgNew, "Settings"],
    [orgHref("org-a", "settings"), "Settings"],
    // Places has a row of its own, and Add place is its list's own step.
    [orgHref("org-a", "places"), "Places"],
    [orgPlacesNewHref("org-a"), "Places"],
    // The canonical addresses the rail links to (MESITA-1839)…
    [orgHref("org-a", "customers"), "Customers"],
    [orgHref("org-a", "payments"), "Payments"],
    [orgHref("org-a", "activity"), "Activity"],
    [view("profile"), "Profile"],
    [view("menus"), "Menus"],
    [view("reviews"), "Reviews"],
    [view("capabilities"), "Capabilities"],
    [view("rewards"), "Rewards"],
    // …and the flat ones an operator can still type, which light the same
    // row while the forward is in flight.
    [FLAT_ROUTES.customers, "Customers"],
    [FLAT_ROUTES.payments, "Payments"],
    [FLAT_ROUTES.activity, "Activity"],
    [FLAT_ROUTES.profile, "Profile"],
    [FLAT_ROUTES.menus, "Menus"],
    [FLAT_ROUTES.reviews, "Reviews"],
    [FLAT_ROUTES.capabilities, "Capabilities"],
    [FLAT_ROUTES.rewards, "Rewards"],
  ];
  for (const [pathname, label] of ROUTES) {
    it(`${pathname} lights ${label} and nothing else`, () => {
      const html = render(pathname, { rememberedPlaceId: "p-1" });
      expect(pills(html)).toHaveLength(1);
      expect(pillText(html)).toBe(label);
    });
  }

  it("every view in the vocabulary lights its own row, for the owner super-admin, at both widths", () => {
    for (const tab of PLACE_TABS) {
      for (const collapsed of [false, true]) {
        const html = render(view(tab), { isSuperAdmin: true, rememberedPlaceId: "p-1", collapsed });
        expect(pills(html), `${tab} ${collapsed}`).toHaveLength(1);
        expect(pillText(html)).toBe(tab.charAt(0).toUpperCase() + tab.slice(1));
      }
    }
  });

  it("one pill on every flat address", () => {
    for (const href of FLAT_ROUTE_LIST) {
      expect(pills(render(href, { isSuperAdmin: true, rememberedPlaceId: "p-1" })), href).toHaveLength(1);
    }
  });

  it("the create ceremony never lights TWO rows", () => {
    // `/orgs/new` is the one address two `active` expressions could both claim
    // — Account owned it until MESITA-1841, and the organization's own first
    // page owns it now. With no organization at all it belongs to Create.
    expect(pillText(render(SHELL_ROUTES.orgNew, { rememberedPlaceId: "p-1" }))).toBe("Settings");
    expect(pills(render(SHELL_ROUTES.orgNew, { organizations: [] }))).toHaveLength(1);
    expect(pillText(render(SHELL_ROUTES.orgNew, { organizations: [] }))).toBe("Create organization");
  });

  it("Settings shows its people and places rather than doors to them", () => {
    // MESITA-1847: Pato, "fuck nested things display shit there."
    const page = readFileSync(
      join(process.cwd(), "src/app/(shell)/orgs/[orgId]/settings/page.tsx"),
      "utf8",
    );
    expect(page).toContain("<MembersCard");
    expect(page).toContain("orgPlacesNewHref(org.id)");
  });
});

describe("three sections: account, then two selectors over their pages (MESITA-1848)", () => {
  // The labels an operator reads, top to bottom. The two SELECTOR rows are
  // not in this list — they render names, not destinations.
  const ORG_FIVE = ["Settings", "Places", "Customers", "Payments", "Activity"];
  const PLACE_FIVE = ["Profile", "Menus", "Reviews", "Capabilities", "Rewards"];

  it("are Account, the organization's five, then the place's — Admin only for a super-admin", () => {
    const html = render(view("profile"), { rememberedPlaceId: "p-1" });
    expect(labels(html)).toEqual(["Account", ...ORG_FIVE, ...PLACE_FIVE]);
    expect(rows(html)).toHaveLength(11);
    // NO WORDMARK (MESITA-1842). Pato: "no mesita logo, fuck it."
    expect(html).not.toContain("<svg viewBox=\"0 0 293.03 100\"");
    expect(html).not.toContain(">business<");
    // CREDITS MERGED INTO PAYMENTS (MESITA-1845): no row, and no address.
    expect(labels(html)).not.toContain("Credits");
    expect(hrefs(html).some((h) => h.includes("credits"))).toBe(false);
    // AND NO ROW SAYS "SOON". Customers renders at full strength like every
    // other row; its page carries the badge (MESITA-1833).
    expect(html).not.toContain("Soon");
    const admin = render(view("profile"), { rememberedPlaceId: "p-1", isSuperAdmin: true });
    expect(labels(admin)).toEqual(["Account", ...ORG_FIVE, ...PLACE_FIVE, "Admin"]);
    expect(hrefs(admin)).toContain(view("admin"));

    // NO ID IS VISIBLE. The hrefs carry one since MESITA-1839 — that is the
    // point: a rail row is the canonical address, so a click costs one hop
    // and the URL it lands on can be sent to someone. What MESITA-1832's law
    // protects is what the OPERATOR meets: words, no id, no switcher.
    expect(labels(html).some((l) => l.includes("p-1") || l.includes("org-a"))).toBe(false);
    // THE NAMES ARE THE SELECTORS' (MESITA-1848), and they are the only names
    // in the column: no eyebrow restating them, no `role="group"`. A name is
    // never a DESTINATION label, which is what `labels()` reads.
    expect(navOf(html)).toContain("Strana Group");
    expect(navOf(html)).toContain("Strana Del Valle");
    expect(labels(html)).not.toContain("Strana Group");
    expect(navOf(html)).not.toContain("tracking-[0.14em]");
    expect(html).not.toContain('role="group"');
  });

  // ONE INDENT, ONE DEPTH (MESITA-1844). MESITA-1842 restored the flat law
  // and this overturns it: the place's five are ABOUT a place, and Places is
  // the row they belong to. What stays banned is every form that was only
  // ever decoration, and a second depth — the point a rail becomes a tree.
  it("every page indents under its selector, and nothing goes two deep", () => {
    const html = render(view("profile"), { rememberedPlaceId: "p-1", isSuperAdmin: true });
    const n = navOf(html);
    const indented = (n.match(/<a [^>]*class="[^"]*pl-7[^"]*"[^>]*>[\s\S]*?<\/a>/g) ?? []).map(
      (m) => m.replace(/<[^>]+>/g, ""),
    );
    expect(indented).toEqual([...ORG_FIVE, ...PLACE_FIVE, "Admin"]);
    // ONE depth: one indent class in the whole column, never a second step.
    expect(n).not.toContain("pl-14");
    expect(n).not.toContain("pl-10");
    // And no decoration doing the same job twice.
    expect(n).not.toContain("border-l");
    expect(n).not.toContain("list-disc");
    // The nav carries NO seam — the one seam in the rail is the footer's.
    expect(n).not.toContain("border-t");
    expect((footerOf(html).match(/border-t/g) ?? []).length).toBe(1);
  });

  it("at w-16 nothing indents: there is no label to align to", () => {
    const n = navOf(render(view("profile"), { rememberedPlaceId: "p-1", collapsed: true }));
    expect(n).not.toContain("pl-7");
    expect(n).not.toContain("pl-6");
  });

  // MESITA-1838, extended by MESITA-1841 and MESITA-1844 to the rows that did
  // not exist then. Pinned so an icon swap is a deliberate edit, never a drift.
  it("each row wears the mark of its subject", () => {
    const html = render(view("profile"), { rememberedPlaceId: "p-1", isSuperAdmin: true });
    for (const mark of [
      "lucide-user-round", // Account — the person, one of them
      "lucide-cog", // Settings — the organization's own record
      "lucide-users", // Customers — people, plural, against Account's one
      "lucide-wallet", // Payments — the purse, not one card
      "lucide-chart-no-axes-column", // Activity — counts over time
      "lucide-layers", // Places — a stack of them
      "lucide-store", // Profile — the place's public page
      "lucide-utensils-crossed", // Menus — what the place serves
      "lucide-star", // Reviews
      "lucide-sliders-horizontal", // Capabilities — the page's own mark
      "lucide-gift", // Rewards — what a guest gets back
      "lucide-shield", // Admin
    ]) {
      expect(html, mark).toContain(mark);
    }
    // Coins left the app with the Credits page (MESITA-1845) and must not
    // creep back: there is no Credits row and no Credits address to wear it.
    expect(html).not.toContain("lucide-coins");
    // The organization's SELECTOR wears its initial, not an icon: a name is
    // what tells one organization from another, and a glyph would be the same
    // on all of them (MESITA-1848).
    expect(html).not.toContain("lucide-building2");
    // Nor the marks these rows replaced.
    expect(html).not.toContain("lucide-file-text");
    expect(html).not.toContain("lucide-credit-card");
    expect(html).not.toContain("lucide-settings-2");
    // The gear belongs to Settings, which IS a preferences page. Capabilities
    // is a ladder of what a guest can do, and wears sliders.
    expect(html).not.toContain("lucide-settings ");
  });

  it("the rows are the CANONICAL addresses — one hop, and shareable", () => {
    const html = render(view("profile"), { rememberedPlaceId: "p-1" });
    expect(hrefs(html)).toEqual([
      // The menus are closed, so their ceremonies are not in the markup —
      // what the rail RENDERS is the destinations.
      SHELL_ROUTES.account,
      orgHref("org-a", "settings"),
      orgHref("org-a", "places"),
      orgHref("org-a", "customers"),
      orgHref("org-a", "payments"),
      orgHref("org-a", "activity"),
      view("profile"),
      view("menus"),
      view("reviews"),
      view("capabilities"),
      view("rewards"),
    ]);
  });

  it("with NO place selected the place rows fall back to the flat addresses", () => {
    // An organization holding nothing has no `/places/<id>/…` to name, and a
    // row must still be a live link onto a real next step (MESITA-1833). The
    // organization's five still name their organization — it exists.
    const html = render(SHELL_ROUTES.account, {
      organizations: [{ id: "org-b", name: "Org Test", myRole: "owner", places: [] }],
      rememberedOrgId: "org-b",
    });
    expect(hrefs(html)).toEqual([
      SHELL_ROUTES.account,
      orgHref("org-b", "settings"),
      orgHref("org-b", "places"),
      orgHref("org-b", "customers"),
      orgHref("org-b", "payments"),
      orgHref("org-b", "activity"),
      FLAT_ROUTES.profile,
      FLAT_ROUTES.menus,
      FLAT_ROUTES.reviews,
      FLAT_ROUTES.capabilities,
      FLAT_ROUTES.rewards,
    ]);
  });

  it("the Account row says the page; the email is its tooltip", () => {
    const html = render(view("profile"), { rememberedPlaceId: "p-1" });
    expect(html).toContain(">Account<");
    expect(html).toContain('title="Account · pato@canzeco.com"');
    expect(html).not.toContain(">pato@canzeco.com<");
  });

  it("a viewer keeps the read surfaces and loses the two that write", () => {
    const viewer: RailOrg[] = [{ ...ORGS[0], myRole: "viewer" }];
    const html = render(FLAT_ROUTES.profile, { organizations: viewer, rememberedPlaceId: "p-1" });
    // Capabilities and Rewards both WRITE, so the matrix withholds both. The
    // viewer did not lose a third surface: Activity is the organization's page
    // now, and every member of the organization can open it (MESITA-1841).
    expect(labels(html)).toEqual(["Account", ...ORG_FIVE, "Profile", "Menus", "Reviews"]);
  });
});

describe("the states a 10/10 has to answer", () => {
  const ORG_FIVE = ["Settings", "Places", "Customers", "Payments", "Activity"];
  const PLACE_FIVE = ["Profile", "Menus", "Reviews", "Capabilities", "Rewards"];

  it("zero organizations: Account and Create organization, nothing else", () => {
    const html = render(SHELL_ROUTES.orgNew, { organizations: [] });
    expect(labels(html)).toEqual(["Account", "Create organization"]);
    expect(pills(html)).toHaveLength(1);
    expect(pillText(html)).toBe("Create organization");
  });

  it("the organizations failed to load: Account and a muted line, NEVER the create row", () => {
    const html = render(SHELL_ROUTES.account, { organizations: [], viewerError: true });
    expect(html).toContain("Couldn&#x27;t load organizations");
    expect(html).not.toContain("Create organization");
    // One link in the landmark: Account. The muted line is a div, not a row.
    expect(rows(html)).toHaveLength(1);
    expect(pillText(html)).toBe("Account");
  });

  // MESITA-1833: they used to render at opacity-60 with an "add a place
  // first" tooltip. Every one of them is a live link that lands on
  // NoPlaceYet — a real next step — so the disabled look was a lie, and with
  // an empty catalogue it was the FIRST thing a new operator saw. Nothing in
  // this rail may paint a working row as dead.
  it("an organization holding no place: the rows STAY, at FULL STRENGTH, one pill", () => {
    const html = render(FLAT_ROUTES.profile, { rememberedOrgId: "org-b" });
    expect(labels(html)).toEqual(["Account", ...ORG_FIVE, ...PLACE_FIVE]);
    expect(html).not.toContain("opacity-60");
    expect(html).not.toContain("add a place first");
    expect(pills(html)).toHaveLength(1);
    expect(pillText(html)).toBe("Profile");
  });

  it("the majority customer: one organization, one place — the same ten rows, nothing muted", () => {
    const html = render(FLAT_ROUTES.reviews, { organizations: SOLO });
    expect(labels(html)).toEqual(["Account", ...ORG_FIVE, ...PLACE_FIVE]);
    expect(html).not.toContain("opacity-60");
    expect(pillText(html)).toBe("Reviews");
  });

  it("a pool place published by the layout: Profile alone among the place rows, still one pill", () => {
    const html = render(FLAT_ROUTES.profile, { lastPlaceId: "p-x" });
    expect(labels(html)).toEqual(["Account", ...ORG_FIVE, "Profile"]);
    expect(pills(html)).toHaveLength(1);
    expect(pillText(html)).toBe("Profile");
  });

  it("collapsed: every label a title, one pill, one seam in the whole rail", () => {
    const html = render(FLAT_ROUTES.capabilities, { collapsed: true, rememberedPlaceId: "p-1" });
    expect(rows(html)).toHaveLength(11);
    expect(html).toContain('title="Capabilities"');
    expect(html).toContain('title="Settings"');
    expect(html).toContain('title="Account · pato@canzeco.com"');
    expect(pills(html)).toHaveLength(1);
    // The nav is one run of marks; the only seam is the footer's, above the
    // rail's own control.
    const n = navOf(html);
    expect((n.match(/border-t/g) ?? []).length).toBe(0);
    expect((footerOf(html).match(/border-t/g) ?? []).length).toBe(1);
  });
});


describe("the two selectors head their groups, in the rail (MESITA-1848)", () => {
  // Pato: "better three sections — ACCOUNT SELECTOR (no subitems) /
  // ORGANIZATION SELECTOR … / PLACE SELECTOR …". The rail answers "which" and
  // "where" in one column; the answer had lived on a page, then on Account,
  // then split in two, in the three issues before this one.
  it("renders BOTH selectors, each a trigger, never a pill", () => {
    const html = render(view("profile"), { rememberedPlaceId: "p-1" });
    expect(html).toContain('aria-label="Switch organization"');
    expect(html).toContain('aria-label="Switch place"');
    expect(html).toContain(">Strana Group<");
    expect(html).toContain(">Strana Del Valle<");
    // Two triggers, and the pill is still the ROW you are on — a selector is
    // never "you are here", it is "which one".
    expect((html.match(/<button/g) ?? []).length).toBe(3); // two selectors + Collapse
    expect(pills(html)).toHaveLength(1);
    expect(pillText(html)).toBe("Profile");
  });

  // MESITA-1818, 3A. A selector with nothing to switch is a NAME: no chevron
  // at one organization or one place, and the row still opens its menu.
  it("with one organization holding one place, both are names: no chevron", () => {
    const html = render(FLAT_ROUTES.profile, { organizations: SOLO });
    expect(html).toContain(">Pato<");
    expect(html).toContain(">Hoster Brewing Company<");
    expect(html).not.toContain("lucide-chevrons-up-down");
  });

  it("two organizations, two places: a chevron on each", () => {
    const html = render(view("profile"), { rememberedPlaceId: "p-1" });
    expect((html.match(/lucide-chevrons-up-down/g) ?? []).length).toBe(2);
  });

  // The meta the menu would hide rides ON the trigger (MESITA-1833): the role
  // and the holding, and which organization the place belongs to.
  it("each selector states its scope on the trigger, not one click behind it", () => {
    const html = render(FLAT_ROUTES.reviews, { organizations: SOLO });
    expect(html).toContain(">Owner · 1 place<");
    expect(html).toContain(">In Pato<");
  });

  // MESITA-1833: the zero-places row is an EMPTY STATE, not a name.
  it("an organization holding no place says so, and still offers Add place", () => {
    const html = render(FLAT_ROUTES.profile, { rememberedOrgId: "org-b" });
    expect(html).toContain(">Add your first place<");
    expect(html).toContain(">Nothing to switch between yet<");
  });

  // At w-16 there is no label to align to: each selector is its chip, and the
  // accessible name rides aria-label, which is on it at every width.
  it("collapsed, each selector is its chip and keeps its name", () => {
    const html = render(view("profile"), { collapsed: true, rememberedPlaceId: "p-1" });
    expect(html).toContain('aria-label="Switch organization"');
    expect(html).toContain('aria-label="Switch place"');
    expect(html).not.toContain(">Strana Group<");
    expect(html).not.toContain("lucide-chevrons-up-down");
  });
});
