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
    expect(h).toContain("Partner");
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

// MESITA-1714. Pato rejected the nested rail on sight, and the reason is
// measurable: the ACTIVE row is almost always a leaf, so grouping by indent
// puts the most important row on screen at the deepest inset.
// MESITA-1715. The rail lists the PLACES, not a link to a list of them, and
// Pato rejected the tree-shaped version on sight: grouping by indent puts the
// active row at the deepest inset and inverts hierarchy.
//
// MESITA-1734 REPLACES THIS RULE RATHER THAN DELETING IT, and the distinction
// is the whole point. Pato: "make places like in boxes, with some toggle or
// something like that. it must feel more modular." A place is now a container
// you open and close — which sounds like the tree that was rejected twice, and
// is not.
//
// What 1714/1715 rejected was INDENTATION as the grouping mechanism. A box
// groups by common region — a shared edge and ground — so the rows inside it
// sit at the SAME left inset as the rows outside it. The grouping goal
// survives; the inverted hierarchy that killed the tree does not.
//
// So the invariant tightens instead of relaxing: 1714 allowed exactly one
// indent, and this file now allows ZERO. If an inset ever comes back, the tree
// is growing back inside the boxes and this describe block is what catches it.
describe("containers group the rail; indentation never does", () => {
  const rail = () => readCode("components/console/Sidebar.tsx");

  it("indents NOTHING — the box edge does what the inset used to", () => {
    // Strictly stronger than the MESITA-1714 rule it replaces, which permitted
    // one `inset` for the open place's views. Those views now live inside the
    // box at its own inset, so the prop has no remaining call site and the
    // NavRow signature no longer offers one.
    const r = rail();
    expect(r).not.toContain("paddingLeft");
    expect(r).not.toMatch(/^\s*inset$/m);
    expect(r).not.toContain("inset?:");
    expect(r).not.toContain("pl-8");
  });

  it("the box is a container, not a tree node", () => {
    // A container is a border and a ground. A tree node is a rule running down
    // the column and a bullet hanging off it — the shapes 1714 threw out, and
    // the easiest thing to reintroduce while calling it a card.
    const r = rail();
    expect(r).toContain("border-sidebar-border border");
    expect(r).toContain("WELL_BG");
    expect(r).not.toMatch(/border-l-\d/);
    expect(r).not.toMatch(/rounded-full["\s]*\/>/);
  });

  it("groups with a label, never a tree line or a bullet", () => {
    expect(rail()).toContain("SectionBreak");
    expect(rail()).toContain("TINY_LABEL_CLASS");
    expect(rail()).not.toMatch(/rounded-full["\s]*\/>/);
  });

  it("lists the org's places themselves, not a link to a filtered list", () => {
    expect(rail()).toContain("listRailPlacesAction");
    expect(rail()).toContain("places.map(renderPlace)");
    // The old Org Places LINK is gone; the places themselves replaced it.
    // "Org Places" survives as the section's label, which is a heading, not a
    // destination — so the rule is about the href, not the words.
    expect(rail()).not.toContain('placesHref("org")');
    expect(rail()).toContain('<SectionBreak label="Org Places"');
  });

  it("All Places is separated from the boxes by a rule", () => {
    // A stack of containers followed by an uncontained row of the same width
    // reads as one group, and All Places is a link to a list rather than one
    // of the places above it. Containment says "these are places"; the
    // hairline says "this is not one of them".
    const r = rail();
    const at = (needle: string) => r.indexOf(needle);
    expect(at("places.map(renderPlace)")).toBeLessThan(
      at("border-sidebar-border mx-2 mt-3 mb-1 border-t"),
    );
    expect(at("border-sidebar-border mx-2 mt-3 mb-1 border-t")).toBeLessThan(
      at('label="All Places"'),
    );
  });

  it("has NO Public Places row — a complement is not a destination", () => {
    // Org places are a SUBSET of All Places and earn a row. Public is All
    // minus Org, which is what the Owned column already says on every row.
    expect(rail()).not.toContain('label="Public Places"');
    expect(rail()).not.toContain('placesHref("public")');
  });

  it("still supports ?owned=public as a URL", () => {
    // It stopped being a destination, not a capability: a bookmark must not
    // start 404ing because a menu row was removed.
    expect(ownedFromParam("public")).toBe("public");
    expect(placesHref("public")).toBe("/places?owned=public");
  });

  it("orders the nav Organization → places → All Places", () => {
    // Organization keeps the top because it SCOPES the places under it — that
    // is the one real grouping in this rail — and All Places closes the places
    // area rather than sitting in the footer, because a place list belongs
    // with place lists.
    const r = rail();
    const at = (needle: string) => r.indexOf(needle);
    expect(at('label="Organization"')).toBeLessThan(at("places.map(renderPlace)"));
    expect(at("places.map(renderPlace)")).toBeLessThan(at('label="All Places"'));
    expect(at('label="All Places"')).toBeLessThan(at("</nav>"));
  });

  it("Account is at the TOP, and is not shaped like a nav row", () => {
    // MESITA-1734 reverses 1716's placement on Pato's instruction ("Account
    // must be at the top"), but NOT the reason 1716 moved it: beside
    // Organization it read as a PAIR of equal-weight rows, and the two are not
    // one — Organization is the entity whose data is on screen, Account is who
    // is looking at it.
    //
    // Moving the same ROW back up would rebuild that pair exactly. So the rule
    // that survives is about SHAPE, not position: whatever carries Account, it
    // must not be a NavRow. Both halves are asserted, because either one alone
    // permits the mistake.
    const r = rail();
    const at = (needle: string) => r.indexOf(needle);
    // Above the nav entirely — not merely first inside it.
    expect(at('aria-label="Account"')).toBeGreaterThan(-1);
    expect(at('aria-label="Account"')).toBeLessThan(at("<nav"));
    // And never a row: a NavRow with the person glyph is precisely the pair
    // 1716 broke apart.
    //
    // Anchored to the start of a line, because `aria-label="Account"` — which
    // the identity BUTTON legitimately carries — contains `label="Account"` as
    // a substring. A bare `not.toContain` here fails on the correct code.
    expect(r).not.toMatch(/^\s*label="Account"/m);
    expect(r).not.toContain("Icon={UserRound}");
  });

  it("the footer holds the rail's own control and nothing else", () => {
    // Account left for the top; what remains below </nav> is the one button
    // that acts on the rail rather than navigating anywhere. A destination
    // down there would be a second nav nobody scrolls to.
    const r = rail();
    const footer = r.slice(r.indexOf("</nav>"));
    expect(footer).toContain("onToggleCollapse");
    expect(footer).not.toContain("<NavRow");
  });

  it("gives every place its own photo, never the shared glyph", () => {
    // Six identical Store glyphs is six copies of one row with different
    // words on them.
    expect(rail()).toContain("thumb={placeThumbUrl(place.photoUrl, THUMB_PX)}");
  });

  it("NEVER points an img at the full-resolution original", () => {
    // photoUrl is an 8MB-ceiling original in place-images. placeThumbUrl
    // rewrites it to the /render/image/ transform — measured 274KB to 3KB
    // (MESITA-1553). The rail renders on EVERY screen in the console, so
    // getting this wrong costs more here than it did on the list.
    const r = readCode("components/console/Sidebar.tsx");
    expect(r).toContain("placeThumbUrl(");
    expect(r).not.toMatch(/src=\{[^}]*photoUrl[^}]*\}/);
  });

  it("falls back to a glyph when a place has no photo yet", () => {
    // A hole in the column, or a broken-image icon, is worse than a generic
    // storefront.
    const r = readCode("components/console/Sidebar.tsx");
    expect(r).toContain("thumb ? (");
    expect(r).toContain("<Icon className=");
  });

  it("the photo is decorative — the label already names the place", () => {
    // Announcing the name twice is noise on a screen reader, not access.
    expect(rail()).toContain('alt=""');
    expect(rail()).toContain('loading="lazy"');
  });

  it("MANY places can be open at once, and the set outlives a reload", () => {
    // REVERSES the MESITA-1715 rule that exactly one place could be open.
    // That rule was not a preference, it was a consequence: `openPlace` is a
    // single published value, so two expanded places were not representable.
    // Pato asked for per-place toggles (MESITA-1734 D2), so open-ness is now
    // its OWN state — a set — rather than a shadow of the route.
    const r = rail();
    expect(r).toContain("useState<Set<string>>");
    expect(r).toContain("openIds.has(place.id)");
    // On a cookie, not localStorage: the server layout reads it during render,
    // so the column paints at its final HEIGHT on the first frame. This is the
    // same trick the collapsed width uses and it matters more here — a wrong
    // first frame costs rows, not pixels.
    expect(r).toContain("RAIL_OPEN_PLACES_COOKIE");
    expect(r).not.toContain("localStorage");
    expect(readCode("app/(shell)/layout.tsx")).toContain("parseOpenPlaceIds");
  });

  it("arriving at a place opens it once, and never re-opens it", () => {
    // Before boxes, reaching a place always revealed its views; losing that
    // would make the rail worse for the sake of the new control. So arrival
    // opens the box — but only on the transition INTO that place, tracked by a
    // ref. Without the ref the effect re-opens the box on the very next render
    // after the operator collapses it, and the chevron looks broken.
    const r = rail();
    expect(r).toContain("autoOpened");
    expect(r).toContain("useRef<string | null>(null)");
    expect(r).toContain("if (autoOpened.current === openPlaceId) return;");
  });

  it("the chevron toggles and NEVER routes through the unsaved-edits guard", () => {
    // Toggling a box navigates nowhere and therefore discards nothing.
    // Guarding it would offer to throw away work in exchange for nothing —
    // the same mistake as guarding the row you are already on.
    const r = rail();
    const button = r.slice(r.indexOf("onClick={onToggle}"));
    const end = button.indexOf("</button>");
    expect(button.slice(0, end)).not.toContain("onGuardedNavigate");
    expect(button.slice(0, end)).not.toContain("guardNav");
    // Every LINK out of the rail still answers to it.
    expect(r).toContain("onGuardedNavigate");
  });

  it("renders no place section until there is a place in it", () => {
    // An empty labelled section is a promise the rail cannot keep, and a new
    // organization holds nothing.
    expect(r_hasGuard(rail())).toBe(true);
  });

  it("paints exactly one filled pill for one location", () => {
    // The place row's href IS Profile's href. Pilling both would put two
    // solid rows and two aria-current markers on one location, and "you are
    // here" stops meaning one row. Open, the place row is a heading.
    const r = rail();
    expect(r).toContain("active={false}");
    expect(r).toContain("heading={open || headerIsActive}");
    expect(r).toContain("ROW_HEADING");
    // A heading is bold, never filled — a fill is what `active` means.
    const h = r.slice(r.indexOf("const ROW_HEADING"));
    expect(h.slice(0, h.indexOf(";"))).not.toContain("bg-foreground");
  });

  it("a SHUT box holding the current route keeps the marker", () => {
    // The landmine of per-place toggles, and the reason this test exists at
    // all. Box state and route state are now independent, so collapsing the
    // box you are inside would bury the pill AND `aria-current="page"` in a
    // hidden subtree — sighted and screen-reader users lose "you are here"
    // identically. The marker therefore migrates to the header.
    const r = rail();
    expect(r).toContain("const headerIsActive = ownsRoute && !open;");
    expect(r).toContain("headerIsActive && ROW_ACTIVE");
    // And it names the VIEW too. Without the trailing label a shut box says
    // which place is current but not which of its four views, which is half
    // the orientation.
    expect(r).toContain("PLACE_TAB_LABEL[activeTab]");
    // The two markers are mutually exclusive by construction: `headerIsActive`
    // requires `!open`, and the view rows only render when `open`.
    expect(r).toContain("const showViews = open && tabs.length > 0;");
  });

  it("never calls an unloaded list foreign", () => {
    // While the fetch is in flight `places` is empty, so an owned place would
    // render as a standalone foreign section and then jump into the portfolio
    // when the list lands. Unknown is not the same as foreign.
    const r = rail();
    const block = r.slice(r.indexOf("const openIsForeign"));
    expect(block.slice(0, block.indexOf(";"))).toContain("loaded &&");
  });

  it("refetches the portfolio when a claim or release lands", () => {
    // revalidatePath refreshes the places TABLE but cannot re-run a client
    // effect, so without this a place you just claimed stays off the rail
    // until a reload.
    expect(rail()).toContain("portfolioVersion");
    expect(readCode("components/console/PlaceHoldButton.tsx")).toContain(
      "bumpPortfolio()",
    );
  });

  it("renders exactly the views the viewer may open", () => {
    // visibleTabs() returns 1 to 4. A greyed-out row for a view you cannot
    // open is a worse answer than no row — and a box for a place you are NOT
    // on shows a header alone, because the rail cannot know your permissions
    // for a place whose layout has not published them.
    const r = rail();
    expect(r).toContain("openPlace?.id === id ? openPlace.tabs : []");
    expect(r).toContain("tabs.map((tab)");
    expect(r).not.toContain("disabled");
  });

  it("the disclosure is a disclosure, not a tablist", () => {
    // The four views are ROUTES, not panels. Labelling them a tablist makes a
    // screen reader promise panel-switching that navigation then breaks, and
    // hands the arrow keys a job they cannot do here.
    const r = rail();
    expect(r).toContain("aria-expanded={open}");
    expect(r).toContain("aria-controls={showViews ? viewsId : undefined}");
    // Named, not a bare glyph: "button, collapsed" says nothing about WHAT.
    expect(r).toMatch(/aria-label=\{`\$\{open \? "Collapse" : "Expand"\} \$\{place\.name\}`\}/);
    expect(r).not.toContain('role="tablist"');
    expect(r).not.toContain('role="tab"');
  });

  it("has NO boxes when the rail is collapsed", () => {
    // 64px cannot hold a container, a thumb, a name and a chevron, and a
    // container with nothing to contain is ornament. Collapsed, the rail is
    // the flat icon column it has always been.
    const r = rail();
    const branch = r.slice(r.indexOf("if (collapsed) {"));
    expect(branch.slice(0, branch.indexOf("return (\n      <PlaceBox"))).not.toContain(
      "<PlaceBox",
    );
    expect(r).toContain("collapsed\n");
  });

  it("no two DIFFERENT rows share an icon", () => {
    // Account and Profile both used to be UserRound, and Organization and Org
    // Places both used to be Building2 — which is how a menu starts reading as
    // mush.
    //
    // Counted as a SET rather than as a duplicate-free list (MESITA-1734): a
    // place row now has two call sites, the box and the collapsed fallback,
    // and both must use `Store` — identical icons for the identical row are
    // the correct answer, not a collision. What must stay distinct is the set
    // of DIFFERENT rows.
    const r = rail();
    const icons = (r.match(/Icon=\{(\w+)\}/g) ?? []).map((m) =>
      m.replace(/Icon=\{|\}/g, ""),
    );
    expect(new Set(icons)).toEqual(new Set(["Building2", "Store", "Layers"]));

    // The four view glyphs must be distinct from each other AND from the rows
    // above them — this is where mush actually starts, and the old
    // duplicate-free check never looked inside TAB_ICON at all.
    const table = r.slice(r.indexOf("const TAB_ICON"));
    const tabIcons = (table.slice(0, table.indexOf("};")).match(/:\s*(\w+),/g) ?? [])
      .map((m) => m.replace(/[:,\s]/g, ""));
    expect(tabIcons).toHaveLength(PLACE_TABS.length);
    expect(new Set(tabIcons).size).toBe(tabIcons.length);
    for (const icon of tabIcons) expect(new Set(icons).has(icon)).toBe(false);
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

describe("Capabilities first paint is a row list, not a meter (MESITA-1739)", () => {
  it("the loading skeleton is rows, not Profile's photo band", () => {
    const s = read("app/(shell)/places/[id]/capabilities/loading.tsx");
    expect(s).not.toContain("h-[420px]");
    expect(s).not.toContain("PlaceViewSkeleton");
    expect(s).toContain("Loading capabilities");
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
    expect(s).toContain("dirtyLabels.includes(\"Orders\")");
    expect(s).toContain("dirtyLabels.includes(\"Reservations\")");
  });
});

/** The place section must be conditional on the list being non-empty. */
function r_hasGuard(src: string): boolean {
  return /\{places\.length > 0 && \(/.test(src);
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
