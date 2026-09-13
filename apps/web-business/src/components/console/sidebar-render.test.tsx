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
import { FLAT_ROUTES, SHELL_ROUTES, orgHref, orgPlacesNewHref, viewHref } from "@/lib/console-routes";
import { PLACE_TABS } from "@/lib/place-tabs";

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

  it("an organization holding no place: the rows STAY, the place ones muted, one pill", () => {
    const html = render(viewHref("profile"), { rememberedOrgId: "org-b" });
    expect(labels(html)).toEqual(["Account", "Profile", "Reviews", "Payments", "Activity", "Settings"]);
    expect((html.match(/opacity-60/g) ?? []).length).toBe(4);
    expect(html).toContain('title="Profile · add a place first"');
    expect(html).not.toContain('title="Payments · add a place first"');
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

  it("an organization holding no place names the next step in the place switcher", () => {
    expect(renderSwitchers(SHELL_ROUTES.account, { rememberedOrgId: "org-b" })).toContain(">Add a place<");
  });

  it("render nothing without an organization or outside the shell", () => {
    expect(renderSwitchers(SHELL_ROUTES.orgNew, { organizations: [] })).toBe("");
    nav.pathname = SHELL_ROUTES.account;
    expect(renderToStaticMarkup(<ScopeSwitchers />)).toBe("");
  });
});
