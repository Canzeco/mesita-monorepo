// The two-row header's invariants (MESITA-1558).
//
// Every rule here is a pairing between two things that must agree and that no
// compiler checks: a Tailwind literal against the constant it encodes, a
// negative margin against the padding it cancels, a component against the
// context it may not import. Each one, when broken, ships something that looks
// fine on the viewport a developer checks first.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as uiClasses from "./ui-classes";
import { STATES_HEAD_STICKY, SHELL_BLEED, SHELL_GUTTER } from "./ui-classes";
import { PLACE_TABS, placeTabHref } from "./place-tabs";
import { ownedFromParam, placeHref, placesHref } from "./console-routes";
import { parsePortfolioOpen, serializePortfolioOpen } from "./sidebar-prefs";

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
      return { prefix, want: `${prefix ? `${prefix}:` : ""}-${util.replace("px-", "mx-")}` };
    });
    for (const { want } of pairs) {
      expect(SHELL_BLEED.split(" ")).toContain(want);
    }
    expect(SHELL_BLEED.split(" ")).toHaveLength(SHELL_GUTTER.split(" ").length);
  });
});

// MESITA-1714. The bar is gone. Its name and its four tabs both live in the
// rail now, so a sticky row restating them was 48px of chrome saying what the
// column beside it already said. What survived is the h1 — as a page title in
// the content flow, not as chrome.
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
  });

  it("the three superseded components are deleted, not orphaned", () => {
    for (const f of ["PlaceBar.tsx", "PlaceTabs.tsx", "GuardedPlaceTabs.tsx"]) {
      expect(existsSync(path.join(SRC, "components", "console", f))).toBe(false);
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
    // throw work away for nothing. The deleted PlaceTabs skipped the guard on
    // the active tab; losing that on the way into the rail was a regression.
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
    // Both wordmarks go to Organization, and the Organization ROW is guarded.
    // One of them silently discarding edits while the other asks is worse than
    // either rule applied consistently.
    expect(readCode("components/console/Sidebar.tsx")).toContain(
      "guardNav?.(href(SHELL_ROUTES.organization), e)",
    );
    expect(readCode("components/console/AppShell.tsx")).toContain("guardNav?.(");
  });

  it("the provider wraps the shell, so the topbar can see the guard", () => {
    // A hook cannot see a provider its own component renders.
    expect(readCode("components/console/AppShell.tsx")).not.toContain(
      "<OpenPlaceProvider>",
    );
    expect(readCode("app/(shell)/layout.tsx")).toContain("<OpenPlaceProvider>");
  });

  it("every rail row routes through the guard when one exists", () => {
    const rail = readCode("components/console/Sidebar.tsx");
    const rows = rail.match(/<NavRow/g) ?? [];
    expect(rows.length).toBeGreaterThan(3);
    expect((rail.match(/onGuardedNavigate=/g) ?? []).length).toBe(rows.length);
  });
});

// MESITA-1779. The rail is flat: five things at one x, two kinds of toggle
// (ORG PLACES, and each place), and an open place told apart by its GROUND.
// This block replaces the MESITA-1734 box rules and keeps the one rule that
// has outlived every redesign of this rail: nothing indents. Pato rejected a
// tree twice (1714, 1715); the ground groups without an inset and, since the
// 2026-09-12 board, without a border either.
describe("the rail is flat: toggles group it, insets and borders never do", () => {
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

  it("an open place is a ground, never a bordered box", () => {
    // The 1734 box drew `border-sidebar-border border` around the well. The
    // ground alone is the container now, and its 2px padding is paid for by a
    // -2px margin so the rows inside keep the x of the rows outside.
    const r = rail();
    expect(r).toContain("WELL_BG");
    const at = r.indexOf("open && cn(WELL_BG");
    expect(at).toBeGreaterThan(-1);
    const wrapper = r.slice(at, r.indexOf(")", at));
    expect(wrapper).not.toContain("border");
    expect(wrapper).toContain("-mx-0.5 p-0.5");
  });

  it("ORG PLACES is a toggle — a button, never a link to a filtered list", () => {
    const r = rail();
    expect(r).toMatch(/<SectionToggle\s+label="Org Places"\s+count=\{places\.length\}/);
    expect(r).not.toContain('placesHref("org")');
    // The toggle is a disclosure with a name that says what it hides.
    const toggle = r.slice(r.indexOf("function SectionToggle"), r.indexOf("function PlaceRow"));
    expect(toggle).toContain('type="button"');
    expect(toggle).toContain("aria-expanded={open}");
    expect(toggle).toContain("aria-controls={open ? controls : undefined}");
    expect(toggle).toMatch(/aria-label=\{`\$\{verb\} \$\{label\} \(\$\{count\}\)`\}/);
    expect(toggle).not.toContain("href");
    // It wears the eyebrow's own class, so it cannot read as a row you are at.
    expect(toggle).toContain("TINY_LABEL_CLASS");
  });

  it("the portfolio arrives with the organization: no fetch, no retry, no empty frame", () => {
    // The rail used to list its places through a server action after
    // hydration, one round trip after the frame — or never, behind a Retry.
    const r = rail();
    expect(r).toContain("const places = activeOrg?.places ?? [];");
    expect(r).not.toContain("listRailPlacesAction");
    expect(r).not.toContain("Retry");
    expect(r).not.toContain("failed");
    expect(readCode("app/(shell)/actions/places.ts")).not.toContain("listRailPlacesAction");
    // ONE call feeds the switcher and the rail, and the layout hands both down.
    const layout = readCode("app/(shell)/layout.tsx");
    expect(layout).toContain("apiConsoleViewer(supabase)");
    expect(layout).toContain("isSuperAdmin={viewer.isSuperAdmin}");
    expect(layout).toContain("places: o.places,");
  });

  it("every held place opens to its views without being visited", () => {
    // The chevron on a place you were not on used to open an EMPTY box: the
    // views were known only for the place whose layout had published them.
    const r = rail();
    expect(r).toContain("tabsForAccess({");
    expect(r).toContain("held: true,");
    expect(r).toContain("role: activeOrg?.myRole ?? null,");
    // The place you are ON still shows the server's answer.
    expect(r).toContain("openPlace?.id === id ? openPlace.tabs : derivedTabs");
    expect(r).not.toContain("disabled");
  });

  it("the tab matrix is ONE function, read by the rail and the place layout alike", () => {
    expect(readCode("lib/place-view.ts")).toContain("return tabsForAccess({");
    expect(readCode("lib/place-tabs.ts")).toContain("export function tabsForAccess(");
  });

  it("Account is the FIRST row, and the switcher stands between it and Organization", () => {
    // Pato listed Account first (2026-09-12). MESITA-1716's objection — that
    // beside Organization it reads as a pair — is answered by structure: the
    // switcher sits between the two, so they never share a group edge.
    const r = rail();
    const at = (needle: string) => r.indexOf(needle);
    expect(at('label="Account"')).toBeGreaterThan(at("<nav"));
    expect(at('label="Account"')).toBeLessThan(at('label="Organization"'));
    expect(at('aria-label="Switch organization"')).toBeLessThan(at("<nav"));
    expect(r).toContain("Icon={UserRound}");
    // The 1734 identity chip beside the wordmark is gone.
    expect(r).not.toContain('aria-label="Account"');
  });

  it("orders the nav Account → Organization → places → All Places", () => {
    const r = rail();
    const at = (needle: string) => r.indexOf(needle);
    expect(at('label="Account"')).toBeLessThan(at('label="Organization"'));
    expect(at('label="Organization"')).toBeLessThan(at("listed.map(renderPlace)"));
    expect(at("listed.map(renderPlace)")).toBeLessThan(at('label="All Places"'));
    expect(at('label="All Places"')).toBeLessThan(at("</nav>"));
  });

  it("All Places is separated from the places by a rule", () => {
    // A run of places followed by an uncontained row of the same width reads
    // as one group, and All Places is a link to a list rather than one of the
    // places above it.
    const r = rail();
    const at = (needle: string) => r.indexOf(needle);
    expect(at("listed.map(renderPlace)")).toBeLessThan(
      at("border-sidebar-border mx-2 mt-3 mb-1 border-t"),
    );
    expect(at("border-sidebar-border mx-2 mt-3 mb-1 border-t")).toBeLessThan(
      at('label="All Places"'),
    );
  });

  it("has NO Public Places row — a complement is not a destination", () => {
    expect(rail()).not.toContain('label="Public Places"');
    expect(rail()).not.toContain('placesHref("public")');
  });

  it("still supports ?owned=public as a URL", () => {
    expect(ownedFromParam("public")).toBe("public");
    expect(placesHref("public")).toBe("/places?owned=public");
  });

  it("the footer holds the rail's own control and nothing else", () => {
    const r = rail();
    const footer = r.slice(r.indexOf("</nav>"));
    expect(footer).toContain("onToggleCollapse");
    expect(footer).not.toContain("<NavRow");
  });

  it("gives every place its own photo, never the shared glyph", () => {
    expect(rail()).toContain("thumb={placeThumbUrl(place.photoUrl, THUMB_PX)}");
  });

  it("NEVER points an img at the full-resolution original", () => {
    // photoUrl is an 8MB-ceiling original in place-images. placeThumbUrl
    // rewrites it to the /render/image/ transform (MESITA-1553), and the rail
    // renders on EVERY screen in the console.
    const r = rail();
    expect(r).toContain("placeThumbUrl(");
    expect(r).not.toMatch(/src=\{[^}]*photoUrl[^}]*\}/);
  });

  it("falls back to a glyph when a place has no photo yet", () => {
    const r = rail();
    expect(r).toContain("thumb ? (");
    expect(r).toContain("<Icon className=");
  });

  it("the photo is decorative — the label already names the place", () => {
    expect(rail()).toContain('alt=""');
    expect(rail()).toContain('loading="lazy"');
  });

  it("MANY places can be open at once, and the set outlives a reload", () => {
    const r = rail();
    expect(r).toContain("useState<Set<string>>");
    expect(r).toContain("openIds.has(place.id)");
    // On a cookie, not localStorage: the server layout reads it during render,
    // so the column paints at its final HEIGHT on the first frame.
    expect(r).toContain("RAIL_OPEN_PLACES_COOKIE");
    expect(r).not.toContain("localStorage");
    expect(readCode("app/(shell)/layout.tsx")).toContain("parseOpenPlaceIds");
  });

  it("ORG PLACES remembers being shut on its own cookie, and is open by default", () => {
    const r = rail();
    expect(r).toContain("RAIL_PORTFOLIO_COOKIE");
    expect(r).toContain("useState(defaultPortfolioOpen)");
    expect(readCode("app/(shell)/layout.tsx")).toContain("parsePortfolioOpen(");
    // Open is the ABSENT cookie; only shut is ever stored, and garbage opens.
    expect(parsePortfolioOpen(undefined)).toBe(true);
    expect(parsePortfolioOpen("")).toBe(true);
    expect(parsePortfolioOpen("garbage")).toBe(true);
    expect(parsePortfolioOpen("0")).toBe(false);
    expect(serializePortfolioOpen(true)).toBe("");
    expect(serializePortfolioOpen(false)).toBe("0");
  });

  it("a SHUT portfolio keeps the current place in view", () => {
    // Hiding every place would hide the pill and aria-current with it.
    const r = rail();
    expect(r).toContain("places.filter((p) => p.id === openPlaceId)");
    expect(r).toContain("listed.map(renderPlace)");
  });

  it("arriving at a place opens it once, and never re-opens it", () => {
    const r = rail();
    expect(r).toContain("autoOpened");
    expect(r).toContain("useRef<string | null>(null)");
    expect(r).toContain("if (autoOpened.current === openPlaceId) return;");
  });

  it("the toggles NEVER route through the unsaved-edits guard", () => {
    // Toggling navigates nowhere and therefore discards nothing. Guarding it
    // would offer to throw away work in exchange for nothing.
    const r = rail();
    const buttons = r.split("onClick={onToggle}").slice(1);
    expect(buttons.length).toBe(2); // the section toggle and the place chevron
    for (const b of buttons) {
      const body = b.slice(0, b.indexOf("</button>"));
      expect(body).not.toContain("onGuardedNavigate");
      expect(body).not.toContain("guardNav");
    }
    // Every LINK out of the rail still answers to it.
    expect(r).toContain("onGuardedNavigate");
  });

  it("renders no place section until there is a place in it", () => {
    expect(r_hasGuard(rail())).toBe(true);
  });

  it("paints exactly one filled pill for one location", () => {
    const r = rail();
    expect(r).toContain("active={false}");
    expect(r).toContain("heading={open || headerIsActive}");
    expect(r).toContain("ROW_HEADING");
    const h = r.slice(r.indexOf("const ROW_HEADING"));
    expect(h.slice(0, h.indexOf(";"))).not.toContain("bg-foreground");
  });

  it("a SHUT place holding the current route keeps the marker", () => {
    const r = rail();
    expect(r).toContain("const headerIsActive = ownsRoute && !open;");
    expect(r).toContain("headerIsActive && ROW_ACTIVE");
    expect(r).toContain("PLACE_TAB_LABEL[activeTab]");
    expect(r).toContain("const showViews = open && tabs.length > 0;");
  });

  it("the disclosures are disclosures, not tablists", () => {
    const r = rail();
    expect(r).toContain("aria-expanded={open}");
    expect(r).toContain("aria-controls={showViews ? viewsId : undefined}");
    expect(r).toMatch(/aria-label=\{`\$\{open \? "Collapse" : "Expand"\} \$\{place\.name\}`\}/);
    expect(r).not.toContain('role="tablist"');
    expect(r).not.toContain('role="tab"');
  });

  it("has NO toggles when the rail is collapsed", () => {
    // 64px cannot hold a name and a chevron, and a toggle with nothing to hide
    // is ornament. Collapsed, the rail is the flat icon column.
    const r = rail();
    const branch = r.slice(r.indexOf("if (collapsed) {"));
    expect(branch.slice(0, branch.indexOf("return (\n      <PlaceRow"))).not.toContain(
      "<PlaceRow",
    );
    expect(r).toContain('<SectionBreak label="Org Places" collapsed />');
  });

  it("no two DIFFERENT rows share an icon", () => {
    // Account and Profile both used to be UserRound, and Organization and Org
    // Places both used to be Building2 — which is how a menu starts reading as
    // mush. Counted as a SET: a place row has two call sites (the row and the
    // collapsed fallback) and both must use `Store`.
    const r = rail();
    const icons = (r.match(/Icon=\{(\w+)\}/g) ?? []).map((m) =>
      m.replace(/Icon=\{|\}/g, ""),
    );
    expect(new Set(icons)).toEqual(
      new Set(["UserRound", "Building2", "Store", "Layers"]),
    );
    const table = r.slice(r.indexOf("const TAB_ICON"));
    const tabIcons = (table.slice(0, table.indexOf("};")).match(/:\s*(\w+),/g) ?? [])
      .map((m) => m.replace(/[:,\s]/g, ""));
    expect(tabIcons).toHaveLength(PLACE_TABS.length);
    expect(new Set(tabIcons).size).toBe(tabIcons.length);
    for (const icon of tabIcons) expect(new Set(icons).has(icon)).toBe(false);
  });

  it("view rows prefetch their whole route on hover", () => {
    // The tab body waits on an Edge Function (~550ms p50). Hovering the row
    // starts that wait before the click does; the skeleton covers the rest.
    const r = rail();
    expect(r).toContain("unstable_dynamicOnHover");
    expect((r.match(/^\s*hoverPrefetch$/gm) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("switching organizations navigates instead of reloading the document", () => {
    const r = rail();
    expect(r).toContain("router.push(switchHref(e.target.value))");
    expect(r).not.toContain("window.location");
  });

  it("a claim or release refreshes the rail through the server tree", () => {
    // The rail draws its places from the layout's props now, so the signal is
    // a router refresh from the button that moved the place — not a client
    // refetch keyed on a context counter.
    expect(readCode("components/console/PlaceHoldButton.tsx")).toContain("router.refresh()");
    expect(readCode("components/console/OpenPlace.tsx")).not.toContain("portfolioVersion");
    expect(rail()).not.toContain("portfolioVersion");
  });

  it("focus travels on the brand's ring, not the browser's", () => {
    expect(rail()).toContain("focus-visible:ring-sidebar-ring");
  });
});

// MESITA-1734. Boxes make this worse than it already was, which is why it is
// pinned here and not left to review.
//
// In Next 16 a route with no `loading.tsx` does NOT fall back to a parent's:
// LoadingBoundary returns a bare Fragment when `loading` is null, so the
// suspending segment finds no boundary and the router keeps the PREVIOUS
// screen painted (MESITA-1729 found this on Organization). Sibling tab
// navigation does not re-run `places/[id]/layout.tsx` either, so
// `[id]/loading.tsx` is not the boundary for a tab click — the changed segment
// is the tab, and every tab page awaits `getManagePlace(id)` on its own.
//
// The failure mode is specific to this design: the chevron opens a box, the
// pill moves, and the content underneath stays on the previous view for the
// duration. That reads as a broken toggle, not a slow one.
describe("every place view has its own loading boundary", () => {
  const VIEWS = path.join(SRC, "app/(shell)/places/[id]");

  // A BIJECTION, not a one-way loop. Asserting only "every tab has a
  // loading.tsx" passes just as happily when a fifth view directory appears
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
    expect(s).toContain("aria-hidden=\"true\"");
    expect(s).toContain("sr-only");
    // And the pulse stops for anyone who asked motion to stop.
    expect(s).toContain("motion-reduce:animate-none");
  });
});

/** The place section must be conditional on the list being non-empty. */
function r_hasGuard(src: string): boolean {
  return /\{places\.length > 0 &&/.test(src);
}

// MESITA-1637, moved by MESITA-1710. The console is driven in a chromeless
// desktop window, so the address bar is not on screen and nothing else in the
// product says which route you are on. The top bar used to say it; a 240px
// rail has no room for a uuid, so it moved to the content column's header.
// Every rule below is the same rule, pointed at its new home.
describe("the console header names the route", () => {
  const hdr = () => read("components/console/ConsoleHeader.tsx");

  it("renders pathname AND query — ?org= is half the answer", () => {
    // A bare /places is ambiguous the moment an account holds two orgs, which
    // is exactly when a person needs to be told where they are.
    expect(hdr()).toContain("const route = q ? `${pathname}?${q}` : pathname");
  });

  it("is an anchor, so the browser's own copy-link works on it", () => {
    // A <span> would be a readout you cannot do anything with, and doing
    // something with it is most of the point.
    expect(hdr()).toMatch(/<Link\s+href=\{route\}/);
  });

  it("cannot grow the header — a place route carries a uuid", () => {
    const el = hdr().slice(hdr().indexOf("<Link\n        href={route}"));
    const cls = el.slice(el.indexOf("className="), el.indexOf(">\n        {route}"));
    expect(cls).toContain("truncate");
    expect(cls).toMatch(/max-w-\[/);
    expect(cls).toContain("shrink-0");
  });

  it("takes the ml-auto, and nothing else in the row holds one", () => {
    // Two ml-autos in one flex row is one too many: the second is inert and
    // the layout silently depends on source order.
    expect((hdr().match(/ml-auto/g) ?? []).length).toBe(1);
  });

  it("is rendered by the shell, so every screen gets it", () => {
    expect(read("components/console/AppShell.tsx")).toContain("<ConsoleHeader");
  });

  it("is a div, not a header — the rail is already the banner", () => {
    // Two <header> elements in one document give the page two banner
    // landmarks, and a screen reader's landmark list stops being a map.
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
    // The premise of the distinction: PlaceBar used to sit in this scrollport
    // and is gone, but the table below still lives in a nested one.
    expect(read("components/console/AppShell.tsx")).toContain(
      '<main className="flex-1 overflow-x-hidden overflow-y-auto">',
    );
  });

  it("the table header carries NO top offset — its scrollport is the card", () => {
    // PlaceStatesTable wraps the table in `overflow-x-auto`, and CSS forces
    // overflow-y to auto when the other axis is not visible, so that div is
    // the scrollport. A `top-[57px]` there is measured from inside the card,
    // not from the page, and shifts the header down at scroll position 0 —
    // surfacing the first row's thumbnail above the labels and clipping the
    // rest against the card's overflow-hidden.
    expect(STATES_HEAD_STICKY).toContain("sticky top-0");
    expect(STATES_HEAD_STICKY).not.toMatch(/top-\[/);
    expect(STATES_HEAD_STICKY).not.toContain("57");
  });

  it("the table still wraps the table in a scroll container", () => {
    // The premise of the rule above. If this ever stops being true, the
    // header COULD stick to the page and the offset would become correct
    // again — so the two facts have to be read together.
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
    // The rail's width is the SHELL's call — it animates the column between
    // w-60 and w-16 — and the rail fills whatever it is given. A max-width on
    // the aside itself would fight that animation and desync the two.
    const rail = read("components/console/Sidebar.tsx");
    expect(rail).not.toMatch(/max-w-\dxl/);
    expect(rail).toContain("h-full w-full");
  });
  it("the bleeding table never sets w-full — that would kill the breakout", () => {
    // align-self: stretch only widens a flex item whose width is `auto`. This
    // rule used to guard PlaceBar, which was the other breakout; MESITA-1714
    // deleted it, and the trap moved with the invariant rather than dying with
    // the component. PlaceStatesTable is the last thing in this app that
    // cancels the gutter, which is why the pairing above is still load-bearing.
    const table = read("components/console/PlaceStatesTable.tsx");
    const at = table.indexOf("SHELL_BLEED,");
    expect(at).toBeGreaterThan(-1);
    // The cn() call that applies the bleed, and the class string beside it.
    const block = table.slice(at - 400, at + 40);
    expect(block).not.toContain("w-full");
  });
});

describe("tab hrefs", () => {
  it("carry the organization, so a tab click cannot move the switcher", () => {
    expect(placeTabHref("p-1", "capabilities", "org-9")).toBe(
      "/places/p-1/capabilities?org=org-9",
    );
    expect(placeTabHref("p-1", "profile", "org-9")).toBe(
      "/places/p-1/profile?org=org-9",
    );
  });
  it("agree with placeHref, which is Profile's address", () => {
    // placeHref writes the segment literally, because lib/place-tabs imports
    // withOrg from console-routes and reaching back would be a cycle. Two
    // literals for one route is exactly the drift that made
    // /places/<id>/profile a 404, so pin them together here instead.
    expect(placeHref("p-1")).toBe(placeTabHref("p-1", "profile"));
  });
  it("never return the bare place URL — every view has its own address", () => {
    // The regression this exists to prevent (MESITA-1732). Profile used to BE
    // /places/<id>, so /places/<id>/profile answered 404 and the one view an
    // operator is likeliest to send a link to was the one with no link.
    for (const tab of PLACE_TABS) {
      expect(placeTabHref("p-1", tab)).not.toBe("/places/p-1");
      expect(placeTabHref("p-1", tab)).toBe(`/places/p-1/${tab}`);
    }
  });
  it("omit it cleanly when there is no active organization", () => {
    expect(placeTabHref("p-1", "activity")).toBe("/places/p-1/activity");
  });
  it("every tab maps to a route file on disk", () => {
    // Under a permanent header a mislabelled tab is a 404 the operator stares
    // at on every screen, not a link they might never click.
    //
    // This was VACUOUS for Profile until MESITA-1732. It derives the path from
    // placeTabHref itself, and placeTabHref said Profile was the bare
    // /places/<id> — so the loop just re-checked the bare page.tsx that already
    // existed, and /places/<id>/profile could 404 in production with this test
    // green. Deriving the expectation from the function under test is the whole
    // flaw; the sibling test below closes the loop from the other direction.
    const shell = path.join(SRC, "app", "(shell)");
    for (const tab of PLACE_TABS) {
      const segs = placeTabHref("ID", tab).slice(1).split("/");
      segs[1] = "[id]";
      expect(existsSync(path.join(shell, ...segs, "page.tsx"))).toBe(true);
    }
  });
  it("every route file on disk is a tab — no orphan segment", () => {
    // The opposite direction. Together with the loop above this is a bijection:
    // a tab with no route fails there, a route with no tab fails here. Either
    // alone can be satisfied while the rail and the filesystem disagree.
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
    // Without this the fluid container just makes a 44px-tall input 700px
    // wide: both grids are hard-capped at two columns otherwise.
    for (const f of [
      "components/place-manage/sections/PlaceSection.tsx",
      "components/place-manage/sections/AdminSection.tsx",
    ]) {
      expect(read(f)).toContain("xl:columns-3");
    }
  });
});
