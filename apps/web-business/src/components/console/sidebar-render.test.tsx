// The rail, RENDERED (MESITA-1807).
//
// Source-reading contracts cannot see two pills: two rows computing `active`
// for one pathname pass every regex and light up together on screen. This
// file renders the real Sidebar over a pathname matrix with a mocked router
// and counts `aria-current="page"` — exactly one, on every route, in every
// viewer state — and proves the boxes at zero, at one, on a pool place, and
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
import { PLACE_TABS, placeTabHref } from "@/lib/place-tabs";

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
  { id: "org-b", name: "Org Test", myRole: "editor", places: [] },
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

describe("exactly one pill, on every route", () => {
  const ROUTES: [string, string][] = [
    [SHELL_ROUTES.account, "pato@canzeco.com"],
    [orgHref("org-a"), "Organization"],
    [orgHref("org-a", "places"), "Places"],
    [orgPlacesNewHref("org-a"), "Places"],
    [placeHref("p-1"), "Profile"],
    [placeTabHref("p-1", "activity"), "Activity"],
    [placeTabHref("p-1", "capabilities"), "Capabilities"],
  ];
  for (const [pathname, label] of ROUTES) {
    it(`${pathname} lights ${label} and nothing else`, () => {
      const html = render(pathname);
      expect(pills(html)).toHaveLength(1);
      const pill = html.match(/<a[^>]*aria-current="page"[^>]*>[\s\S]*?<\/a>/)?.[0] ?? "";
      expect(pill).toContain(label);
    });
  }

  it("the create ceremony lights no row while you have organizations", () => {
    expect(pills(render(SHELL_ROUTES.orgNew))).toHaveLength(0);
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

describe("the three boxes", () => {
  it("are Account, Organization and Place, each a labelled group, in that order", () => {
    const html = render(orgHref("org-a"));
    const at = (s: string) => html.indexOf(s);
    expect(at('aria-label="Account"')).toBeGreaterThan(at("<nav"));
    expect(at('aria-label="Account"')).toBeLessThan(at('aria-label="Organization"'));
    expect(at('aria-label="Organization"')).toBeLessThan(at('aria-label="Place"'));
  });

  it("the Organization box links the organization and its list, and the Place box every view", () => {
    const html = render(orgHref("org-a"));
    for (const href of [orgHref("org-a"), orgPlacesHref("org-a")]) {
      expect(hrefs(html)).toContain(href);
    }
    // ONE organization page (MESITA-1810): no Payments or Members rows.
    expect(html).not.toContain(">Payments<");
    expect(html).not.toContain(">Members<");
    expect(html).not.toContain(">Overview<");
    // The place shown is the organization's first when none is remembered.
    for (const tab of ["profile", "reviews", "activity", "capabilities"] as const) {
      expect(hrefs(html)).toContain(placeTabHref("p-1", tab));
    }
    expect(html).not.toContain("org=");
  });

  it("remembers the place you were last in while you are on an organization page", () => {
    const html = render(orgHref("org-a"), { rememberedPlaceId: "p-2" });
    expect(html).toContain("Strana Polanco");
    expect(hrefs(html)).toContain(placeTabHref("p-2", "activity"));
    expect(hrefs(html)).not.toContain(placeTabHref("p-1", "activity"));
  });

  it("Admin appears only for a super-admin", () => {
    expect(render(placeHref("p-1"))).not.toContain(">Admin<");
    const html = render(placeHref("p-1"), { isSuperAdmin: true });
    expect(html).toContain(">Admin<");
    expect(hrefs(html)).toContain(placeTabHref("p-1", "admin"));
  });

  it("a viewer's place box offers the read views only", () => {
    const viewer: RailOrg[] = [{ ...ORGS[0], myRole: "viewer" }];
    const html = render(placeHref("p-1"), { organizations: viewer });
    expect(html).toContain(">Reviews<");
    expect(html).toContain(">Activity<");
    expect(html).not.toContain(">Capabilities<");
  });

  it("every view in the vocabulary is a row for the owner super-admin — no orphan view", () => {
    const html = render(placeHref("p-1"), { isSuperAdmin: true });
    for (const tab of PLACE_TABS) {
      expect(hrefs(html)).toContain(placeTabHref("p-1", tab));
    }
  });
});

describe("the states a 10/10 has to answer", () => {
  it("zero organizations: Account, a Create row, and no Place box", () => {
    const html = render(SHELL_ROUTES.orgNew, { organizations: [] });
    expect(html).toContain("Create organization");
    expect(pills(html)).toHaveLength(1);
    expect(html).not.toContain('aria-label="Place"');
    expect(html).not.toContain('aria-label="Switch organization"');
  });

  it("the organizations failed to load: a muted line, NEVER the create row", () => {
    const html = render(SHELL_ROUTES.account, { organizations: [], viewerError: true });
    expect(html).toContain("Couldn&#x27;t load organizations");
    expect(html).not.toContain("Create organization");
    expect(html).not.toContain('aria-label="Place"');
  });

  it("an organization holding no place: the Place box is the next step, never active", () => {
    const html = render(orgPlacesNewHref("org-b"));
    expect(html).toContain("Add place");
    expect(hrefs(html)).toContain(orgPlacesNewHref("org-b"));
    expect(html).not.toContain('aria-label="Switch place"');
    // The Places row is the pill on the add step — not the Add place row.
    expect(pills(html)).toHaveLength(1);
    const pill = html.match(/<a[^>]*aria-current="page"[^>]*>[\s\S]*?<\/a>/)?.[0] ?? "";
    expect(pill).toContain(">Places<");
  });

  it("a pool place: named as foreign, Profile alone, still one pill", () => {
    const html = render(placeHref("p-x"));
    expect(pills(html)).toHaveLength(1);
    expect(hrefs(html)).toContain(placeTabHref("p-x", "profile"));
    expect(hrefs(html)).not.toContain(placeTabHref("p-x", "activity"));
    expect(html).toContain('aria-label="Switch place"');
  });

  it("collapsed: no eyebrows, no Plus, every label a title", () => {
    const html = render(orgHref("org-a"), { collapsed: true });
    expect(html).not.toMatch(/aria-hidden="true"[^>]*>Organization</);
    expect(html).not.toContain('aria-label="Create organization"');
    expect(html).not.toContain('aria-label="Add place"');
    expect(html).toContain('title="Places"');
    expect(html).toContain('title="Switch organization: Strana Group"');
    expect(pills(html)).toHaveLength(1);
  });
});
