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
import { PLACE_PAGES, placeHref } from "./console-routes";
import { LADDER_ZONES } from "@/components/place-manage/sections/controls/offerings";

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

  // MESITA-1842. Pato: "no mesita logo, fuck it." Both wordmarks are gone —
  // the rail's and the mobile topbar's — so the guard rule that covered them
  // has nothing to cover, and the only thing worth pinning is that they did
  // not come back. The desktop app's own title bar already says the product's
  // name; a second, quieter copy of it cost the rail its top row.
  it("neither the rail nor the topbar renders a wordmark", () => {
    for (const f of ["components/console/Sidebar.tsx", "components/console/AppShell.tsx"]) {
      const src = readCode(f);
      expect(src, f).not.toContain("MesitaLogo");
      expect(src, f).not.toContain("MesitaMark");
      expect(src, f).not.toContain("landingHref");
    }
    // The topbar says the SCOPE instead — the sentence the closed drawer hides.
    expect(readCode("components/console/AppShell.tsx")).toContain("scopeLine");
  });

  it("the provider wraps the shell, so the topbar can see the guard", () => {
    // A hook cannot see a provider its own component renders.
    expect(readCode("components/console/AppShell.tsx")).not.toContain(
      "<OpenPlaceProvider>",
    );
    expect(readCode("app/(shell)/layout.tsx")).toContain("<OpenPlaceProvider>");
  });

  it("every way out of the rail and the switchers routes through the guard when one exists", () => {
    const rail = readCode("components/console/Sidebar.tsx");
    // Rows ask before leaving a dirty place.
    expect(rail).toContain("if (!active) onGuardedNavigate?.(href, e);");
    // Both selectors are the rail's own since MESITA-1848, and both ask too:
    // the guard decides BEFORE the pending name is shown, or an operator sees
    // the new scope while still sitting on the old one's unsaved edits.
    const go = rail.slice(rail.indexOf("const go = ("));
    const goBody = go.slice(0, go.indexOf("};"));
    expect(goBody.indexOf("guardNav?.(href)")).toBeGreaterThan(-1);
    expect(goBody.indexOf("guardNav?.(href)")).toBeLessThan(goBody.indexOf("setChoice("));
    // Every ceremony in either MENU is a guarded link, never a bare one. The
    // NavRow's own <Link> guards through `onGuardedNavigate`, checked above.
    // The selectors render only in the states where they answer something
    // (MESITA-1879), and their ceremonies ride with them.
    const menus = rail.slice(rail.indexOf("<RailSelector"));
    for (const m of menus.match(/<Link\b[\s\S]*?<\/Link>/g) ?? []) {
      expect(m).toContain("guardNav?.(");
    }
  });
});

// The rail carries destinations and nothing else. The PLACE selector is the
// RAIL's (MESITA-1848, "better three sections"): it moved between the page and
// Account four times (1822, 1832, 1847, 1848) before settling beside the group
// of pages it scopes. Pato has rejected a tree twice (1714, 1715) and boxes
// once (1815); what he keeps coming back to is a selector beside the thing it
// selects. There was a second selector, for the organization, until
// MESITA-1892 — one option to select is a control over nothing, and with the
// layer gone there is no second scope at all.
describe("the rail is six nouns and one indent", () => {
  const rail = () => readCode("components/console/Sidebar.tsx");

  // THE FLAT LAW, THIRD REVISION (MESITA-1844).
  //
  // MESITA-1832 wrote it for six peer pages: an indent among equals is
  // decoration. MESITA-1841 spent one indent to separate two subjects.
  // MESITA-1842 headed both groups by name and took the indent back.
  // MESITA-1844 deletes the headers — four flat nouns need no eyebrow — and
  // spends the indent where Pato's drawing puts its asterisks: the place's
  // five, under the row they are about.
  //
  // What the law forbids, unchanged through all four: everything that was
  // only ever decoration — a tree line, a bullet, a box, a well, a second
  // eyebrow, a `role="group"` — and a SECOND depth, which is the point a rail
  // stops being a nav and becomes a file tree.
  it("indents NOTHING, and draws no tree line, bullet, box or well", () => {
    // MESITA-1879 flattened the column and MESITA-1892 removed the last thing
    // an indent could have meant: every row is about the one place, so there
    // is no parent for a child row to sit under. `ROW_INDENT` is gone rather
    // than left unused — an indent constant in a flat rail is an invitation
    // to re-nest it.
    const r = rail();
    expect(r).not.toContain("ROW_INDENT");
    expect(r).not.toContain("pl-7");
    expect(r).not.toContain("paddingLeft");
    expect(r).not.toMatch(/border-l-\d/);
    expect(r).not.toMatch(/rounded-full["\s]*\/>/);
    expect(r).not.toContain("<Scope");
    expect(r).not.toContain("<Seam");
    expect(r).not.toContain("WELL_BG");
    expect(r).not.toContain('role="group"');
  });

  // MESITA-1848. The groups are headed by SELECTORS, not by eyebrows: the
  // head of a group is the thing itself, and it is a control. An eyebrow says
  // the subject's noun a second time and does nothing.
  // MESITA-1849. Pato, on the first build: "this looks like shit. make it
  // cleaner." The selector was a 28px chip at x=10 and two lines tall, while
  // a row is a 14px icon at x=28 and one line — two glyph columns, three row
  // heights, and a parent whose label started LEFT of its own children's.
  // Rank is colour and position now, never size.
  it("the selector is the row's size and the row's glyph box", () => {
    const sel = readCode("components/console/RailSelector.tsx");
    // ONE GLYPH BOX, shared with the rail's ICON literal.
    expect(sel).toContain('"h-4 w-4 lg:h-3.5 lg:w-3.5 shrink-0');
    expect(rail()).toContain('const ICON = "h-4 w-4 shrink-0 lg:h-3.5 lg:w-3.5"');
    // ONE HEIGHT: the row's own padding literals, not a taller pair.
    expect(sel).toContain("min-h-11 lg:min-h-0 lg:py-2");
    // ONE LINE: no meta prop, so no second line can come back by prop.
    expect(sel).not.toContain("meta");
    // RANK BY COLOUR: the head is the bright one, its pages are muted.
    expect(sel).toContain("text-sidebar-foreground");
    expect(sel).toContain("font-semibold");
    expect(rail()).toContain("text-sidebar-muted hover:bg-sidebar-accent");
    // A SEAM, NOT AIR (MESITA-1851): with every row one height, a margin
    // stopped reading as a boundary, so each group after Account opens on the
    // footer's own hairline. ONE constant draws both.
    expect(rail()).toContain(
      'const SECTION_SEAM = "border-sidebar-border/50 mt-2 border-t pt-2"',
    );
    // ONE SEAM NOW (MESITA-1879): the rail is one flat column, so the only
    // boundary left is the one over Account — the person, below the business.
    // It was two while two selectors each opened a group.
    expect((rail().match(/className=\{SECTION_SEAM\}/g) ?? []).length).toBe(1);
    expect(rail()).not.toContain('className="mt-3"');
  });

  it("renders ONE selector, and it heads the rail wherever a place is known", () => {
    // MESITA-1899 reversed MESITA-1879's condition. The selector used to
    // render only at `multi`, on the reasoning that a control over one thing
    // selects nothing — true while the ORGANIZATION selector still headed the
    // column. MESITA-1892 deleted that one with the layer, so at solo (the
    // shape every real operator is in) the rail opened naming nothing.
    // It heads `solo` and `multi` now; `zero` and `unknown` still get none.
    const r = rail();
    expect(r).not.toContain("GroupHeader");
    expect(r).not.toContain("TINY_LABEL_CLASS");
    // ONE SELECTOR (MESITA-1892). There were two — an organization and one of
    // its places — and the layer is gone, so the only subject left is the
    // place. Still exactly one: heading the rail at solo did not add a second.
    expect((r.match(/<RailSelector/g) ?? []).length).toBe(1);
    expect(r).not.toContain('label="Switch organization"');
    expect(r).toContain('label="Switch place"');
    expect(r).toContain('scope.mode === "solo" || scope.mode === "multi"');
    // And the two states that must NOT get one keep their own branches: a
    // failed read must never name a place, and zero has none to name.
    expect(r).toContain('scope.mode === "zero" &&');
    // Account is NOT one: there is one of you, so a chevron would be a
    // control with nothing to control. Pato: "(No subitems)".
    const account = r.slice(r.indexOf("href={SHELL_ROUTES.account}"));
    expect(account.slice(0, account.indexOf("/>"))).not.toContain("Selector");
  });

  // MESITA-1803. The place picker grows a search field past a count, and the
  // count is ONE exported number. These are the pairings a compiler cannot
  // see: the rail reading the constant, and the two lines without which a
  // field inside a Radix menu does not work at all.
  it("the picker's threshold is read, never retyped", () => {
    const r = rail();
    expect(r).toContain("PLACE_SEARCH_MIN");
    // The failure this catches: someone inlines the digit, the constant and
    // the rail drift, and the field appears at a count no test names.
    expect(r).not.toMatch(/places\.length >= \d/);
    expect(r).not.toMatch(/places\.length >= 8/);
    // The field is above the radio group, never inside it — a search row
    // inside a radio group is announced as one of the options.
    const picker = r.slice(r.indexOf('label="Switch place"'));
    expect(picker.indexOf("<MenuSearch")).toBeGreaterThan(-1);
    expect(picker.indexOf("<MenuSearch")).toBeLessThan(
      picker.indexOf("<DropdownMenuRadioGroup"),
    );
    // And the way out stays outside the filter: "All places" is rendered
    // unconditionally, so a query that matches nothing still has a door.
    const footer = picker.slice(picker.indexOf("<DropdownMenuSeparator"));
    expect(footer).toContain("All places");
    expect(footer).not.toContain("placeSearch &&");
  });

  it("the menu's field survives Radix's typeahead and its own focus", () => {
    const sel = readCode("components/console/RailSelector.tsx");
    // Without stopPropagation the menu's typeahead eats every keystroke aimed
    // at the input; without onOpenAutoFocus the caret opens on a row instead
    // of the field. Both are one line, and both look removable.
    expect(sel).toContain("e.stopPropagation()");
    expect(sel).toContain("onOpenAutoFocus");
    // The field's keyboard is ONE exported function, which is what lets
    // components/console/rail-selector.test.ts press keys at it rather than
    // read this file. Inlining it back into the JSX puts the arrow keys
    // beyond reach of any test again.
    expect(sel).toContain("export function handleMenuSearchKeyDown");
    expect(sel).toContain("onKeyDown={handleMenuSearchKeyDown}");
  });

  // MESITA-1803, the second pass. Three failures the first build shipped, and
  // the wiring that answers each. What CAN be proven by calling a function is
  // proven in components/console/rail-selector.test.ts; these two are props
  // crossing a component boundary, which only the source shows.
  it("Escape is answered where Radix asks, not where the field is", () => {
    const sel = readCode("components/console/RailSelector.tsx");
    const rail = readCode("components/console/Sidebar.tsx");
    // FAILURE PREVENTED: the two-stage Escape silently stops working. Radix
    // dismisses from a document CAPTURE listener, so a bubble-phase handler
    // on the input never runs — the query could never clear, the menu just
    // closed. `DismissableLayer` calls `onEscapeKeyDown` BEFORE it checks
    // `defaultPrevented`, so the answer has to be the content's prop.
    expect(sel).toContain("onEscapeKeyDown?: (event: KeyboardEvent) => void");
    expect(sel).toContain("onEscapeKeyDown={onEscapeKeyDown}");
    expect(rail).toContain("onEscapeKeyDown={escapePlaceMenu}");
    expect(rail).toMatch(/escapePlaceMenu[\s\S]{0,200}e\.preventDefault\(\)/);
    // And the stage that lived in the input — where it could never fire — is
    // gone, not merely duplicated.
    expect(sel).not.toContain('if (value === "") return;');
  });

  it("the query dies with the menu, by every route out", () => {
    const sel = readCode("components/console/RailSelector.tsx");
    const rail = readCode("components/console/Sidebar.tsx");
    // FAILURE PREVENTED: a typed query outliving the menu. Clearing it inside
    // `pickPlace` covered ONE of four exits — Escape, a click outside and the
    // trigger all left it standing, and the next open showed a list filtered
    // by a word nobody could see. `onOpenChange` is every exit at once.
    expect(sel).toContain("onOpenChange?: (open: boolean) => void");
    expect(sel).toContain("<DropdownMenu modal={false} onOpenChange={onOpenChange}>");
    expect(rail).toContain("onOpenChange={closePlaceMenu}");
    expect(rail).toMatch(/closePlaceMenu[\s\S]{0,160}setPlaceQuery\(""\)/);
    // The reset that only covered picking a place is gone, not doubled up.
    const pick = rail.slice(rail.indexOf("const pickPlace"));
    expect(pick.slice(0, pick.indexOf("};"))).not.toContain("setPlaceQuery");
  });

  // MESITA-1848. The ceremonies live in the selectors' MENUS, never as rows:
  // a rail row is a destination, and "Create organization" is a thing you do
  // to the subject the selector names.
  it("keeps the one ceremony out of the menus, and renders no row that is not a page", () => {
    const r = rail();
    expect(r).not.toContain("<Picker");
    expect(r).not.toContain("<select");
    expect(r).not.toContain('label="Add place"');
    // "Create organization" LEFT WITH THE LAYER (MESITA-1892). There is no
    // legal person to create; the one ceremony is Add place.
    expect(r).not.toContain("Create organization");
    // "Add place" LEFT THE MENUS (MESITA-1879): it belongs to the zero state,
    // where it takes a row of its own and says what it is.
    expect(r).toContain('label="Add your place"');
    expect(r).toContain("All places");
    // One selector, in the rail. The page's copy is gone, or the two disagree.
    expect(existsSync(path.join(SRC, "components/console/OrgSwitcher.tsx"))).toBe(false);
    expect(existsSync(path.join(SRC, "components/console/ScopeSwitchers.tsx"))).toBe(false);
    expect(existsSync(path.join(SRC, "components/console/CreateOrganizationForm.tsx"))).toBe(false);
    expect(readCode("app/(shell)/places/[id]/settings/page.tsx")).not.toContain("Switcher");
    expect(readCode("components/console/AppShell.tsx")).toContain("<RailScopeProvider value={{ scope, places, isSuperAdmin }}>");
  });

  it("is ONE run over the contract's array, then Account (MESITA-1879)", () => {
    const r = rail();
    const nav = r.slice(r.indexOf("<nav"), r.indexOf("</nav>"));
    // ONE RUN, over a DECLARED list — that is what keeps the rail and the
    // route contract in step. It was two runs over two arrays while the rail
    // had two selectors; it is `RAIL_ROWS` now, and the render test walks the
    // same array rather than re-typing it.
    expect(nav).toContain("rows.map((row, i)");
    expect(r).toContain("RAIL_ROWS");
    expect(r).toContain("ZERO_PLACE_ROWS");
    // And nothing hand-writes a row list beside it.
    expect(nav).not.toContain("ORG_RAIL_TARGETS.map");
    expect(nav).not.toContain("placeRows.map((tab)");
    // ACCOUNT IS LAST, inside the landmark, under the one seam: the column
    // reads the business top to bottom, then you (MESITA-1879 reverses
    // MESITA-1844's row one).
    const iAccount = nav.indexOf("href={SHELL_ROUTES.account}");
    expect(iAccount).toBeGreaterThan(-1);
    expect(iAccount).toBeGreaterThan(nav.indexOf("rows.map((row, i)"));
    // The contract carries the order, and Payments and Credits are not in it.
    const routes = readCode("lib/console-routes.ts");
    for (const target of ["settings", "products", "customers", "activity"]) {
      expect(routes, target).toContain(`  "${target}",`);
    }
    // ONE list (MESITA-1848, collapsed to one NAME in MESITA-1892). It was
    // three aliases of one array — `ORG_PAGES`, `ORG_TARGETS`,
    // `ORG_RAIL_TARGETS` — because the pages, the contract's targets and the
    // rail's rows had drifted apart once and were pinned back together by
    // assignment. With the organization gone there is one list and one name.
    expect(routes).toContain("export const PLACE_PAGES");
    expect(routes).not.toContain("ORG_TARGETS");
    expect(routes).not.toContain("ORG_RAIL_TARGETS");
    expect(routes).not.toContain("ORG_DOOR_TARGETS");
    // `places` IS NOT a place page: the catalogue lists every place there is,
    // so scoping it under one would be asking a venue to list its siblings.
    expect(routes).toContain('placesNew: "/places/new"');
    // CREDITS IS A PLACE VIEW AGAIN (MESITA-1885), after two issues as no
    // address at all: it is a PRODUCT with a rail row, so `/credits` resolves
    // and the redirect that claimed it was deleted in the same commit. It is
    // still not an ORGANIZATION target — that spelling still forwards.
    expect(routes).toContain('credits: "/credits"');
    // PAYMENTS REMAINS NO ADDRESS (MESITA-1869): a reading of money that has
    // not moved, not a product, and both its spellings forward. A name left
    // here would be a live address next.config.ts shadows — the MESITA-1839
    // trap, which stayed green for a day in production. The PRODUCT is `pay`,
    // whose flat twin is `/pay` and whose row says "Pay".
    expect(routes).not.toContain('payments: "/payments"');
    expect(routes).not.toMatch(/^\s+"payments",$/m);
    // THE ROW ORDER LIVES IN THE CONTRACT, NOT IN THE RAIL (MESITA-1879).
    // Sidebar used to declare `PLACE_ROWS` beside the render, which is two
    // lists for one column. `RAIL_ROWS` is the only one now, and this is the
    // assertion that the rail stopped keeping its own copy.
    expect(routes).toContain("export const RAIL_ROWS");
    expect(r).not.toContain("const PLACE_ROWS = [");
    // Admin is not filtered in the rail any more because it has no row at
    // all; the matrix still gates the ADDRESS (`tabsForAccess`, PlaceTabGate).
    expect(r).not.toContain('tab === "admin" ? isSuperAdmin : true');
    expect(routes).not.toMatch(/view: "admin"/);
    expect(routes).not.toMatch(/target: "places"/);
    // A ROW IS THE CANONICAL ADDRESS (MESITA-1839): the shell has already
    // resolved which place and which organization, so the row links straight
    // there and the click costs one hop. The flat address is the fallback for
    // the state with nothing to name yet.
    expect(r).toContain("placeId ? placeTabHref(placeId, tab) : FLAT_ROUTES[tab]");
    expect(r).toContain("placeId ? placePageHref(placeId, page) : FLAT_ROUTES[page]");
    expect(r).toContain("href={pageRow(row.target)}");
    // A PRODUCT ROW ASKS ONE FUNCTION (MESITA-1885). Eight products, three
    // kinds of address — a place view, a place page, a Soon sub-page — and
    // `productRowHref` is the only thing that knows which is which. A ternary
    // in the rail would be a second copy of that mapping.
    expect(r).toContain("href={productRowHref(row.product, placeId ?? \"\", viewRow)}");
    expect(routes).toContain("export function productRowHref");
    // Both readers, on both spellings, because either address may be on
    // screen while a forward is in flight.
    expect(r).toContain("placeTabFromPathname(pathname) ?? flatViewFromPathname(pathname)");
    expect(r).toContain("placePageFromPathname(pathname) ?? flatPlacePageFromPathname(pathname)");
    expect(r).toContain("role: scope.place?.myRole ?? null,");
    expect(r).not.toContain("?org=");
    expect(r).not.toContain("window.location");
    expect(readCode("lib/place-view.ts")).toContain("return tabsForAccess({");
  });

  // Two pills is the failure every rail test in this repo counts, and it
  // arrives exactly this way: one row keeping a clause after another row took
  // the subject. Account owned the organization's ceremonies until
  // MESITA-1841; Organization owns them, and now Payments and Credits too.
  it("Account lights for Account alone, and every page row takes only its own", () => {
    const r = rail();
    expect(r).toContain("const onAccount = pathname === SHELL_ROUTES.account;");
    // NO BORROWED CLAUSE AT ALL (MESITA-1892). Settings used to light for the
    // create-organization ceremony as well — the one address with no
    // organization to name — so `orgRowActive` had to special-case it. The
    // ceremony is gone, so every page row is its own name and nothing else,
    // which is the shortest form of the rule this test exists for: a row
    // keeping a clause after another row took the subject is how the rail
    // grows a second pill.
    expect(r).toContain("active={placePage === row.target}");
    expect(r).not.toContain("orgRowActive");
    expect(r).not.toContain('=== "settings" ||');
  });

  // MESITA-1847. Pato: "members and places in organization i mean, fuck
  // nested things display shit there." The page IS its people and its places.
  // MESITA-1852. Pato: "Remove places from here, its redundant." Places has a
  // rail row above this page; a box listing them again was a second door.
  // MESITA-1869. Pato: "Configuration (here have members shit) · Products
  // (here have partner and all the products to activate…)." Mesita Partner
  // and Mesita Pay were the right boxes in the wrong room — a subscription
  // and a payment account are things you BUY, not things you configure — so
  // they moved to the catalogue whole, composition intact.
  // MESITA-1870. Pato, on the live page: "remove brand configuration from
  // here." Brand was the second Soon on a page just cut to what you actually
  // configure, and the weaker of the two: Developers is something this
  // organization will DO, the brand is a design decision with no column and
  // no next step. The map entry went with the box.
  // MESITA-1871 renamed it Settings, label and segment — the flat `/settings`
  // came back from the permanent redirect that forced `configuration` in the
  // first place.
  it("Settings is two boxes: the team, then Developers", () => {
    const page = readCode("app/(shell)/places/[id]/settings/page.tsx");
    expect(page).not.toContain("DoorRow");
    // ONE MEMBERS SURFACE (MESITA-1892). `MembersCard` was the organization's
    // own, over four `business-web-*-org-member` endpoints that were twins of
    // the place endpoints `TeamSection` has always driven — so the card is
    // deleted rather than repointed, and the section moved here from the
    // internal box on Visits.
    expect(page).toContain("<SettingsBody");
    expect(readCode("app/(shell)/places/[id]/settings/SettingsBody.tsx")).toContain(
      "<TeamSection place={place} />",
    );
    expect(existsSync(path.join(SRC, "components/console/MembersCard.tsx"))).toBe(false);
    expect(readCode("components/place-manage/sections/PromosSection.tsx")).not.toContain(
      "<TeamSection",
    );
    expect(page).toContain("SOON_STRIPS.developers");
    expect(page).not.toContain("SOON_STRIPS.brand");
    expect((page.match(/<SoonStrip/g) ?? []).length).toBe(1);
    // An entry nobody renders is how a vocabulary starts describing a screen
    // that no longer exists — the note this map already carries about
    // Prepaid Credits (MESITA-1869).
    expect(readCode("components/console/SoonStrips.ts")).not.toContain(
      'title: "Brand"',
    );
    // THE TWO PAID BOXES LEFT, and so did the Stripe read that fed them: two
    // screens reading one account is how the console starts disagreeing with
    // itself (MESITA-1847's badge lesson), so the read went with the box.
    expect(page).not.toContain("<PartnerCard");
    expect(page).not.toContain("<MesitaPayCard");
    expect(page).not.toContain("<PaymentsCard");
    expect(page).not.toContain("<LockedStrip");
    expect(page).not.toContain("apiGetPaymentAccount");
    expect(page).not.toContain("ConnectReturnNotice");
    expect(page).not.toContain('title="Mesita Partner"');
    expect(page).not.toContain('title="Mesita Pay"');
    expect(page).not.toContain('title="Stripe"');
    expect(page).not.toContain('title="Partnership"');
    // PLACES LEFT EARLIER, and stays gone.
    expect(page).not.toContain("placeHref(");
    expect(page).not.toContain("placesHref");
    expect(page).not.toContain("credits");
    expect(existsSync(path.join(SRC, "app/(shell)/orgs"))).toBe(false);
    expect(page).not.toContain("OrgStateBadge");
    // The skeleton promises what the page delivers, or every load ends in a
    // shift by the height of two cards that are not coming (MESITA-1729).
    const loading = readCode("app/(shell)/places/[id]/settings/loading.tsx");
    expect((loading.match(/rounded-2xl/g) ?? []).length).toBe(2);
  });

  // MESITA-1869. Pato, with a mock: "build something kinda like this, like a
  // pretty catalog… (here have partner and all the products to activate,
  // remember that profile is free)."
  // MESITA-1872. Pato: "remove thus shit. just leave the 8 boxes and the 1
  // partnership box shit. payments log go into activity."
  it("Products is the partnership and the grid; Pay has its own address", () => {
    const page = readCode("app/(shell)/places/[id]/products/page.tsx");
    expect(page).toContain("<PartnerBanner");
    expect(page).toContain("<ProductCatalog");
    expect(page).toContain("buildProductCards");
    // The states are REAL: the place read is what every card's state comes
    // out of, and a failure renders the page's error instead of an empty
    // record — "we could not read this" and "nothing is on" are different
    // sentences (MESITA-1892 turned the COUNT into a state; the rule held).
    expect(page).toContain("apiConsoleViewer");
    expect(page).toContain("place: ConsolePlace | null = null");
    expect(page).toContain("readFailed");
    // A full Section for ONE of eight made that one louder than the other
    // seven on the page whose whole job is comparing them. It moved whole,
    // with the read that fed it.
    for (const gone of [
      "<PaymentsCard",
      "<MesitaPayCard",
      "apiGetPaymentAccount",
      "ConnectReturnNotice",
      "SOON_STRIPS",
      "#mesita-pay",
    ]) {
      expect(page, gone).not.toContain(gone);
    }
    const pay = readCode("app/(shell)/places/[id]/products/pay/page.tsx");
    for (const kept of [
      "<PaymentsCard",
      "<MesitaPayCard",
      "apiGetPaymentAccount",
      "ConnectReturnNotice",
    ]) {
      expect(pay, kept).toContain(kept);
    }
    expect(
      existsSync(path.join(SRC, "app/(shell)/places/[id]/products/pay/loading.tsx")),
    ).toBe(true);
    // A SUB-STEP, NOT A ROW OF ITS OWN: this page is Mesita Pay's SETUP — the
    // Stripe account and the switch it unlocks — and standing on it lights
    // Products, the catalogue it is a step inside.
    //
    // THE PRODUCT'S ROW POINTS AT THE VIEW (MESITA-1885), where the rung an
    // operator actually flips is. Two screens, one product: buying it, and
    // running it. The split was organization-versus-place until MESITA-1892.
    const routes = readCode("lib/console-routes.ts");
    expect(routes).toContain("export function placePayHref");
    expect(routes).not.toContain('target: "pay"');
    // PAYMENTS' OWN PAGE IS DELETED, not orphaned: a route file nobody links
    // to drifts out of sync with the one that replaced it, and a leftover
    // directory would answer the address the redirect table now owns.
    expect(existsSync(path.join(SRC, "app/(shell)/places/[id]/payments"))).toBe(false);
    const config = readFileSync(path.join(SRC, "..", "next.config.ts"), "utf8");
    expect(config).toContain('source: "/orgs/:orgId/payments"');
    expect(config).toContain('{ source: "/payments", destination: "/products", permanent: false }');
  });

  it("the bare PLACE address renders nothing, reads nothing, and catches Stripe", () => {
    // THE STRIPE CATCHER MOVED WITH THE ACCOUNT (MESITA-1892). It was the
    // bare `/orgs/<id>`; the account is `place_payment_accounts` now, so it
    // is the bare `/places/<id>`, and `next.config.ts` forwards every stored
    // `/orgs/…` return through `/`, which resolves the remembered place.
    const root = readCode("app/(shell)/places/[id]/page.tsx");
    expect(root).not.toContain("return (");
    expect(root).not.toContain("apiMyPlaces");
    expect(root).not.toContain("createServerSupabase");
    // `?connect=` is checked BEFORE the forward, or Stripe's return lands on
    // Profile, which has no notice to greet it with.
    expect(root.indexOf("sp.connect")).toBeLessThan(
      root.indexOf('placeTabHref(id, "profile")'),
    );
    expect(root).toContain("placePayHref(id)");
    // The query travels on BOTH branches: dropping it strands an owner on a
    // screen that does not know they just came back.
    expect((root.match(/withQuery\(/g) ?? []).length).toBe(2);
  });

  // The room Credits had for one issue is GONE, not orphaned: a route file
  // nobody links to is a page that drifts out of sync with the one that
  // replaced it.
  it("the ORG Credits page stays deleted; the flat name came back as a place view", async () => {
    expect(existsSync(path.join(SRC, "app/(shell)/orgs"))).toBe(false);
    const config = readFileSync(path.join(SRC, "..", "next.config.ts"), "utf8");
    expect(config).toContain('source: "/orgs/:orgId/credits"');
    // THE FLAT RULE IS DELETED (MESITA-1885). Mesita Credits is a product
    // with a rail row and a place view, so `/credits` resolves now — and a
    // config rule runs BEFORE filesystem routes, so leaving the forward would
    // have made the row's own flat address dead on arrival with every check
    // green. That is `/settings` in MESITA-1839 exactly.
    expect(config).not.toContain(
      '{ source: "/credits", destination: "/products", permanent: false }',
    );
    expect(existsSync(path.join(SRC, "app/(shell)/places/[id]/credits/page.tsx"))).toBe(
      true,
    );
  });

  // MESITA-1833: they are no longer DIMMED. Every one is a live link that
  // lands on NoPlaceYet — a real next step — so `opacity-60` and the "add a
  // place first" tooltip were painting working rows as disabled, and with an
  // empty catalogue that was every operator's first screen.
  it("the place rows are always there, at full strength, and the page answers with Add place", () => {
    const r = rail();
    expect(r).not.toContain("opacity-60");
    expect(r).not.toContain("add a place first");
    expect(r).toContain("const noPlace = scope.place === null && !foreign;");
    // NoPlaceYet moved out of the place layout (MESITA-1839): under
    // `/places/<id>` there is always an id, so "no place" cannot happen
    // there. It is the flat address that has nothing to name, and answers.
    expect(readCode("lib/flat-address.tsx")).toContain("return <NoPlaceYet />;");
    // AND IT TAKES NO ROLE (MESITA-1892). The card used to branch on
    // `canAddPlace(org.myRole)` and show an editor a dead end; claiming mints
    // the claimer's own owner row, so there is one next step for everybody.
    expect(readCode("components/console/NoPlaceYet.tsx")).not.toContain("canAddPlace");
    expect(readCode("components/console/NoPlaceYet.tsx")).toContain(
      "SHELL_ROUTES.placesNew",
    );
  });

  it("the FLAT pages resolve the remembered scope; the canonical ones read the path (MESITA-1839)", () => {
    // The selection still exists — it is what a scope-free address resolves.
    // What changed is who reads it: the flat resolvers, not the place layout.
    const sel = readCode("lib/selected-place.ts");
    expect(sel).toContain("export const getSelection = cache(");
    expect(sel).toContain("findPlace(places, rememberedPlaceId)");
    expect(sel).toContain("RAIL_PLACE_COOKIE");
    // ONE COOKIE (MESITA-1892): the organization half is gone, and with it
    // the rule that the holder wins over the remembered organization.
    expect(sel).not.toContain("RAIL_ORG_COOKIE");

    const flat = readCode("lib/flat-address.tsx");
    expect(flat).toContain("await getSelection()");
    expect(flat).toContain("redirect(withQuery(placeTabHref(placeId, tab), sp))");
    expect(flat).toContain("redirect(withQuery(placePageHref(placeId, page), sp))");
    // ONE route file serves all ten (MESITA-1842), and its vocabulary IS the
    // contract — so a flat name can never be live in the rail and dead on
    // disk, which is the drift ten hand-written directories invited.
    expect(flat).toContain("if (!(name in FLAT_ROUTES)) return null;");
    expect(readCode("app/(shell)/[flat]/page.tsx")).toContain("resolveFlat(flat, sp)");
    expect(readCode("app/(shell)/[flat]/page.tsx")).toContain("notFound()");

    // The place layout takes its id from the PATH and never asks the cookie.
    const layout = readCode("app/(shell)/places/[id]/layout.tsx");
    expect(layout).toContain("const { id } = await params;");
    expect(layout).not.toContain("getSelection");

    // THE SWITCHER'S FORWARDER IS GONE (MESITA-1892), and its absence is the
    // assertion. `/orgs/<id>/switch` existed for exactly one reason — a page
    // cannot set a cookie on the way through, and selecting an organization
    // meant writing one and clearing the other. There is one cookie and no
    // second scope to switch, so the place selector is a plain `router.push`
    // and the route handler has nothing left to do.
    expect(existsSync(path.join(SRC, "app/(shell)/orgs"))).toBe(false);
    expect(rail()).not.toContain("orgSwitchHref");
  });

  it("the selectors: a name at n=1, and the transition is the pending clock", () => {
    const sw = readCode("components/console/Sidebar.tsx");
    // The condition lives in the RENDER, not in the prop — `switchable` is
    // unconditional wherever a selector appears at all, so this file's job is
    // only to pin WHERE that is. MESITA-1818 made it a name without a
    // chevron, MESITA-1879 stopped rendering it at one place, and MESITA-1899
    // put it back: with the organization selector gone (MESITA-1892) a name
    // at n=1 is the rail's head, not a row spent restating what is known.
    expect(sw).toContain('scope.mode === "solo" || scope.mode === "multi"');
    expect(sw).not.toContain("switchable={places.length >= 2}");
    expect(sw).toContain("const pendingId = isPending ? choice : null;");
    expect(sw).not.toContain("choice.at === pathname");
    expect(sw).not.toContain("useEffect");
    expect(readCode("components/console/RailSelector.tsx")).toContain("aria-busy=");
    expect(readCode("components/console/RailSelector.tsx")).toContain(
      "motion-reduce:animate-none",
    );
  });

  // ONE FOOTER, AND ONLY THE RAIL'S OWN CONTROL IN IT (MESITA-1844). Account
  // moved to row one, so the footer is one button under one seam and the
  // rail's empty space falls ABOVE it — which reads as room to spare, where
  // space between two footer items reads as a layout that failed.
  it("the footer is Collapse alone, pinned, under the rail's one seam", () => {
    const r = rail();
    const footer = r.slice(r.indexOf("</nav>"));
    expect(footer).toContain("onToggleCollapse");
    expect(footer).not.toContain("SHELL_ROUTES.account");
    expect(footer).toContain("shrink-0");
    expect((footer.match(/border-t/g) ?? []).length).toBe(1);
    // And the nav above it carries none: one seam in the whole column.
    expect((r.slice(r.indexOf("<nav"), r.indexOf("</nav>")).match(/border-t/g) ?? []).length).toBe(0);
  });

  it("focus travels on the brand's ring, not the browser's", () => {
    expect(rail()).toContain("focus-visible:ring-sidebar-ring");
  });

  it("is DARK, and paints only with sidebar tokens (MESITA-1831)", () => {
    const css = read("app/globals.css");
    expect(css).toContain("--sidebar: var(--dock);");
    expect(css).toContain("--sidebar-foreground: var(--dock-foreground);");
    expect(css).toContain("--sidebar-muted: var(--dock-muted);");
    expect(css).toContain("--sidebar-accent: var(--dock-surface);");
    expect(css).toContain("--sidebar-border: var(--dock-border);");
    expect(css).toContain("--color-sidebar-muted: var(--sidebar-muted);");
    // On the ink, a page token is ink on ink.
    const r = rail();
    expect(r).not.toContain("text-muted-foreground");
    expect(r).not.toContain("bg-foreground");
    expect(r).not.toContain("text-background");
    expect(r).not.toContain("hover:text-foreground");
    expect(r).toContain('"bg-sidebar-foreground text-sidebar font-semibold"');
    expect(r).toContain("text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground");
    // The eyebrow that used to carry the third token went with the group
    // headers (MESITA-1844); the muted token is the rows' own resting colour.
  });

  it("the layout hands the rail the whole viewer and the ONE rail cookie, raw", () => {
    const layout = readCode("app/(shell)/layout.tsx");
    expect(layout).toContain("apiConsoleViewer(supabase)");
    expect(layout).toContain("isSuperAdmin={viewer.isSuperAdmin}");
    expect(layout).toContain("viewer.places.map");
    expect(layout).toContain("viewerError={viewerError}");
    expect(layout).toContain("plausibleId(jar.get(RAIL_PLACE_COOKIE)?.value)");
    // ONE COOKIE (MESITA-1892). A cookie nobody reads is a cookie somebody
    // will one day read by mistake.
    expect(layout).not.toContain("RAIL_ORG_COOKIE");
    // A layout cannot read the pathname, so it must not pretend to resolve.
    expect(layout).not.toContain("resolveRailScope");
    expect(layout).not.toContain("searchParams");
  });

  it("a claim or release still refreshes through the server tree", () => {
    expect(readCode("components/console/PlaceHoldButton.tsx")).toContain(
      "router.refresh()",
    );
  });

  it("the tab matrix grants the read set to every held role, and its union is the whole vocabulary", () => {
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
    // A viewer gets the READ surfaces, and the READ SET DID NOT MOVE in
    // MESITA-1885 — that is the assertion that matters there. Capabilities
    // and Rewards became five product views; splitting two write surfaces
    // into five must not hand a viewer a switch, and must not take a read
    // from them either. MENUS joined the read set in MESITA-1848 for the same
    // reason: it rendered INSIDE Profile, which every held role could open,
    // and splitting a view out must never quietly take a surface away.
    expect(tabsForAccess({ held: true, role: "viewer", isSuperAdmin: false })).toEqual([
      "profile",
      "menus",
      "reviews",
    ]);
    expect(tabsForAccess({ held: true, role: "editor", isSuperAdmin: false })).toEqual([
      "profile",
      "menus",
      "reviews",
      "visits",
      "orders",
      "reservations",
      "pay",
      "credits",
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

  // SIGNING IN RESUMES WHAT YOU OPENED, on every page that guards.
  //
  // `next` is a promise, and a page that names a DIFFERENT address quietly
  // breaks it: you click a link, sign in, and land somewhere else, with
  // nothing on screen saying why. It is invisible in review because the
  // redirect still works — Terminal shipped pointing at the catalogue above
  // it, and only a reviewer reading two adjacent lines caught it.
  //
  // THE RULE IS STRUCTURAL: the `next` expression must NAME the page it is
  // on — its own directory, or a helper whose name carries it. That is what
  // makes this a guard for the class rather than for one page.
  it("a page's sign-in `next` names the page you were on", () => {
    const SHELL = path.join(SRC, "app", "(shell)");
    const pages: string[] = [];
    const walkPages = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walkPages(p);
        else if (e.name === "page.tsx") pages.push(p);
      }
    };
    walkPages(SHELL);
    let guarded = 0;
    for (const file of pages) {
      const src = readFileSync(file, "utf8");
      const m = src.match(/\/signin\?next=[^\n]*/);
      if (!m) continue;
      guarded += 1;
      // The page's own segment: the last directory that is not a group or a
      // dynamic param.
      const seg = path
        .dirname(file)
        .slice(SHELL.length + 1)
        .split(path.sep)
        .filter((s) => !s.startsWith("(") && !s.startsWith("["))
        .pop();
      if (!seg) continue;
      // NO EXEMPTION ANY MORE (MESITA-1892). `settings` had one, because
      // `orgHref(id)` defaulted to it and so named the page by omission. The
      // place's pages take an explicit segment, so every guard spells its own.
      expect(m[0].toLowerCase(), `${seg}: ${m[0]}`).toContain(seg.toLowerCase());
    }
    // Vacuous-pass guard: a walk that finds no guarded page must fail. FOUR
    // now rather than six: the place's views read nothing and guard nothing
    // (MESITA-1875), and the four organization pages that each guarded became
    // two — Customers and Terminal render a Soon strip and no longer read the
    // holder's name, so they have nothing to sign in for.
    expect(guarded).toBeGreaterThanOrEqual(4);
  });

  it("every directory on disk is a known tab or a known page", () => {
    // TWO VOCABULARIES SINCE MESITA-1892: the place's nine views, and the
    // four pages that used to hang off the organization. A directory in
    // neither is a page nobody can reach.
    const known = [...PLACE_TABS, ...PLACE_PAGES] as readonly string[];
    const dirs = readdirSync(VIEWS, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    for (const dir of dirs) {
      expect(known, dir).toContain(dir);
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

  // MESITA-1875. The guard is unchanged and it is not on the page any more:
  // every view page used to re-read `getManagePlace` (p50 472ms in
  // production) to learn a boolean the layout had just computed, and pay it
  // again on every navigation — `cache()` dedupes inside ONE request, and a
  // client navigation between siblings re-runs the page segment alone in a
  // new one. The layout publishes the matrix; `PlaceTabGate` refuses from it.
  it("NO place view page reads anything — the gate is the layout's", () => {
    // DERIVED FROM `PLACE_TABS` (MESITA-1885), not retyped: the vocabulary
    // went from six to nine in one issue, and a hand-written list here would
    // have let the five new product views ship unchecked.
    for (const tab of PLACE_TABS) {
      const page = readCode(`app/(shell)/places/[id]/${tab}/page.tsx`);
      for (const gone of [
        "getManagePlace",
        "getPlaceView",
        "visibleTabs",
        "notFound",
        "createServerSupabase",
        "apiMyPlaces",
        "force-dynamic",
        "await",
      ]) {
        expect(page, `${tab}: ${gone}`).not.toContain(gone);
      }
    }
    // Reviews' own rule survives the move: its summary belongs to the view,
    // never back inside Profile's section stack.
    expect(readCode("components/place-manage/sections/PlaceSection.tsx")).not.toContain(
      "ReviewsSummary",
    );
  });

  it("the layout resolves the matrix ONCE and publishes it", () => {
    const layout = readCode("app/(shell)/places/[id]/layout.tsx");
    expect(layout).toContain("visibleTabs(view, manage)");
    expect(layout).toContain("<PlaceScopeProvider");
    // Both branches gate: a pool place has a matrix too (Profile alone), and
    // leaving the gate off that branch is how `/places/<pool-id>/admin`
    // renders operator internals to a restaurant.
    expect((layout.match(/<PlaceTabGate \/>/g) ?? []).length).toBe(2);
    expect((layout.match(/<PlaceScopeProvider/g) ?? []).length).toBe(2);
    // The AdminPlace does NOT ride the scope: PlaceManageShell owns it, the
    // save bar mutates it, and two providers holding one record is how a
    // screen starts disagreeing with itself.
    expect(layout).toContain("view: manage ? null : view");
  });

  // The refusal itself, in one place, from the ONE matrix.
  it("the gate reads the matrix and lets the bare place URL through", () => {
    const gate = readCode("components/console/PlaceTabGate.tsx");
    expect(gate).toContain("placeTabFromPathname(pathname)");
    expect(gate).toContain("notFound()");
    // `/places/<id>` is a live address — a 307 onto Profile — and refusing it
    // mid-forward turns a redirect into a dead end.
    expect(gate).toContain("tab !== null");
    // AND IT GATES THE PAGES (MESITA-1892). Settings, Products, Customers and
    // Activity were the organization's, refused by a membership layout of
    // their own; they are segments under the place now and `tabsForAccess`
    // has nothing to say about them. They are the HOLDER's pages — the rail
    // already hides their rows for a pool place, and Settings would otherwise
    // throw inside `usePlaceContext`, which a pool place has no provider for.
    expect(gate).toContain("placePageFromPathname(pathname) !== null");
    expect(gate).toContain("isPlaceTerminalPathname(pathname)");
    expect(gate).toContain("if (isPage && !held) notFound();");
  });

  // The pool branch reads what two layouts above it already resolved.
  it("the pool Profile fetches nothing", () => {
    const pool = readCode("app/(shell)/places/[id]/profile/PoolProfile.tsx");
    expect(pool).toContain("usePlaceScope()");
    // AND IT NEEDS NOTHING ELSE (MESITA-1892). It read the rail's
    // organizations too, because claiming meant naming which organization the
    // place would join; `claim_place(p_place_id, p_claimer)` mints the
    // caller's own owner row, so the claim has one subject.
    expect(pool).not.toContain("useRailScopeContext()");
    for (const gone of ["apiMyPlaces", "apiGetConsolePlace", "cookies(", "pickPlace"]) {
      expect(pool, gone).not.toContain(gone);
    }
  });
});

describe("a product view's first paint is a row list, not a meter (MESITA-1739)", () => {
  // MESITA-1885: Capabilities and Rewards became FIVE product views, so this
  // block walks `LADDER_ZONES` instead of naming two files. Every one needs
  // its own boundary — Next 16 keeps the OLD screen painted when a route has
  // none, and the inherited `places/[id]/loading.tsx` is Profile's photo band.
  it("every product view has a skeleton of its own, and none is Profile's band", () => {
    for (const zone of LADDER_ZONES) {
      const s = read(`app/(shell)/places/[id]/${zone}/loading.tsx`);
      expect(s, zone).not.toContain("h-[420px]");
      expect(s, zone).not.toContain("PlaceViewSkeleton");
      expect(s, zone).toContain("motion-reduce:animate-none");
      expect(s, zone).toContain("sr-only");
    }
  });

  // Each skeleton is the SHAPE of its own page. A copied one promising six
  // rows where the page draws one is the shift the boundary exists to
  // prevent — which is why Rewards needed its own when it split in
  // MESITA-1841, and why five views need five now.
  it("Visits' skeleton carries the strategy cards; the others do not", () => {
    const visits = read("app/(shell)/places/[id]/visits/loading.tsx");
    expect(visits).toContain("Loading visits");
    expect(visits).toContain("length: 3");
    for (const zone of ["orders", "reservations", "pay", "credits"] as const) {
      expect(read(`app/(shell)/places/[id]/${zone}/loading.tsx`), zone).not.toContain(
        "length: 3",
      );
    }
  });

  // ONE ENGINE, FIVE VIEWS (MESITA-1841, re-cut by MESITA-1885). The ladder's
  // rungs depend on one another, so the computation is never split — only the
  // display is. Two copies of a dependency ladder is two copies that can
  // disagree, and five would be five.
  it("the five views are ONE component, selected by zone", () => {
    const tab = readCode("components/place-manage/ProductLadderTab.tsx");
    expect(tab).toContain("<PromosSection");
    expect(tab).toContain("zone={zone}");
    // And each page is that component with its own zone — nothing else.
    for (const zone of LADDER_ZONES) {
      const page = readCode(`app/(shell)/places/[id]/${zone}/page.tsx`);
      expect(page, zone).toContain(`<ProductLadderTab zone="${zone}" />`);
    }
    // The old pair is GONE, not orphaned: a route file nobody links to drifts
    // out of sync with the one that replaced it, and a leftover directory
    // would answer the address the redirect table now owns.
    for (const gone of ["capabilities", "rewards"]) {
      expect(existsSync(path.join(SRC, `app/(shell)/places/[id]/${gone}`)), gone).toBe(
        false,
      );
    }
    // The mapping is declared once and is TOTAL over the guest rows — a row
    // in neither zone would render nowhere while every source test stayed
    // green (the orphaned-view class, MESITA-1804).
    const off = readCode("components/place-manage/sections/controls/offerings.ts");
    expect(off).toContain("export const ZONE_ROWS");
    expect(off).toContain("export function rowsForZone");
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

  it("the Stripe door goes to this place's own Mesita Pay page", () => {
    // IT POINTED ONE LEVEL UP (MESITA-1892). The Stripe account was the
    // holding organization's, so the door was that organization's page — and
    // the holder had to be PUBLISHED by the place layout before the link even
    // resolved, which is why there was a root-resolver fallback. The account
    // is `place_payment_accounts` now, so the door is the place's own
    // `products/pay` and `place.id` is the page's own subject.
    const s = readCode("components/place-manage/sections/PromosSection.tsx");
    expect(s).toContain("placePayHref(place.id)");
    expect(s).not.toContain("holderOrgId");
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
  // MESITA-1836. This test used to assert the OPPOSITE — that Account capped
  // its own column — and it was pinning a cap nobody asked for: "one column,
  // not two" (MESITA-1834) became a stack PLUS an invented max-w-xl, and
  // MESITA-1835 then tuned the invented number. Pato: "i mean, one full width
  // column, wtf is that." Account is a fragment in the layout's own column,
  // like every other page, and the constant is gone for good.
  it("Account caps nothing: one column, full width", () => {
    expect(read("app/(shell)/account/page.tsx")).not.toMatch(/max-w-/);
    expect(read("app/(shell)/account/loading.tsx")).not.toMatch(/max-w-\dxl/);
    expect(read("lib/ui-classes.ts")).not.toContain("export const ACCOUNT_COLUMN_CLASS");
    // The one column IS the ask (MESITA-1834) and stays: no grid, any width.
    expect(read("components/console/Sidebar.tsx")).not.toMatch(/grid-cols/);
  });

  // MESITA-1847. Account is the PERSON and nothing else — Pato: "account is
  // just for there." The organization selector went to the Organization page
  // and the place selector was deleted; MESITA-1892 took the organization
  // count with the layer, so what is left is one row: who you are, and the
  // way out.
  it("Account is ONE card of ONE row, and the row is the person", () => {
    const page = read("app/(shell)/account/page.tsx");
    const ui = read("lib/ui-classes.ts");
    // The shape is still a shared constant, shared now with the Organization
    // page's selector — so the two cannot drift into two ranks.
    expect(ui).toContain("export const SCOPE_CARD_CLASS");
    expect(ui).toContain("export const SCOPE_ROW_CLASS");
    expect(page).toContain("SCOPE_CARD_CLASS");
    expect(page).toContain("SCOPE_ROW_CLASS");
    // The rail's selector wears the RAIL's shape, not the page's — the shared
    // SCOPE_ROW_CLASS is Account's card and belongs to page surfaces.
    expect(read("components/console/RailSelector.tsx")).not.toContain("SCOPE_ROW_CLASS");
    expect(ui).not.toContain("SCOPE_BOX_CLASS");
    // The You row is a fact, not a switcher: no trigger, no chevron on it.
    expect(page).not.toContain("DropdownMenu");
    // ONE row means the skeleton draws one. It has been wrong four times —
    // each time the shape of a page that no longer existed, so every load
    // ended in a layout shift on swap. A skeleton is a promise.
    const skeleton = read("app/(shell)/account/loading.tsx");
    expect((skeleton.match(/h-24/g) ?? []).length).toBe(1);
    expect(skeleton).not.toContain("gap-3");
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
    expect(placeTabHref("p-1", "credits")).toBe("/places/p-1/credits");
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
    // Every view is a real page under the id that names it (MESITA-1839).
    // The `[view]` forwarder that stood here is gone.
    const shell = path.join(SRC, "app", "(shell)");
    expect(existsSync(path.join(shell, "places", "[id]", "[view]"))).toBe(false);
    for (const tab of PLACE_TABS) {
      expect(existsSync(path.join(shell, "places", "[id]", tab, "page.tsx")), tab).toBe(true);
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
    // The nine views AND the four pages (MESITA-1892) — a directory in
    // neither vocabulary is a page nobody can reach.
    expect(segments.sort()).toEqual([...PLACE_TABS, ...PLACE_PAGES].sort());
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
