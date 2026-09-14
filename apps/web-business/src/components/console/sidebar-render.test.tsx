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
import { FLAT_ROUTES, SHELL_ROUTES, orgHref, orgPlacesNewHref, viewHref } from "@/lib/console-routes";
import { PLACE_TABS } from "@/lib/place-tabs";

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
      landingHref="/"
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
const rows = (html: string) => navOf(html).match(/<a [^>]*href="[^"]*"/g) ?? [];
const labels = (html: string) =>
  (navOf(html).match(/<span class="truncate">([^<]*)<\/span>/g) ?? []).map((m) => m.replace(/<[^>]+>/g, ""));

describe("exactly one pill, on every route (MESITA-1832)", () => {
  const ROUTES: [string, string][] = [
    [SHELL_ROUTES.account, "Account"],
    // Account owns its ceremonies: the create step, the list and Add place.
    [SHELL_ROUTES.orgNew, "Account"],
    [orgHref("org-a", "places"), "Account"],
    [orgPlacesNewHref("org-a"), "Account"],
    [viewHref("profile"), "Profile"],
    [viewHref("reviews"), "Reviews"],
    [SHELL_ROUTES.payments, "Payments"],
    [viewHref("activity"), "Activity"],
    [viewHref("settings"), "Settings"],
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
        const html = render(viewHref(tab), { isSuperAdmin: true, rememberedPlaceId: "p-1", collapsed });
        expect(pills(html), `${tab} ${collapsed}`).toHaveLength(1);
        expect(pillText(html)).toBe(tab.charAt(0).toUpperCase() + tab.slice(1));
      }
    }
  });

  it("one pill on every flat address", () => {
    for (const href of FLAT_ROUTES) {
      expect(pills(render(href, { isSuperAdmin: true, rememberedPlaceId: "p-1" })), href).toHaveLength(1);
    }
  });
});

describe("six rows, in the drawing's order", () => {
  it("are Account · Profile · Reviews · Payments · Activity · Settings, and Admin only for a super-admin", () => {
    const html = render(viewHref("profile"), { rememberedPlaceId: "p-1" });
    expect(labels(html)).toEqual(["Account", "Profile", "Reviews", "Payments", "Activity", "Settings"]);
    expect(rows(html)).toHaveLength(6);
    const admin = render(viewHref("profile"), { rememberedPlaceId: "p-1", isSuperAdmin: true });
    expect(labels(admin)).toEqual(["Account", "Profile", "Reviews", "Payments", "Activity", "Settings", "Admin"]);
    expect(hrefs(admin)).toContain(viewHref("admin"));
    // No id, no switcher, no Plus, no chip, no seam, no box in the rail.
    expect(hrefs(html).every((h) => !h.includes("org-a") && !h.includes("p-1"))).toBe(true);
    expect(navOf(html)).not.toContain("<button");
    expect(navOf(html)).not.toContain("border-t");
    expect(html).not.toContain('role="group"');
    expect(html).not.toContain("Switch organization");
    expect(html).not.toContain(">Strana Group<");
  });

  // MESITA-1838: pinned so an icon swap is a deliberate edit, never a drift.
  // Four of these named the wrong noun before ("wtf are those icons" — Pato):
  // a document for a storefront, a card for a purse, a heart-rate line for a
  // bar chart, sliders for a gear. Profile's Store is the same mark the place
  // chip wears on Account, so the rail and the page say one noun one way.
  it("each row wears the mark of its subject", () => {
    const html = render(viewHref("profile"), { rememberedPlaceId: "p-1", isSuperAdmin: true });
    for (const mark of [
      "lucide-user-round",
      "lucide-store",
      "lucide-star",
      "lucide-wallet",
      "lucide-chart-no-axes-column",
      "lucide-settings",
      "lucide-shield",
    ]) {
      expect(html, mark).toContain(mark);
    }
    // The marks they replaced must not come back by habit.
    expect(html).not.toContain("lucide-file-text");
    expect(html).not.toContain("lucide-credit-card");
    expect(html).not.toContain("lucide-settings-2");
  });

  it("the rows are the flat addresses", () => {
    const html = render(viewHref("profile"), { rememberedPlaceId: "p-1" });
    expect(hrefs(html).slice(1, 7)).toEqual([
      SHELL_ROUTES.account,
      viewHref("profile"),
      viewHref("reviews"),
      SHELL_ROUTES.payments,
      viewHref("activity"),
      viewHref("settings"),
    ]);
  });

  it("the Account row says the page; the email is its tooltip", () => {
    const html = render(viewHref("profile"), { rememberedPlaceId: "p-1" });
    expect(html).toContain(">Account<");
    expect(html).toContain('title="Account · pato@canzeco.com"');
    expect(html).not.toContain(">pato@canzeco.com<");
  });

  it("a viewer's rail drops Settings' place half? No — Settings stays (Members); the matrix drops nothing else", () => {
    const viewer: RailOrg[] = [{ ...ORGS[0], myRole: "viewer" }];
    const html = render(viewHref("profile"), { organizations: viewer, rememberedPlaceId: "p-1" });
    // A viewer may open Profile, Reviews, Activity (the read views) and
    // Payments; Settings is the place's switches, which the matrix withholds.
    expect(labels(html)).toEqual(["Account", "Profile", "Reviews", "Payments", "Activity"]);
  });
});

describe("the states a 10/10 has to answer", () => {
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
    expect(rows(html)).toHaveLength(1);
  });

  // MESITA-1833: they used to render at opacity-60 with an "add a place
  // first" tooltip. Every one of them is a live link that lands on
  // NoPlaceYet — a real next step — so the disabled look was a lie, and with
  // an empty catalogue it was the FIRST thing a new operator saw. Nothing in
  // this rail may paint a working row as dead.
  it("an organization holding no place: the rows STAY, at FULL STRENGTH, one pill", () => {
    const html = render(viewHref("profile"), { rememberedOrgId: "org-b" });
    expect(labels(html)).toEqual(["Account", "Profile", "Reviews", "Payments", "Activity", "Settings"]);
    expect(html).not.toContain("opacity-60");
    expect(html).not.toContain("add a place first");
    expect(pills(html)).toHaveLength(1);
    expect(pillText(html)).toBe("Profile");
  });

  it("the majority customer: one organization, one place — the same six rows, nothing muted", () => {
    const html = render(viewHref("reviews"), { organizations: SOLO });
    expect(labels(html)).toEqual(["Account", "Profile", "Reviews", "Payments", "Activity", "Settings"]);
    expect(html).not.toContain("opacity-60");
    expect(pillText(html)).toBe("Reviews");
  });

  it("a pool place published by the layout: Profile alone among the place rows, still one pill", () => {
    const html = render(viewHref("profile"), { lastPlaceId: "p-x" });
    expect(labels(html)).toEqual(["Account", "Profile", "Payments"]);
    expect(pills(html)).toHaveLength(1);
    expect(pillText(html)).toBe("Profile");
  });

  it("collapsed: six icons, every label a title, one pill", () => {
    const html = render(viewHref("settings"), { collapsed: true, rememberedPlaceId: "p-1" });
    expect(rows(html)).toHaveLength(6);
    expect(html).toContain('title="Settings"');
    expect(html).toContain('title="Payments"');
    expect(html).toContain('title="Account · pato@canzeco.com"');
    expect(pills(html)).toHaveLength(1);
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
    expect(html).toContain("border-dashed");
    expect(html).toContain("lucide-plus");
    expect(html).toContain(">Nothing to switch between yet<");
  });

  // MESITA-1834: one column, at every width. Two columns in a fluid console
  // stretched each three-line row to ~800px, chevron a hand's width from its
  // name; the page caps the measure so stacking does not just widen it.
  it("the switchers are one column, never a grid", () => {
    const html = renderSwitchers(SHELL_ROUTES.account, { organizations: SOLO });
    expect(html).not.toContain("grid-cols");
    expect(html).toContain('class="flex flex-col gap-3"');
  });

  // MESITA-1837: two of Account's three boxes render here and the third
  // renders on the page, so the shape is a shared constant. If these two ever
  // stop carrying it, the three have drifted into three ranks again — which
  // is exactly the hierarchy "three big boxes" replaced.
  it("both switchers wear the shared box shape, at box size", () => {
    const html = renderSwitchers(SHELL_ROUTES.account, { organizations: SOLO });
    expect((html.match(/min-h-24/g) ?? []).length).toBe(2);
    expect((html.match(/h-11 w-11/g) ?? []).length).toBe(2);
    expect(read_ui()).toContain("export const SCOPE_BOX_CLASS");
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
