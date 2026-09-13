// The chrome's invariants (MESITA-1558, MESITA-1710, MESITA-1807).
//
// Every rule here is a pairing between two things that must agree and that no
// compiler checks: a Tailwind literal against the constant it encodes, a
// negative margin against the padding it cancels, a component against the
// context it may not import. Each one, when broken, ships something that looks
// fine on the viewport a developer checks first. What can be proven by
// RENDERING is proven in components/console/sidebar-render.test.tsx; these are
// the source-level pairings.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as uiClasses from "./ui-classes";
import { STATES_HEAD_STICKY, SHELL_BLEED, SHELL_GUTTER } from "./ui-classes";
import { PLACE_TABS, placeTabHref, tabsForAccess } from "./place-tabs";
import { placeHref } from "./console-routes";

const SRC = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
/** Same file, comments removed. Several rules below ban a class or a tag that
 *  the file's own prose NAMES while explaining why it is banned, and a raw
 *  scan reads that explanation as the mistake. A test that fails on its
 *  subject's documentation is worse than no test. */
const readCode = (rel: string) =>
  read(rel)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

describe("gutter and bleed are exact negatives", () => {
  it("every breakpoint in the gutter has a matching negative in the bleed", () => {
    // If these drift, the bar is inset by the difference at that breakpoint —
    // visible only above it, i.e. correct on the phone you test first and
    // wrong on every desktop.
    const pairs = SHELL_GUTTER.split(" ").map((c) => {
      const [prefix, util] = c.includes(":") ? c.split(":") : ["", c];
      return {
        prefix,
        want: `${prefix ? `${prefix}:` : ""}-${util.replace("px-", "mx-")}`,
      };
    });
    for (const { want } of pairs) {
      expect(SHELL_BLEED.split(" ")).toContain(want);
    }
    expect(SHELL_BLEED.split(" ")).toHaveLength(SHELL_GUTTER.split(" ").length);
  });
});

// MESITA-1714. The bar is gone. Its name and its views both live in the rail,
// so a sticky row restating them was 48px of chrome saying what the column
// beside it already said. What survived is the h1 — as a page title in the
// content flow, not as chrome. (MESITA-1804's pill row lived here for a day
// while the rail carried nothing; MESITA-1807 removed it for the same reason.)
describe("the place screen has a heading, not a second bar", () => {
  it("PLACEBAR_STICKY_CLASS is gone, not merely unused", () => {
    // An exported sticky constant nobody reads is an invitation to wire a
    // second sticky bar back up.
    expect("PLACEBAR_STICKY_CLASS" in uiClasses).toBe(false);
    expect(read("lib/ui-classes.ts")).not.toMatch(
      /^export const PLACEBAR_STICKY_CLASS/m,
    );
  });

  it("TOPNAV_OCCUPIED_PX stayed gone too", () => {
    expect("TOPNAV_OCCUPIED_PX" in uiClasses).toBe(false);
  });

  it("the heading is not sticky and is not chrome", () => {
    const h = readCode("components/console/PlaceHeading.tsx");
    expect(h).not.toContain("sticky");
    expect(h).not.toContain("z-");
    expect(h).not.toContain(SHELL_BLEED);
    // No second strip of views: the rail carries them (MESITA-1807).
    expect(h).not.toContain("placeTabHref");
    expect(h).not.toContain("<nav");
  });

  it("it is still the place screen's one h1", () => {
    // Section renders h3. Without this the first heading on the screen is an
    // h3 with h1 and h2 both skipped — axe flags it and VoiceOver's rotor has
    // nothing to land on.
    const h = read("components/console/PlaceHeading.tsx");
    expect((h.match(/<h1/g) ?? []).length).toBe(1);
    // font-sans is explicit because globals.css puts every bare h1 on the
    // display face, and this is identity, not a page title.
    expect(h).toContain("font-sans");
    expect(h).toContain("Partner");
  });

  it("the three superseded components are deleted, not orphaned", () => {
    for (const f of ["PlaceBar.tsx", "PlaceTabs.tsx", "GuardedPlaceTabs.tsx"]) {
      expect(existsSync(path.join(SRC, "components", "console", f))).toBe(
        false,
      );
    }
  });

  it("one breakpoint, lg — the rail and the chrome switch together", () => {
    const shell = read("components/console/AppShell.tsx");
    expect(shell).toContain("lg:hidden");
    expect(shell).toContain("lg:flex");
    expect(shell).not.toMatch(/\bsm:hidden\b/);
  });
});

// MESITA-1714. The guard travels UP; the component does not come down.
describe("the unsaved-edits guard reaches the rail", () => {
  it("only the bridge reads PlaceContext, and it renders nothing", () => {
    // usePlaceContext throws outside its provider, and a pool place has none.
    const bridge = read("components/console/PlaceNavBridge.tsx");
    expect(bridge).toContain("usePlaceContext");
    expect(bridge).toContain("PublishPlaceNav");
    // The rail must never import the provider — it renders above it.
    expect(readCode("components/console/Sidebar.tsx")).not.toMatch(
      /from ["']@\/components\/place-manage\/PlaceContext/,
    );
  });

  it("the bridge lives inside the provider, structurally", () => {
    // Rendered by the shell itself rather than passed in: position-by-
    // convention is enforced by nothing, and getting it wrong throws on every
    // managed place.
    const shell = read("app/(shell)/places/[id]/PlaceManageShell.tsx");
    const provider = shell.slice(shell.indexOf("<PlaceProvider"));
    expect(provider).toContain("<PlaceNavBridge />");
  });

  it("never guards the row you are already on", () => {
    // That click navigates nowhere, so a discard prompt for it is an offer to
    // throw work away for nothing.
    expect(readCode("components/console/Sidebar.tsx")).toContain(
      "if (!active) onGuardedNavigate?.(href, e);",
    );
  });

  it("closes the drawer even when the guard swallows the click", () => {
    // The discard dialog renders inside `main`, behind the drawer's scrim. An
    // early return here leaves the rail covering the question.
    const rail = readCode("components/console/Sidebar.tsx");
    const onClick = rail.slice(rail.indexOf("onClick={(e) => {"));
    const body = onClick.slice(0, onClick.indexOf("}}"));
    expect(body).not.toContain("return");
    expect(body).toContain("onNavigate?.();");
  });

  it("the wordmarks are guarded too — same destination, same rule", () => {
    // Both wordmarks land where `/` would. One of them silently discarding
    // edits while the other asks is worse than either rule applied
    // consistently.
    expect(readCode("components/console/Sidebar.tsx")).toContain(
      "guardNav?.(landingHref, e)",
    );
    expect(readCode("components/console/AppShell.tsx")).toContain(
      "guardNav?.(landingHref, e)",
    );
  });

  it("the provider wraps the shell, so the topbar can see the guard", () => {
    // A hook cannot see a provider its own component renders.
    expect(readCode("components/console/AppShell.tsx")).not.toContain(
      "<OpenPlaceProvider>",
    );
    expect(readCode("app/(shell)/layout.tsx")).toContain("<OpenPlaceProvider>");
  });

  it("every way out of the rail routes through the guard when one exists", () => {
    const rail = readCode("components/console/Sidebar.tsx");
    // Rows, the ceremony Plus, the menu's footer links, and the pickers' own
    // choices — every one asks before leaving a dirty place.
    expect(rail).toContain("if (!active) onGuardedNavigate?.(href, e);");
    const plus = rail.slice(rail.indexOf("function CeremonyPlus"));
    expect(plus.slice(0, plus.indexOf("\n}\n"))).toContain(
      "onGuardedNavigate?.(href, e)",
    );
    const menuLink = rail.slice(rail.indexOf("function MenuLink"));
    expect(menuLink.slice(0, menuLink.indexOf("\n}\n"))).toContain(
      "onGuardedNavigate?.(href, e)",
    );
    // A picker's choice: the guard decides BEFORE the pending name is shown.
    const go = rail.slice(rail.indexOf("const go = ("));
    const goBody = go.slice(0, go.indexOf("};"));
    expect(goBody.indexOf("guardNav?.(href)")).toBeGreaterThan(-1);
    expect(goBody.indexOf("guardNav?.(href)")).toBeLessThan(
      goBody.indexOf("setChoice("),
    );
  });
});

// MESITA-1815. The rail is seven flat pages: Account · Organization (with the
// two switchers beneath it) · Place Profile · Reviews · Activity · Settings ·
// Admin. The one rule that has outlived every redesign: nothing indents. Pato
// rejected a tree twice (1714, 1715), and boxes once (1815: "too enterprise").
describe("the rail is seven flat pages", () => {
  const rail = () => readCode("components/console/Sidebar.tsx");

  it("indents NOTHING, and draws no tree line or bullet", () => {
    const r = rail();
    expect(r).not.toContain("paddingLeft");
    expect(r).not.toMatch(/^\s*inset$/m);
    expect(r).not.toContain("inset?:");
    expect(r).not.toContain("pl-8");
    expect(r).not.toContain("pl-6");
    expect(r).not.toMatch(/border-l-\d/);
    expect(r).not.toMatch(/rounded-full["\s]*\/>/);
  });

  it("has no box and no eyebrow: the rows carry their scope word", () => {
    const r = rail();
    expect(r).not.toContain("<Scope");
    expect(r).not.toContain("WELL_BG");
    expect(r).not.toContain('role="group"');
    expect(r).toContain("export function placeRowLabel(tab: PlaceTab): string");
    expect(r).toContain("return `Place ${PLACE_TAB_LABEL[tab]}`;");
    expect(r).toContain("label={placeRowLabel(tab)}");
  });

  it("is Account · Organization · switchers · the views, in that order, and no Places row", () => {
    const r = rail();
    const nav = r.slice(r.indexOf("<nav"), r.indexOf("</nav>"));
    const at = (needle: string) => nav.indexOf(needle);
    expect(at("href={SHELL_ROUTES.account}")).toBeGreaterThan(-1);
    expect(at("href={SHELL_ROUTES.account}")).toBeLessThan(at("href={orgHref(org.id)}"));
    expect(at("href={orgHref(org.id)}")).toBeLessThan(at('label="Switch organization"'));
    expect(at('label="Switch organization"')).toBeLessThan(at('label="Switch place"'));
    expect(at('label="Switch place"')).toBeLessThan(at("placeTabs.map((tab)"));
    // The list is the organization's own step: its row lights for it.
    expect(nav).toContain("active={orgPage !== null}");
    expect(nav).not.toContain("ORG_ROWS");
    expect(nav).not.toContain('label="Places"');
    expect(r).not.toContain("<select");
    expect(r).not.toContain('label="All Places"');
    expect(r).not.toContain('label="Organizations"');
  });

  it("the pickers are buttons that open a menu, and never take the pill", () => {
    const r = rail();
    expect(r).toContain("DropdownMenuTrigger");
    expect(r).toContain('label="Switch organization"');
    expect(r).toContain('label="Switch place"');
    const picker = r.slice(r.indexOf("function Picker"), r.indexOf("function OrgChip"));
    expect(picker).toContain("aria-label={label}");
    expect(picker).not.toContain("ROW_ACTIVE");
    expect(picker).not.toContain("aria-current");
    // The chip is never the pill's ink pair: two solid squares at w-16.
    expect(r).toMatch(/const CHIP =\s*"bg-sidebar-accent text-foreground/);
    expect(r).not.toContain('CHIP = "bg-foreground');
  });

  it("the org page comes from the route contract, and the place views from the ONE matrix", () => {
    const r = rail();
    expect(r).toContain("orgHref(org.id)");
    expect(r).toContain("orgPageFromPathname(pathname)");
    expect(r).toContain("tabsForAccess({ held: true, role: org.myRole, isSuperAdmin })");
    expect(r).toContain("placeTabHref(placeSubjectId, tab)");
    expect(r).not.toContain("?org=");
    expect(r).not.toContain("withOrg(");
    expect(r).not.toContain("window.location");
    expect(readCode("lib/place-view.ts")).toContain("return tabsForAccess({");
  });

  it("the ceremonies are one click from the rail: a Plus beside each picker, repeated in its menu", () => {
    const r = rail();
    expect((r.match(/<CeremonyPlus/g) ?? []).length).toBe(2);
    expect(r).toContain("href={SHELL_ROUTES.orgNew}");
    expect(r).toContain("href={orgPlacesNewHref(org.id)}");
    // Hidden at w-16 — two targets do not fit — so the menu footer is the door there.
    const plus = r.slice(r.indexOf("function CeremonyPlus"));
    expect(plus.slice(0, plus.indexOf("\n}\n"))).toContain("if (collapsed) return null;");
    expect(r).toContain('label="All places"');
    expect((r.match(/label="Add place"/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("at exactly one entry the menu shows a label, not a one-item choice", () => {
    const r = rail();
    expect(r).toContain("organizations.length === 1 ? (");
    expect(r).toContain("org.places.length === 1 && !foreign ? (");
  });

  it("a choice shows the chosen name only after the guard let it through, and only on its own pathname", () => {
    const r = rail();
    expect(r).toContain("choice && choice.at === pathname ? choice.id : null");
    expect(r).toContain("aria-busy={pending || undefined}");
    expect(r).not.toContain("useEffect");
  });

  it("switching a place keeps the view when it may be opened there, else Profile", () => {
    const r = rail();
    expect(r).toContain(
      'const view = currentView && allowed.includes(currentView) ? currentView : "profile";',
    );
  });

  it("the footer holds the rail's own control and nothing else", () => {
    const r = rail();
    const footer = r.slice(r.indexOf("</nav>"));
    expect(footer).toContain("onToggleCollapse");
    expect(footer).not.toContain("<NavRow");
  });

  it("focus travels on the brand's ring, not the browser's; menus respect reduced motion", () => {
    expect(rail()).toContain("focus-visible:ring-sidebar-ring");
    expect(rail()).toContain("motion-reduce:animate-none");
  });

  it("the layout hands the rail the whole viewer and the two rail cookies, raw", () => {
    const layout = readCode("app/(shell)/layout.tsx");
    expect(layout).toContain("apiConsoleViewer(supabase)");
    expect(layout).toContain("isSuperAdmin={viewer.isSuperAdmin}");
    expect(layout).toContain("places: o.places");
    expect(layout).toContain("viewerError={viewerError}");
    expect(layout).toContain("plausibleId(jar.get(RAIL_PLACE_COOKIE)?.value)");
    expect(layout).toContain("plausibleId(jar.get(RAIL_ORG_COOKIE)?.value)");
    // A layout cannot read the pathname, so it must not pretend to resolve.
    expect(layout).not.toContain("resolveRailScope");
    expect(layout).not.toContain("searchParams");
  });

  it("a claim or release still refreshes through the server tree", () => {
    expect(readCode("components/console/PlaceHoldButton.tsx")).toContain(
      "router.refresh()",
    );
  });

  it("the tab matrix grants Reviews to every held role, and its union is the whole vocabulary", () => {
    // The orphaned-view class (MESITA-1804): a tab the matrix never emits
    // stays reachable by URL only, and every source-reading test stays green.
    const union = new Set<string>();
    for (const held of [true, false]) {
      for (const role of ["owner", "editor", "viewer", null] as const) {
        for (const isSuperAdmin of [true, false]) {
          for (const t of tabsForAccess({ held, role, isSuperAdmin })) union.add(t);
        }
      }
    }
    expect([...union].sort()).toEqual([...PLACE_TABS].sort());
    expect(tabsForAccess({ held: true, role: "viewer", isSuperAdmin: false })).toEqual([
      "profile",
      "reviews",
      "activity",
    ]);
    expect(tabsForAccess({ held: false, role: null, isSuperAdmin: true })).toEqual([
      "profile",
    ]);
  });
});

describe("the header mirrors the rail", () => {
  const hdr = () => readCode("components/console/ConsoleHeader.tsx");

  it("reads the ONE scope AppShell resolved, and never a select", () => {
    expect(hdr()).toContain("scope: RailScope");
    expect(hdr()).not.toContain("<select");
    expect(hdr()).not.toContain("useActiveOrg");
    expect(readCode("components/console/AppShell.tsx")).toContain("<ConsoleHeader scope={scope} />");
  });

  it("names the pool place from the layout's publish", () => {
    expect(hdr()).toContain("useOpenPlace()");
    expect(hdr()).toContain("openPlace?.id === scope.foreignPlaceId");
  });
});

// MESITA-1734. In Next 16 a route with no `loading.tsx` does NOT fall back to
// a parent's: LoadingBoundary returns a bare Fragment when `loading` is null,
// so the suspending segment finds no boundary and the router keeps the
// PREVIOUS screen painted (MESITA-1729 found this on Organization). Sibling
// tab navigation does not re-run `places/[id]/layout.tsx` either, so
// `[id]/loading.tsx` is not the boundary for a tab click — the changed segment
// is the tab, and every tab page awaits `getManagePlace(id)` on its own.
describe("every place view has its own loading boundary", () => {
  const VIEWS = path.join(SRC, "app/(shell)/places/[id]");

  // A BIJECTION, not a one-way loop. Asserting only "every tab has a
  // loading.tsx" passes just as happily when a sixth view directory appears
  // with no boundary of its own; asserting only the reverse passes when a tab
  // is added and forgotten. Both directions, so neither hole is open.
  it("every known tab has one", () => {
    for (const tab of PLACE_TABS) {
      expect(existsSync(path.join(VIEWS, tab, "loading.tsx"))).toBe(true);
    }
  });

  it("every view directory on disk is a known tab", () => {
    const dirs = readdirSync(VIEWS, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    for (const dir of dirs) {
      expect(PLACE_TABS as readonly string[]).toContain(dir);
    }
  });

  it("the skeleton reserves no space for the heading", () => {
    // PlaceHeading is rendered by the place LAYOUT, above the boundary, so it
    // is already on screen. A skeleton block for it would double-count and
    // cause the very shift the boundary exists to prevent — the same rule
    // `places/[id]/loading.tsx` follows.
    const s = readCode("components/console/PlaceViewSkeleton.tsx");
    expect(s).toContain('aria-hidden="true"');
    expect(s).toContain("sr-only");
    // And the pulse stops for anyone who asked motion to stop.
    expect(s).toContain("motion-reduce:animate-none");
  });

  it("Reviews guards like Settings: a pool place answers 404, never a throw", () => {
    const page = readCode("app/(shell)/places/[id]/reviews/page.tsx");
    expect(page).toContain("if (!manage) notFound();");
    expect(readCode("components/place-manage/sections/PlaceSection.tsx")).not.toContain(
      "ReviewsSummary",
    );
  });
});

describe("Settings first paint is a row list, not a meter (MESITA-1739)", () => {
  it("the loading skeleton is rows, not Profile's photo band", () => {
    const s = read("app/(shell)/places/[id]/settings/loading.tsx");
    expect(s).not.toContain("h-[420px]");
    expect(s).not.toContain("PlaceViewSkeleton");
    expect(s).toContain("Loading settings");
    expect(s).toContain("length: 7");
  });

  it("the page does not open on a 0-of-7 meter", () => {
    const s = readCode("components/place-manage/sections/PromosSection.tsx");
    expect(s).not.toContain("PROMOTION_SCORE_MAX");
    expect(s).not.toContain("of {PROMOTION_SCORE_MAX}");
    expect(s).not.toContain("Join Partnership");
    expect(s).not.toContain("Connect Stripe");
    expect(s).toContain("guestSummary");
  });

  it("nested configs still hide with CSS, never unmount", () => {
    const s = read("components/place-manage/sections/PromosSection.tsx");
    expect(s).toContain("shouldRenderConfig");
    expect(s).toContain('dirtyLabels.includes("Orders")');
    expect(s).toContain('dirtyLabels.includes("Reservations")');
  });

  it("the Organization-for-Stripe door goes to the holder's organization page", () => {
    const s = readCode("components/place-manage/sections/PromosSection.tsx");
    expect(s).toContain("useOpenPlace()?.holderOrgId");
    expect(s).toContain("orgPageHref(holderOrgId)");
    expect(s).not.toContain("useSearchParams");
  });
});

// MESITA-1637, moved by MESITA-1710. The console is driven in a chromeless
// desktop window, so the address bar is not on screen and nothing else in the
// product says which route you are on. The top bar used to say it; a 240px
// rail has no room for a uuid, so it moved to the content column's header.
describe("the console header names the route", () => {
  const hdr = () => read("components/console/ConsoleHeader.tsx");

  it("renders pathname AND query — ?owned= and ?connect= are half the answer", () => {
    expect(hdr()).toContain("const route = q ? `${pathname}?${q}` : pathname");
  });

  it("is an anchor, so the browser's own copy-link works on it", () => {
    expect(hdr()).toMatch(/<Link\s+href=\{route\}/);
  });

  it("cannot grow the header — a place route carries a uuid", () => {
    const el = hdr().slice(hdr().indexOf("<Link\n        href={route}"));
    const cls = el.slice(
      el.indexOf("className="),
      el.indexOf(">\n        {route}"),
    );
    expect(cls).toContain("truncate");
    expect(cls).toMatch(/max-w-\[/);
    expect(cls).toContain("shrink-0");
  });

  it("takes the ml-auto, and nothing else in the row holds one", () => {
    expect((hdr().match(/ml-auto/g) ?? []).length).toBe(1);
  });

  it("is rendered by the shell, so every screen gets it", () => {
    expect(read("components/console/AppShell.tsx")).toContain("<ConsoleHeader");
  });

  it("is a div, not a header — the rail is already the banner", () => {
    expect(readCode("components/console/ConsoleHeader.tsx")).not.toContain(
      "<header",
    );
  });
});

// MESITA-1658. Two sticky constants, one string, two different boxes — and
// copying the first into the second hid the Places table's first row behind a
// 57px gap for weeks. These pin the distinction so it cannot be re-collapsed.
describe("sticky offsets are measured against the right box", () => {
  it("main is the shell's only scroller, which is what the rule below is about", () => {
    expect(read("components/console/AppShell.tsx")).toContain(
      '<main className="flex-1 overflow-x-hidden overflow-y-auto">',
    );
  });

  it("the table header carries NO top offset — its scrollport is the card", () => {
    expect(STATES_HEAD_STICKY).toContain("sticky top-0");
    expect(STATES_HEAD_STICKY).not.toMatch(/top-\[/);
    expect(STATES_HEAD_STICKY).not.toContain("57");
  });

  it("the table still wraps the table in a scroll container", () => {
    expect(read("components/console/PlaceStatesTable.tsx")).toContain(
      "overflow-x-auto",
    );
  });
});

describe("the container stays uncapped", () => {
  it("<main> has no max-width, or the full-bleed bar cannot reach the column", () => {
    const shell = read("components/console/AppShell.tsx");
    const main = shell.slice(shell.indexOf("<main"), shell.indexOf("</main>"));
    expect(main).not.toMatch(/max-w-/);
  });

  it("the gutter wrapper inside main is uncapped too", () => {
    const layout = read("app/(shell)/layout.tsx");
    expect(layout).toContain("flex w-full flex-col gap-4");
    expect(layout).not.toMatch(/max-w-\dxl/);
  });
  it("the rail is a fixed column, never a capped one", () => {
    const rail = read("components/console/Sidebar.tsx");
    expect(rail).not.toMatch(/max-w-\dxl/);
    expect(rail).toContain("h-full w-full");
  });
  it("the bleeding table never sets w-full — that would kill the breakout", () => {
    const table = read("components/console/PlaceStatesTable.tsx");
    const at = table.indexOf("SHELL_BLEED,");
    expect(at).toBeGreaterThan(-1);
    const block = table.slice(at - 400, at + 40);
    expect(block).not.toContain("w-full");
  });
});

describe("tab hrefs", () => {
  it("carry no organization: the place id names its holder (MESITA-1807)", () => {
    expect(placeTabHref("p-1", "settings")).toBe("/places/p-1/settings");
    expect(placeTabHref("p-1", "reviews")).toBe("/places/p-1/reviews");
  });
  it("agree with placeHref, which is Profile's address", () => {
    // placeHref writes the segment literally, because lib/place-tabs imports
    // from console-routes and reaching back would be a cycle. Two literals for
    // one route is exactly the drift that made /places/<id>/profile a 404, so
    // pin them together here instead.
    expect(placeHref("p-1")).toBe(placeTabHref("p-1", "profile"));
  });
  it("never return the bare place URL — every view has its own address", () => {
    for (const tab of PLACE_TABS) {
      expect(placeTabHref("p-1", tab)).not.toBe("/places/p-1");
      expect(placeTabHref("p-1", tab)).toBe(`/places/p-1/${tab}`);
    }
  });
  it("every tab maps to a route file on disk", () => {
    const shell = path.join(SRC, "app", "(shell)");
    for (const tab of PLACE_TABS) {
      const segs = placeTabHref("ID", tab).slice(1).split("/");
      segs[1] = "[id]";
      expect(existsSync(path.join(shell, ...segs, "page.tsx"))).toBe(true);
    }
  });
  it("every route file on disk is a tab — no orphan segment", () => {
    // Together with the loop above this is a bijection: a tab with no route
    // fails there, a route with no tab fails here.
    const placeDir = path.join(SRC, "app", "(shell)", "places", "[id]");
    const segments = readdirSync(placeDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .filter((e) => existsSync(path.join(placeDir, e.name, "page.tsx")))
      .map((e) => e.name);
    expect(segments.sort()).toEqual([...PLACE_TABS].sort());
  });
});

describe("width buys density, not whitespace", () => {
  it("both place section grids reach three columns at xl", () => {
    for (const f of [
      "components/place-manage/sections/PlaceSection.tsx",
      "components/place-manage/sections/AdminSection.tsx",
    ]) {
      expect(read(f)).toContain("xl:columns-3");
    }
  });
});
