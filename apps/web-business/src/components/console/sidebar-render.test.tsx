// The rail, RENDERED (MESITA-1807; seven flat pages since MESITA-1815; each
// switcher above its own rows, two seams, since MESITA-1818).
//
// Source-reading contracts cannot see two pills: two rows computing `active`
// for one pathname pass every regex and light up together on screen. This
// file renders the real Sidebar over a pathname matrix with a mocked router
// and counts `aria-current="page"` — exactly one, on every route, in every
// viewer state — and proves the rail at zero, at one, on a pool place, and
// at `w-16`. It is the strongest proof this app has: no browser can get past
// the OTP wall.
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

function render(pathname: string, over: Over = {}): string {
  nav.pathname = pathname;
  const organizations = over.organizations ?? ORGS;
  const scope = resolveRailScope({
    organizations,
    pathname,
    rememberedPlaceId: over.rememberedPlaceId ?? null,
    rememberedOrgId: over.rememberedOrgId ?? null,
  });
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

const pills = (html: string) => html.match(/aria-current="page"/g) ?? [];
const hrefs = (html: string) =>
  (html.match(/href="([^"]*)"/g) ?? []).map((m) => m.slice(6, -1));
/** The pill anchor's text, tags stripped — the label is two spans since 8A. */
const pillText = (html: string) =>
  (html.match(/<a[^>]*aria-current="page"[^>]*>[\s\S]*?<\/a>/)?.[0] ?? "")
    .replace(/<[^>]+>/g, "");
const pillTag = (html: string) =>
  html.match(/<a[^>]*aria-current="page"[^>]*>/)?.[0] ?? "";
const navOf = (html: string) => html.slice(html.indexOf("<nav"), html.indexOf("</nav>"));
/** Group seams inside the nav (the footer's hairline sits outside it). */
const seams = (html: string) => navOf(html).match(/border-sidebar-border my-1 border-t/g) ?? [];

describe("exactly one pill, on every route", () => {
  const ROUTES: [string, string][] = [
    [SHELL_ROUTES.account, "Account"],
    [orgHref("org-a"), "Organization"],
    // The list and the Add step are the organization's own steps (MESITA-1815):
    // no Places row, so the Organization row is the pill on both.
    [orgHref("org-a", "places"), "Organization"],
    [orgPlacesNewHref("org-a"), "Organization"],
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

  it("the create ceremony lights the org Plus while you have organizations (MESITA-1818, 4A)", () => {
    // One pill on EVERY route: Create organization is a page reached through
    // the switcher's Plus, so the ink lands there — and never on the switcher.
    const html = render(SHELL_ROUTES.orgNew);
    expect(pills(html)).toHaveLength(1);
    expect(pillTag(html)).toContain('aria-label="Create organization"');
    expect(pillTag(html)).toContain("bg-foreground");
    expect(html.match(/<button[^>]*aria-label="Switch organization"[^>]*>/)?.[0]).not.toContain(
      "aria-current",
    );
  });

  it("one pill on every address that needs no id", () => {
    for (const href of Object.values(SHELL_ROUTES)) {
      if (href === "/") continue; // the resolver redirects; it never renders the rail
      expect(pills(render(href)), href).toHaveLength(1);
    }
  });

  it("a picker is never the pill", () => {
    const html = render(orgHref("org-a"));
    for (const trigger of html.match(/<button[^>]*aria-label="Switch [^"]*"[^>]*>/g) ?? []) {
      expect(trigger).not.toContain("aria-current");
      expect(trigger).not.toContain("bg-foreground");
    }
    expect(html).toContain('aria-label="Switch organization"');
    expect(html).toContain('aria-label="Switch place"');
  });
});

describe("seven flat pages, each switcher above its own rows (MESITA-1815 · 1818)", () => {
  it("are Account · seam · org switcher · Organization · seam · place switcher · Profile · Reviews · Activity · Settings · Admin, in that order", () => {
    const html = render(orgHref("org-a"), { isSuperAdmin: true });
    const at = (s: string) => html.indexOf(s);
    const order = [
      ">Account<",
      'aria-label="Switch organization"',
      ">Organization<",
      'aria-label="Switch place"',
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
    // Three groups, TWO seams (1A): after Account, after Organization. The
    // seam is the box's replacement, so it draws both boundaries.
    expect(seams(html)).toHaveLength(2);
    const n = navOf(html);
    expect(n.indexOf(">Account<")).toBeLessThan(n.indexOf("border-t"));
    expect(n.lastIndexOf("border-t")).toBeGreaterThan(n.indexOf(">Organization<"));
    expect(n.lastIndexOf("border-t")).toBeLessThan(n.indexOf('aria-label="Switch place"'));
    // No grouped boxes, no eyebrows: the rows say their scope themselves.
    expect(html).not.toContain('role="group"');
    expect(html).not.toContain('aria-label="Place"');
    expect(html).not.toContain('aria-label="Account"');
    // Five place rows, each painted "Place " + noun (8A) — the prefix at
    // font-normal, the noun at font-medium, NEVER an alpha.
    expect((html.match(/<span class="font-normal">Place <\/span>/g) ?? []).length).toBe(5);
    // The noun carries no weight class of its own: on the pill it is 600
    // like every other pill's text.
    expect(html).not.toContain('<span class="font-medium">');
    expect(navOf(html)).not.toMatch(/opacity-\d|text-[a-z-]+\/\d/);
  });

  it("the Account row says the page; the email is its tooltip (2A)", () => {
    const html = render(orgHref("org-a"));
    expect(html).toContain(">Account<");
    expect(html).toContain('title="Account · pato@canzeco.com"');
    expect(html).not.toContain(">pato@canzeco.com<");
  });

  it("with one organization holding one place, the switchers are names: no chevron, the menu stays (3A)", () => {
    const html = render(placeHref("p-solo"), { organizations: SOLO });
    expect(html).toContain('aria-label="Switch organization"');
    expect(html).toContain('aria-label="Switch place"');
    expect(html).toContain("Hoster Brewing Company");
    expect(html).not.toContain("lucide-chevrons-up-down");
    // Two organizations: the chevron is back.
    expect(render(orgHref("org-a"))).toContain("lucide-chevrons-up-down");
    // A pool place opened by an organization holding NO places: still nothing
    // to switch to, so the place switcher is a name there too.
    const empty: RailOrg[] = [{ ...ORGS[1], myRole: "owner" }];
    const pool = render(placeHref("p-x"), { organizations: empty, rememberedOrgId: "org-b" });
    expect(pool).toContain('aria-label="Switch place"');
    const trigger = pool.match(/<button[^>]*aria-label="Switch place"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? "";
    expect(trigger).not.toContain("lucide-chevrons-up-down");
  });

  it("the Places row is gone; the list stays a door in the place switcher", () => {
    const html = render(orgHref("org-a"));
    expect(html).not.toContain(">Places<");
    expect(hrefs(html)).not.toContain(orgPlacesHref("org-a"));
    expect(hrefs(html)).toContain(orgHref("org-a"));
    // The list's door is the switcher's menu (`All places`), which a closed
    // Radix menu does not render server-side; shell-chrome.test.ts pins the
    // MenuLink in the source.
    // ONE organization page (MESITA-1810): no Payments or Members rows.
    expect(html).not.toContain(">Payments<");
    expect(html).not.toContain(">Members<");
    expect(html).not.toContain(">Overview<");
    // The place shown is the organization's first when none is remembered.
    for (const tab of ["profile", "reviews", "activity", "settings"] as const) {
      expect(hrefs(html)).toContain(placeTabHref("p-1", tab));
    }
    expect(html).not.toContain("org=");
  });

  it("the rail says the scope word; the crumb keeps the bare one", () => {
    for (const tab of PLACE_TABS) {
      expect(placeRowLabel(tab)).toBe(`Place ${PLACE_TAB_LABEL[tab]}`);
    }
    expect(PLACE_TAB_LABEL.settings).toBe("Settings");
    expect(PLACE_TABS).not.toContain("capabilities" as never);
  });

  it("remembers the place you were last in while you are on an organization page", () => {
    const html = render(orgHref("org-a"), { rememberedPlaceId: "p-2" });
    expect(html).toContain("Strana Polanco");
    expect(hrefs(html)).toContain(placeTabHref("p-2", "activity"));
    expect(hrefs(html)).not.toContain(placeTabHref("p-1", "activity"));
  });

  it("Place Admin appears only for a super-admin", () => {
    expect(render(placeHref("p-1"))).not.toContain(">Admin</span>");
    const html = render(placeHref("p-1"), { isSuperAdmin: true });
    expect(html).toContain(">Admin</span>");
    expect(hrefs(html)).toContain(placeTabHref("p-1", "admin"));
  });

  it("a viewer's rail offers the read views only, and no Add place door (6A)", () => {
    const viewer: RailOrg[] = [{ ...ORGS[0], myRole: "viewer" }];
    const html = render(placeHref("p-1"), { organizations: viewer });
    expect(html).toContain(">Reviews</span>");
    expect(html).toContain(">Activity</span>");
    expect(html).not.toContain(">Settings</span>");
    // The same fact the org page reads (`canAddPlace`): a door the server
    // refuses is never offered.
    expect(html).not.toContain('aria-label="Add place"');
    expect(hrefs(html)).not.toContain(orgPlacesNewHref("org-a"));
    // Create organization stays open to every role.
    expect(hrefs(html)).toContain(SHELL_ROUTES.orgNew);
  });

  it("every view in the vocabulary is a row for the owner super-admin — no orphan view", () => {
    const html = render(placeHref("p-1"), { isSuperAdmin: true });
    for (const tab of PLACE_TABS) {
      expect(hrefs(html)).toContain(placeTabHref("p-1", tab));
    }
  });
});

describe("the states a 10/10 has to answer", () => {
  it("zero organizations: Account, a seam, a Create row, and no place rows", () => {
    const html = render(SHELL_ROUTES.orgNew, { organizations: [] });
    expect(html).toContain("Create organization");
    expect(pills(html)).toHaveLength(1);
    expect(pillText(html)).toBe("Create organization");
    expect(seams(html)).toHaveLength(1);
    expect(html).not.toContain(">Place </span>");
    expect(html).not.toContain('aria-label="Switch organization"');
    expect(html).not.toContain('aria-label="Switch place"');
  });

  it("the organizations failed to load: a muted line, NEVER the create row", () => {
    const html = render(SHELL_ROUTES.account, { organizations: [], viewerError: true });
    expect(html).toContain("Couldn&#x27;t load organizations");
    expect(html).not.toContain("Create organization");
    expect(html).not.toContain(">Place </span>");
    expect(html).not.toContain('aria-label="Switch place"');
  });

  it("an organization holding no place: an Add place row is the next step for its owner, never active", () => {
    const html = render(orgPlacesNewHref("org-b"));
    expect(html).toContain("Add place");
    expect(hrefs(html)).toContain(orgPlacesNewHref("org-b"));
    expect(html).not.toContain('aria-label="Switch place"');
    expect(html).not.toContain(">Place </span>");
    // The Organization row is the pill on the add step — not the Add place row.
    expect(pills(html)).toHaveLength(1);
    expect(pillText(html)).toBe("Organization");
    // An editor of the same empty organization has no place group at all —
    // and no seam drawn over the blank where it would be.
    const editor: RailOrg[] = [ORGS[0], { ...ORGS[1], myRole: "editor" }];
    const h2 = render(orgHref("org-b"), { organizations: editor });
    expect(h2).not.toContain("Add place");
    expect(seams(h2)).toHaveLength(1);
  });

  it("a pool place: named as foreign, Profile alone, still one pill", () => {
    const html = render(placeHref("p-x"));
    expect(pills(html)).toHaveLength(1);
    expect(hrefs(html)).toContain(placeTabHref("p-x", "profile"));
    expect(hrefs(html)).not.toContain(placeTabHref("p-x", "activity"));
    expect(html).toContain('aria-label="Switch place"');
  });

  it("collapsed: no Plus, every label a title, both seams", () => {
    const html = render(orgHref("org-a"), { collapsed: true });
    expect(html).not.toContain('aria-label="Create organization"');
    expect(html).not.toContain('aria-label="Add place"');
    expect(html).toContain('title="Organization"');
    expect(html).toContain('title="Place Settings"');
    expect(html).toContain('title="Account · pato@canzeco.com"');
    expect(html).toContain('title="Switch organization: Strana Group"');
    expect(seams(html)).toHaveLength(2);
    expect(pills(html)).toHaveLength(1);
  });

  it("collapsed on the create ceremony: no pill (the Plus is hidden; the menu footer is the door)", () => {
    // Accepted in 4A: at w-16 there is no Plus to light. The crumb is hidden
    // below lg too, so this is the one frame the console names nowhere.
    expect(pills(render(SHELL_ROUTES.orgNew, { collapsed: true }))).toHaveLength(0);
  });
});
