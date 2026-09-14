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

const read_ui = () =>
  readFileSync(join(process.cwd(), "src/lib/ui-classes.ts"), "utf8");

const nav = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(""),
}));

import { Sidebar } from "./Sidebar";
import { RailScopeProvider } from "./RailScopeContext";
import { ScopeSwitchers } from "./ScopeSwitchers";

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

function renderSwitchers(pathname: string, over: Over = {}): string {
  const { organizations, scope } = scopeFor(pathname, over);
  return renderToStaticMarkup(
    <RailScopeProvider value={{ scope, organizations, isSuperAdmin: over.isSuperAdmin ?? false }}>
      <ScopeSwitchers />
    </RailScopeProvider>,
  );
}

const pills = (html: string) => html.match(/aria-current="page"/g) ?? [];
const hrefs = (html: string) => (html.match(/href="([^"]*)"/g) ?? []).map((m) => m.slice(6, -1));
const pillText = (html: string) =>
  (html.match(/<a[^>]*aria-current="page"[^>]*>[\s\S]*?<\/a>/)?.[0] ?? "").replace(/<[^>]+>/g, "");
const navOf = (html: string) => html.slice(html.indexOf("<nav"), html.indexOf("</nav>"));
/** The footer — Account and Collapse — which sits BELOW the landmark since
 *  MESITA-1842, pinned so the rail's empty space falls under it rather than
 *  between its two items. */
const footerOf = (html: string) => html.slice(html.indexOf("</nav>"));
const rows = (html: string) => html.match(/<a [^>]*href="[^"]*"/g) ?? [];
/** Every row label in the rail, nav then footer, in render order. */
const labels = (html: string) =>
  (html.match(/<span class="truncate">([^<]*)<\/span>/g) ?? [])
    .map((m) => m.replace(/<[^>]+>/g, ""))
    // `Collapse` is the rail's own control, not a destination.
    .filter((l) => l !== "Collapse");
/** The GROUP HEADERS, in order: each group's subject, by name. */
const groups = (html: string) =>
  (navOf(html).match(/tracking-\[0\.14em\][^"]*">([^<]*)</g) ?? []).map((m) =>
    m.slice(m.indexOf(">") + 1, -1),
  );

describe("exactly one pill, on every route (MESITA-1832)", () => {
  const ROUTES: [string, string][] = [
    [SHELL_ROUTES.account, "Account"],
    // The ORGANIZATION owns its doors now (MESITA-1841): Members, the places
    // list and Add place all light the row you would go back through.
    [SHELL_ROUTES.orgNew, "Organization"],
    [orgHref("org-a", "organization"), "Organization"],
    [orgHref("org-a", "places"), "Organization"],
    [orgPlacesNewHref("org-a"), "Organization"],
    [orgHref("org-a", "members"), "Organization"],
    // The canonical addresses the rail links to (MESITA-1839)…
    [orgHref("org-a", "payments"), "Payments"],
    [orgHref("org-a", "credits"), "Credits"],
    [orgHref("org-a", "activity"), "Activity"],
    [view("profile"), "Profile"],
    [view("reviews"), "Reviews"],
    [view("capabilities"), "Capabilities"],
    [view("rewards"), "Rewards"],
    // …and the flat ones an operator can still type, which light the same
    // row while the forward is in flight.
    [FLAT_ROUTES.organization, "Organization"],
    [FLAT_ROUTES.payments, "Payments"],
    [FLAT_ROUTES.credits, "Credits"],
    [FLAT_ROUTES.activity, "Activity"],
    [FLAT_ROUTES.profile, "Profile"],
    [FLAT_ROUTES.reviews, "Reviews"],
    [FLAT_ROUTES.capabilities, "Capabilities"],
    [FLAT_ROUTES.rewards, "Rewards"],
    // Members has an address but no row: Organization owns it.
    [FLAT_ROUTES.members, "Organization"],
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
    // — Account owned it until MESITA-1841, and Organization owns it now. With
    // no organization at all it belongs to the Create row instead.
    expect(pillText(render(SHELL_ROUTES.orgNew, { rememberedPlaceId: "p-1" }))).toBe("Organization");
    expect(pills(render(SHELL_ROUTES.orgNew, { organizations: [] }))).toHaveLength(1);
    expect(pillText(render(SHELL_ROUTES.orgNew, { organizations: [] }))).toBe("Create organization");
  });
});

describe("two levels: the organization's four, then the place's five (MESITA-1841)", () => {
  const ORG_FOUR = ["Organization", "Payments", "Credits", "Activity"];
  const PLACE_FIVE = ["Profile", "Reviews", "Capabilities", "Rewards"];

  it("are the four, the place's rows, then Account — Admin only for a super-admin", () => {
    const html = render(view("profile"), { rememberedPlaceId: "p-1" });
    expect(labels(html)).toEqual([...ORG_FOUR, ...PLACE_FIVE, "Account"]);
    expect(rows(html)).toHaveLength(9);
    // NO WORDMARK (MESITA-1842). Pato: "no mesita logo, fuck it."
    expect(html).not.toContain("<svg viewBox=\"0 0 293.03 100\"");
    expect(html).not.toContain(">business<");
    const admin = render(view("profile"), { rememberedPlaceId: "p-1", isSuperAdmin: true });
    expect(labels(admin)).toEqual([...ORG_FOUR, ...PLACE_FIVE, "Admin", "Account"]);
    expect(hrefs(admin)).toContain(view("admin"));

    // NO ID IS VISIBLE. The hrefs carry one since MESITA-1839 — that is the
    // point: a rail row is the canonical address, so a click costs one hop
    // and the URL it lands on can be sent to someone. What MESITA-1832's law
    // protects is what the OPERATOR meets: words, no id, no switcher.
    expect(labels(html).some((l) => l.includes("p-1") || l.includes("org-a"))).toBe(false);
    expect(groups(html).some((g) => g.includes("org-a"))).toBe(false);
    // THE ORGANIZATION'S NAME IS A HEADER, NOT A ROW (MESITA-1842). MESITA-1832
    // banned it from the rail entirely, when it could only have appeared AS a
    // row and would have read as a seventh destination. As the group's header
    // it is the subject the four rows beneath it are about — a label, nothing
    // clickable, and nothing that can be mistaken for a place to go.
    expect(labels(html)).not.toContain("Strana Group");
    expect(navOf(html)).not.toContain("<button");
    expect(html).not.toContain('role="group"');
    expect(html).not.toContain("Switch organization");
  });

  // BOTH GROUPS ARE HEADED, BY NAME, AND NOTHING INDENTS (MESITA-1842).
  // MESITA-1841 headed the place group and left the organization's bare, so
  // the rail's one label read as an orphan — and with an empty catalogue it
  // rendered as the bare word PLACE, naming nothing. Two names is a sentence;
  // one name is a stray tag.
  it("each group is headed by its subject's NAME, and no row indents", () => {
    const html = render(view("profile"), { rememberedPlaceId: "p-1", isSuperAdmin: true });
    const n = navOf(html);
    expect(groups(html)).toEqual(["Strana Group", "Strana Del Valle"]);
    // The flat law is back in force as written: an inset under a header says
    // a second time what the header says once.
    expect(n).not.toContain("pl-4");
    expect(n).not.toContain("border-l");
    expect(n).not.toContain("list-disc");
    // The nav carries NO seam — the one seam in the rail is the footer's.
    expect(n).not.toContain("border-t");
    expect((footerOf(html).match(/border-t/g) ?? []).length).toBe(1);
  });

  it("a subject with no name yet falls back to its noun, never to an empty line", () => {
    const html = render(FLAT_ROUTES.profile, { rememberedOrgId: "org-b" });
    // The organization HAS a name; the place does not exist yet.
    expect(groups(html)).toEqual(["Org Test", "Place"]);
  });

  // MESITA-1838, extended by MESITA-1841 to the rows that did not exist then.
  // Pinned so an icon swap is a deliberate edit, never a drift.
  it("each row wears the mark of its subject", () => {
    const html = render(view("profile"), { rememberedPlaceId: "p-1", isSuperAdmin: true });
    for (const mark of [
      "lucide-building2", // Organization — the company, not the storefront
      "lucide-wallet", // Payments — the purse, not one card
      "lucide-coins", // Credits — money sitting there
      "lucide-chart-no-axes-column", // Activity — counts over time
      "lucide-store", // Profile — the place's public page
      "lucide-star", // Reviews
      "lucide-sliders-horizontal", // Capabilities — the page's own mark
      "lucide-gift", // Rewards — what a guest gets back
      "lucide-shield", // Admin
      "lucide-user-round", // Account
    ]) {
      expect(html, mark).toContain(mark);
    }
    // The marks they replaced must not come back by habit.
    expect(html).not.toContain("lucide-file-text");
    expect(html).not.toContain("lucide-credit-card");
    expect(html).not.toContain("lucide-settings-2");
    // A gear would say "settings" — the name Capabilities just stopped using.
    expect(html).not.toContain("lucide-settings ");
  });

  it("the rows are the CANONICAL addresses — one hop, and shareable", () => {
    const html = render(view("profile"), { rememberedPlaceId: "p-1" });
    // No wordmark above them any more, so the rows start at index 0.
    expect(hrefs(html)).toEqual([
      orgHref("org-a"),
      orgHref("org-a", "payments"),
      orgHref("org-a", "credits"),
      orgHref("org-a", "activity"),
      view("profile"),
      view("reviews"),
      view("capabilities"),
      view("rewards"),
      SHELL_ROUTES.account,
    ]);
  });

  it("with NO place selected the place rows fall back to the flat addresses", () => {
    // An organization holding nothing has no `/places/<id>/…` to name, and a
    // row must still be a live link onto a real next step (MESITA-1833). The
    // organization's four still name their organization — it exists.
    const html = render(SHELL_ROUTES.account, {
      organizations: [{ id: "org-b", name: "Org Test", myRole: "owner", places: [] }],
      rememberedOrgId: "org-b",
    });
    expect(hrefs(html)).toEqual([
      orgHref("org-b"),
      orgHref("org-b", "payments"),
      orgHref("org-b", "credits"),
      orgHref("org-b", "activity"),
      FLAT_ROUTES.profile,
      FLAT_ROUTES.reviews,
      FLAT_ROUTES.capabilities,
      FLAT_ROUTES.rewards,
      SHELL_ROUTES.account,
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
    expect(labels(html)).toEqual([...ORG_FOUR, "Profile", "Reviews", "Account"]);
  });
});

describe("the states a 10/10 has to answer", () => {
  const ORG_FOUR = ["Organization", "Payments", "Credits", "Activity"];
  const PLACE_FIVE = ["Profile", "Reviews", "Capabilities", "Rewards"];

  it("zero organizations: Create organization and Account, nothing else", () => {
    const html = render(SHELL_ROUTES.orgNew, { organizations: [] });
    expect(labels(html)).toEqual(["Create organization", "Account"]);
    expect(pills(html)).toHaveLength(1);
    expect(pillText(html)).toBe("Create organization");
  });

  it("the organizations failed to load: Account and a muted line, NEVER the create row", () => {
    const html = render(SHELL_ROUTES.account, { organizations: [], viewerError: true });
    expect(html).toContain("Couldn&#x27;t load organizations");
    expect(html).not.toContain("Create organization");
    // One link in the landmark: Account. The muted line is a div, not a row.
    expect(rows(html)).toHaveLength(1);
  });

  // MESITA-1833: they used to render at opacity-60 with an "add a place
  // first" tooltip. Every one of them is a live link that lands on
  // NoPlaceYet — a real next step — so the disabled look was a lie, and with
  // an empty catalogue it was the FIRST thing a new operator saw. Nothing in
  // this rail may paint a working row as dead.
  it("an organization holding no place: the rows STAY, at FULL STRENGTH, one pill", () => {
    const html = render(FLAT_ROUTES.profile, { rememberedOrgId: "org-b" });
    expect(labels(html)).toEqual([...ORG_FOUR, ...PLACE_FIVE, "Account"]);
    expect(html).not.toContain("opacity-60");
    expect(html).not.toContain("add a place first");
    expect(pills(html)).toHaveLength(1);
    expect(pillText(html)).toBe("Profile");
  });

  it("the majority customer: one organization, one place — the same nine rows, nothing muted", () => {
    const html = render(FLAT_ROUTES.reviews, { organizations: SOLO });
    expect(labels(html)).toEqual([...ORG_FOUR, ...PLACE_FIVE, "Account"]);
    expect(html).not.toContain("opacity-60");
    expect(pillText(html)).toBe("Reviews");
    // The group header names the one place, so "Profile" says whose.
    expect(navOf(html)).toContain("Hoster Brewing Company");
  });

  it("a pool place published by the layout: Profile alone among the place rows, still one pill", () => {
    const html = render(FLAT_ROUTES.profile, { lastPlaceId: "p-x" });
    expect(labels(html)).toEqual([...ORG_FOUR, "Profile", "Account"]);
    expect(pills(html)).toHaveLength(1);
    expect(pillText(html)).toBe("Profile");
  });

  it("collapsed: every label a title, one pill, and the groups are a hairline", () => {
    const html = render(FLAT_ROUTES.capabilities, { collapsed: true, rememberedPlaceId: "p-1" });
    expect(rows(html)).toHaveLength(9);
    expect(html).toContain('title="Capabilities"');
    expect(html).toContain('title="Payments"');
    expect(html).toContain('title="Account · pato@canzeco.com"');
    expect(pills(html)).toHaveLength(1);
    // A name cannot fit at w-16, so the SECOND group is announced by a seam
    // instead — the first needs none, being the top of the column. One seam in
    // the nav, one in the footer.
    const n = navOf(html);
    expect((n.match(/border-t/g) ?? []).length).toBe(1);
    expect(n).not.toContain("Strana Del Valle");
    expect(n).not.toContain("Strana Group");
    expect((footerOf(html).match(/border-t/g) ?? []).length).toBe(1);
  });
});

describe("the switchers live on Account (MESITA-1832)", () => {
  it("render Organization and Place, each a menu trigger, never a pill", () => {
    const html = renderSwitchers(SHELL_ROUTES.account, { rememberedPlaceId: "p-1" });
    expect(html).toContain('aria-label="Switch organization"');
    expect(html).toContain('aria-label="Switch place"');
    expect(html).toContain(">Strana Group<");
    expect(html).toContain(">Strana Del Valle<");
    expect(html).not.toContain("aria-current");
    expect((html.match(/lucide-chevrons-up-down/g) ?? []).length).toBe(2);
  });

  it("with one organization holding one place, both are names: no chevron", () => {
    const html = renderSwitchers(SHELL_ROUTES.account, { organizations: SOLO });
    expect(html).toContain(">Pato<");
    expect(html).toContain(">Hoster Brewing Company<");
    expect(html).not.toContain("lucide-chevrons-up-down");
  });

  // MESITA-1833: the zero-places row is an EMPTY STATE, not a name. It used
  // to render "Add a place" in the slot a name occupies and — nothing to
  // switch — drew no chevron, so the call to action read as a disabled field.
  it("an organization holding no place turns the place switcher into the next step", () => {
    const html = renderSwitchers(SHELL_ROUTES.account, { rememberedOrgId: "org-b" });
    expect(html).toContain(">Add your first place<");
    // MESITA-1840: the dashed border went with the box. The affordance is the
    // plus chip and the brand-pink title, on a row that is still a trigger.
    expect(html).not.toContain("border-dashed");
    expect(html).toContain("lucide-plus");
    expect(html).toContain("--brand-pink-text");
    expect(html).toContain(">Nothing to switch between yet<");
  });

  // MESITA-1834: one column, at every width. Two columns in a fluid console
  // stretched each three-line row to ~800px, chevron a hand's width from its
  // name. MESITA-1840 then removed the wrapper entirely: these two are rows
  // two and three of Account's one card, and `divide-y` only draws between
  // DIRECT children — a wrapper would swallow the hairline between them.
  it("the switchers are one column, and render WITHOUT a wrapper", () => {
    const html = renderSwitchers(SHELL_ROUTES.account, { organizations: SOLO });
    expect(html).not.toContain("grid-cols");
    expect(html).not.toContain('class="flex flex-col gap-3"');
    // Two sibling triggers, nothing around them.
    expect((html.match(/<button/g) ?? []).length).toBe(2);
    expect(html.startsWith("<button")).toBe(true);
  });

  // MESITA-1837 gave Account's three a single rank; MESITA-1840 merged the
  // containers without touching it. Two of the three rows render here and the
  // third renders on the page, so the shape stays a shared constant. If these
  // two ever stop carrying it, the three have drifted into three ranks again
  // — exactly the hierarchy "three big boxes" was invented to replace.
  it("both switchers wear the shared ROW shape, at row size", () => {
    const html = renderSwitchers(SHELL_ROUTES.account, { organizations: SOLO });
    expect((html.match(/min-h-24/g) ?? []).length).toBe(2);
    expect((html.match(/h-11 w-11/g) ?? []).length).toBe(2);
    expect(read_ui()).toContain("export const SCOPE_ROW_CLASS");
    // A row carries no border or radius of its own — the card holds both.
    expect(html).not.toContain("rounded-2xl");
  });

  // The meta the dropdown computes now rides ON the trigger (MESITA-1833):
  // the role and the holding, without opening anything.
  it("each switcher states its scope on the trigger, not one click behind it", () => {
    const html = renderSwitchers(SHELL_ROUTES.account, { organizations: SOLO });
    expect(html).toContain(">Owner · 1 place<");
    expect(html).toContain(">In Pato<");
  });

  it("render nothing without an organization or outside the shell", () => {
    expect(renderSwitchers(SHELL_ROUTES.orgNew, { organizations: [] })).toBe("");
    nav.pathname = SHELL_ROUTES.account;
    expect(renderToStaticMarkup(<ScopeSwitchers />)).toBe("");
  });
});
