// The rail, RENDERED (MESITA-1807; seven rows and nothing else since
// MESITA-1822).
//
// Source-reading contracts cannot see two pills: two rows computing `active`
// for one pathname pass every regex and light up together on screen. This
// file renders the real Sidebar over a pathname matrix with a mocked router
// and counts `aria-current="page"` — exactly one, on every route, in every
// viewer state — and proves the rail at zero, at one, on a pool place, with
// no place, and at `w-16`. It is the strongest proof this app has: no
// browser can get past the OTP wall.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { resolveRailScope, type RailOrg } from "@/lib/rail-scope";
import {
  SHELL_ROUTES,
  orgHref,
  orgPlacesHref,
  orgPlacesNewHref,
  placeHref,
} from "@/lib/console-routes";
import { PLACE_TABS, PLACE_TAB_LABEL, placeTabHref } from "@/lib/place-tabs";

const nav = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(""),
}));

import { Sidebar, placeRowLabel } from "./Sidebar";
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
};

function scopeFor(pathname: string, over: Over = {}) {
  nav.pathname = pathname;
  const organizations = over.organizations ?? ORGS;
  return {
    organizations,
    scope: resolveRailScope({
      organizations,
      pathname,
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

/** The organization page's switchers, under the shell's scope. */
function renderSwitchers(pathname: string, over: Over = {}): string {
  const { organizations, scope } = scopeFor(pathname, over);
  return renderToStaticMarkup(
    <RailScopeProvider value={{ scope, organizations, isSuperAdmin: over.isSuperAdmin ?? false }}>
      <ScopeSwitchers />
    </RailScopeProvider>,
  );
}

const pills = (html: string) => html.match(/aria-current="page"/g) ?? [];
const hrefs = (html: string) =>
  (html.match(/href="([^"]*)"/g) ?? []).map((m) => m.slice(6, -1));
/** The pill anchor's text, tags stripped — the label is two spans since 8A. */
const pillText = (html: string) =>
  (html.match(/<a[^>]*aria-current="page"[^>]*>[\s\S]*?<\/a>/)?.[0] ?? "")
    .replace(/<[^>]+>/g, "");
const navOf = (html: string) => html.slice(html.indexOf("<nav"), html.indexOf("</nav>"));
/** Every row in the nav: the anchors (and the one status line). */
const rows = (html: string) => navOf(html).match(/<a [^>]*href="[^"]*"/g) ?? [];

describe("exactly one pill, on every route", () => {
  const ROUTES: [string, string][] = [
    [SHELL_ROUTES.account, "Account"],
    [orgHref("org-a"), "Organization"],
    // The list, the Add step and the create ceremony are the organization's
    // own steps: no rows of their own, the Organization row is the pill.
    [orgHref("org-a", "places"), "Organization"],
    [orgPlacesNewHref("org-a"), "Organization"],
    [SHELL_ROUTES.orgNew, "Organization"],
    [placeHref("p-1"), "Place Profile"],
    [placeTabHref("p-1", "activity"), "Place Activity"],
    [placeTabHref("p-1", "settings"), "Place Settings"],
  ];
  for (const [pathname, label] of ROUTES) {
    it(`${pathname} lights ${label} and nothing else`, () => {
      const html = render(pathname);
      expect(pills(html)).toHaveLength(1);
      expect(pillText(html)).toBe(label);
    });
  }

  it("every view in the vocabulary lights its own row, for the owner super-admin", () => {
    for (const tab of PLACE_TABS) {
      const html = render(placeTabHref("p-1", tab), { isSuperAdmin: true });
      expect(pills(html)).toHaveLength(1);
      expect(pillText(html)).toBe(placeRowLabel(tab));
    }
  });

  it("one pill on every address that needs no id, at both widths", () => {
    for (const href of Object.values(SHELL_ROUTES)) {
      if (href === "/") continue; // the resolver redirects; it never renders the rail
      expect(pills(render(href)), href).toHaveLength(1);
      expect(pills(render(href, { collapsed: true })), `${href} collapsed`).toHaveLength(1);
    }
  });
});

describe("seven rows, nothing else (MESITA-1822)", () => {
  it("are Account · Organization · Place Profile · Reviews · Activity · Settings · Admin, in that order, and NOTHING else", () => {
    const html = render(orgHref("org-a"), { isSuperAdmin: true });
    const at = (s: string) => html.indexOf(s);
    const order = [
      ">Account<",
      ">Organization<",
      ">Profile</span>",
      ">Reviews</span>",
      ">Activity</span>",
      ">Settings</span>",
      ">Admin</span>",
    ];
    for (const needle of order) expect(at(needle), needle).toBeGreaterThan(at("<nav"));
    for (let i = 1; i < order.length; i++) {
      expect(at(order[i - 1]), `${order[i - 1]} before ${order[i]}`).toBeLessThan(at(order[i]));
    }
    expect(rows(html)).toHaveLength(7);
    // No switcher, no Plus, no chip, no seam, no box, no eyebrow in the rail.
    expect(html).not.toContain('aria-label="Switch organization"');
    expect(html).not.toContain('aria-label="Switch place"');
    expect(html).not.toContain('aria-label="Create organization"');
    expect(html).not.toContain('aria-label="Add place"');
    expect(navOf(html)).not.toContain("<button");
    expect(navOf(html)).not.toContain("border-t");
    expect(html).not.toContain('role="group"');
    expect(html).not.toContain(">Strana Group<");
    // Five place rows, each painted "Place " + noun (8A) — the prefix at
    // font-normal, the noun bare, NEVER an alpha on the label.
    expect((html.match(/<span class="font-normal">Place <\/span>/g) ?? []).length).toBe(5);
    expect(html).not.toContain('<span class="font-medium">');
    expect(navOf(html)).not.toMatch(/text-[a-z-]+\/\d/);
  });

  it("the Account row says the page; the email is its tooltip (2A)", () => {
    const html = render(orgHref("org-a"));
    expect(html).toContain(">Account<");
    expect(html).toContain('title="Account · pato@canzeco.com"');
    expect(html).not.toContain(">pato@canzeco.com<");
  });

  it("the place rows link to the remembered place while you are on an organization page", () => {
    const html = render(orgHref("org-a"), { rememberedPlaceId: "p-2" });
    expect(hrefs(html)).toContain(placeTabHref("p-2", "activity"));
    expect(hrefs(html)).not.toContain(placeTabHref("p-1", "activity"));
    expect(html).not.toContain("org=");
  });

  it("Place Admin appears only for a super-admin", () => {
    expect(render(placeHref("p-1"))).not.toContain(">Admin</span>");
    const html = render(placeHref("p-1"), { isSuperAdmin: true });
    expect(html).toContain(">Admin</span>");
    expect(hrefs(html)).toContain(placeTabHref("p-1", "admin"));
  });

  it("a viewer's rail offers the read views only", () => {
    const viewer: RailOrg[] = [{ ...ORGS[0], myRole: "viewer" }];
    const html = render(placeHref("p-1"), { organizations: viewer });
    expect(html).toContain(">Reviews</span>");
    expect(html).toContain(">Activity</span>");
    expect(html).not.toContain(">Settings</span>");
    expect(rows(html)).toHaveLength(5);
  });

  it("every view in the vocabulary is a row for the owner super-admin — no orphan view", () => {
    const html = render(placeHref("p-1"), { isSuperAdmin: true });
    for (const tab of PLACE_TABS) {
      expect(hrefs(html)).toContain(placeTabHref("p-1", tab));
    }
  });
});

describe("the states a 10/10 has to answer", () => {
  it("zero organizations: Account and Create organization, nothing else", () => {
    const html = render(SHELL_ROUTES.orgNew, { organizations: [] });
    expect(rows(html)).toHaveLength(2);
    expect(pills(html)).toHaveLength(1);
    expect(pillText(html)).toBe("Create organization");
    expect(html).not.toContain(">Place </span>");
  });

  it("the organizations failed to load: Account and a muted line, NEVER the create row", () => {
    const html = render(SHELL_ROUTES.account, { organizations: [], viewerError: true });
    expect(html).toContain("Couldn&#x27;t load organizations");
    expect(html).not.toContain("Create organization");
    expect(html).not.toContain(">Place </span>");
    expect(rows(html)).toHaveLength(1);
  });

  it("an organization holding no place: the five rows STAY, muted, as doors to Add place (owner)", () => {
    const html = render(orgHref("org-b"));
    expect(rows(html)).toHaveLength(6);
    expect((html.match(/<span class="font-normal">Place <\/span>/g) ?? []).length).toBe(4);
    // Every muted place row is the owner's door to making a place.
    expect(hrefs(html).filter((h) => h === orgPlacesNewHref("org-b"))).toHaveLength(4);
    expect(html).toContain("opacity-60");
    expect(html).toContain('title="Place Profile · add a place first"');
    expect(html).not.toContain(">Add place<");
    expect(pills(html)).toHaveLength(1);
    expect(pillText(html)).toBe("Organization");
    // An editor's door is the list instead — never a page that 403s.
    const editor: RailOrg[] = [ORGS[0], { ...ORGS[1], myRole: "editor" }];
    const h2 = render(orgHref("org-b"), { organizations: editor });
    expect(hrefs(h2).filter((h) => h === orgPlacesHref("org-b"))).toHaveLength(4);
    expect(hrefs(h2)).not.toContain(orgPlacesNewHref("org-b"));
  });

  it("a pool place: Profile alone, still one pill, no other view offered", () => {
    const html = render(placeHref("p-x"));
    expect(pills(html)).toHaveLength(1);
    expect(hrefs(html)).toContain(placeTabHref("p-x", "profile"));
    expect(hrefs(html)).not.toContain(placeTabHref("p-x", "activity"));
    expect(rows(html)).toHaveLength(3);
  });

  it("collapsed: seven icons, every label a title, one pill", () => {
    const html = render(orgHref("org-a"), { collapsed: true, isSuperAdmin: true });
    expect(rows(html)).toHaveLength(7);
    expect(html).toContain('title="Organization"');
    expect(html).toContain('title="Place Settings"');
    expect(html).toContain('title="Account · pato@canzeco.com"');
    expect(pills(html)).toHaveLength(1);
  });
});

describe("the switchers live on the organization page (MESITA-1822)", () => {
  it("render Organization and Place, each a menu trigger, never a pill", () => {
    const html = renderSwitchers(orgHref("org-a"));
    expect(html).toContain('aria-label="Switch organization"');
    expect(html).toContain('aria-label="Switch place"');
    expect(html).toContain(">Strana Group<");
    expect(html).toContain(">Strana Del Valle<");
    expect(html).not.toContain("aria-current");
    // Two organizations, two places: both switchable.
    expect((html.match(/lucide-chevrons-up-down/g) ?? []).length).toBe(2);
  });

  it("with one organization holding one place, both are names: no chevron (3A)", () => {
    const html = renderSwitchers(placeHref("p-solo"), { organizations: SOLO });
    expect(html).toContain(">Pato<");
    expect(html).toContain(">Hoster Brewing Company<");
    expect(html).not.toContain("lucide-chevrons-up-down");
  });

  it("an organization holding no place names the next step in the place switcher", () => {
    expect(renderSwitchers(orgHref("org-b"))).toContain(">Add a place<");
    const editor: RailOrg[] = [ORGS[0], { ...ORGS[1], myRole: "editor" }];
    expect(renderSwitchers(orgHref("org-b"), { organizations: editor })).toContain(">No places yet<");
  });

  it("render nothing without an organization or outside the shell", () => {
    expect(renderSwitchers(SHELL_ROUTES.orgNew, { organizations: [] })).toBe("");
    nav.pathname = orgHref("org-a");
    expect(renderToStaticMarkup(<ScopeSwitchers />)).toBe("");
  });

  it("the rail's word for a view and the crumb's stay two words apart", () => {
    for (const tab of PLACE_TABS) {
      expect(placeRowLabel(tab)).toBe(`Place ${PLACE_TAB_LABEL[tab]}`);
    }
  });
});
