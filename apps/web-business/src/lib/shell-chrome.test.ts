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
    const menus = rail.slice(rail.indexOf("<RailSelector"));
    for (const m of menus.match(/<Link\b[\s\S]*?<\/Link>/g) ?? []) {
      expect(m).toContain("guardNav?.(");
    }
  });
});

// The rail carries destinations and nothing else. The organization SELECTOR
// is the RAIL's again (MESITA-1848, "better three sections"): the Organization
// page's in 1822, Account's in 1832, the page's again in 1847, and here it
// heads the group of pages it scopes. Pato has rejected a tree twice (1714,
// 1715) and boxes once (1815); what he keeps coming back to is a selector
// beside the thing it selects.
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
  it("indents ONE level, by padding, and draws no tree line, bullet, box or well", () => {
    const r = rail();
    expect(r).toContain('const ROW_INDENT = "pl-7 lg:pl-6";');
    // Exactly one indent constant, applied in exactly one place.
    expect((r.match(/ROW_INDENT/g) ?? []).length).toBe(2);
    expect(r).toContain("indent && !collapsed && ROW_INDENT");
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
  it("heads its groups with selectors, never with an eyebrow", () => {
    const r = rail();
    expect(r).not.toContain("GroupHeader");
    expect(r).not.toContain("TINY_LABEL_CLASS");
    expect((r.match(/<RailSelector/g) ?? []).length).toBe(2);
    expect(r).toContain('label="Switch organization"');
    expect(r).toContain('label="Switch place"');
    // Account is NOT one: there is one of you, so a chevron would be a
    // control with nothing to control. Pato: "(No subitems)".
    const account = r.slice(r.indexOf("href={SHELL_ROUTES.account}"));
    expect(account.slice(0, account.indexOf("/>"))).not.toContain("Selector");
  });

  // MESITA-1848. The ceremonies live in the selectors' MENUS, never as rows:
  // a rail row is a destination, and "Create organization" is a thing you do
  // to the subject the selector names.
  it("keeps the ceremonies in the menus, and renders no row that is not a page", () => {
    const r = rail();
    expect(r).not.toContain("<Picker");
    expect(r).not.toContain("<select");
    expect(r).not.toContain('label="Add place"');
    expect(r).toContain("Create organization");
    expect(r).toContain("Add place");
    expect(r).toContain("All places");
    // One selector, in the rail. The page's copy is gone, or the two disagree.
    expect(existsSync(path.join(SRC, "components/console/OrgSwitcher.tsx"))).toBe(false);
    expect(existsSync(path.join(SRC, "components/console/ScopeSwitchers.tsx"))).toBe(false);
    expect(readCode("app/(shell)/orgs/[orgId]/settings/page.tsx")).not.toContain("Switcher");
    expect(readCode("components/console/AppShell.tsx")).toContain("<RailScopeProvider value={{ scope, organizations, isSuperAdmin }}>");
  });

  it("is Account, then two selectors each over their own pages (MESITA-1848)", () => {
    const r = rail();
    const nav = r.slice(r.indexOf("<nav"), r.indexOf("</nav>"));
    // Both runs come from a declared list, never from rows written by hand —
    // that is what keeps the rail and the route contract in step.
    expect(nav).toContain("ORG_RAIL_TARGETS.map((target)");
    expect(nav).toContain("placeRows.map((tab)");
    // ACCOUNT IS ROW ONE, inside the landmark, above everything (MESITA-1844).
    const iAccount = nav.indexOf("href={SHELL_ROUTES.account}");
    expect(iAccount).toBeGreaterThan(-1);
    expect(iAccount).toBeLessThan(nav.indexOf("ORG_RAIL_TARGETS.map"));
    expect(nav.indexOf("ORG_RAIL_TARGETS.map")).toBeLessThan(nav.indexOf("placeRows.map"));
    // The contract carries the order, and Payments and Credits are not in it.
    const routes = readCode("lib/console-routes.ts");
    for (const target of ["settings", "places", "customers", "payments", "activity"]) {
      expect(routes, target).toContain(`  "${target}",`);
    }
    // ONE list (MESITA-1848): the pages, the rail's rows and the contract's
    // targets are the same array, so an address cannot be live in one and
    // dead in another.
    expect(routes).toContain("export const ORG_TARGETS = ORG_PAGES;");
    expect(routes).toContain("export const ORG_RAIL_TARGETS = ORG_PAGES;");
    expect(routes).not.toContain("ORG_DOOR_TARGETS");
    // CREDITS IS NOT AN ADDRESS (MESITA-1845): it merged into Payments, and
    // both its spellings forward from next.config.ts. A name left in the
    // contract would be a live address the redirect table shadows — the
    // MESITA-1839 trap, which stayed green for a day in production.
    expect(routes).not.toContain('credits: "/credits"');
    expect(routes).not.toMatch(/^\s+"credits",$/m);
    // The place's five, in the drawing's order.
    expect(r).toContain('"profile",');
    expect(r).toContain('"menus",');
    expect(r).toContain('tab === "admin" ? isSuperAdmin : true');
    // A ROW IS THE CANONICAL ADDRESS (MESITA-1839): the shell has already
    // resolved which place and which organization, so the row links straight
    // there and the click costs one hop. The flat address is the fallback for
    // the state with nothing to name yet.
    expect(r).toContain("placeId ? placeTabHref(placeId, tab) : FLAT_ROUTES[tab]");
    expect(r).toContain("href={orgHref(org.id, target)}");
    // Both readers, on both scopes, because either address may be on screen.
    expect(r).toContain("placeTabFromPathname(pathname) ?? flatViewFromPathname(pathname)");
    expect(r).toContain("orgTargetFromPathname(pathname) ?? flatOrgTargetFromPathname(pathname)");
    expect(r).toContain("tabsForAccess({ held: true, role: org.myRole, isSuperAdmin })");
    expect(r).not.toContain("?org=");
    expect(r).not.toContain("window.location");
    expect(readCode("lib/place-view.ts")).toContain("return tabsForAccess({");
  });

  // Two pills is the failure every rail test in this repo counts, and it
  // arrives exactly this way: one row keeping a clause after another row took
  // the subject. Account owned the organization's ceremonies until
  // MESITA-1841; Organization owns them, and now Payments and Credits too.
  it("Account lights for Account alone, and every org row takes only its own", () => {
    const r = rail();
    expect(r).toContain("const onAccount = pathname === SHELL_ROUTES.account;");
    expect(r).toContain('target === "settings"');
    // MESITA-1847 removed the last borrowed clause: Members is CONTENT on the
    // Organization page, not an address behind it. A row keeping a clause
    // after another row took the subject is exactly how this rail grows a
    // second pill, which every rail test in this repo counts.
    const orgClause = r.slice(r.indexOf("const orgRowActive"), r.indexOf("return ("));
    for (const taken of ["places", "payments", "customers", "activity"]) {
      expect(orgClause, taken).not.toContain(`orgTarget === "${taken}"`);
    }
  });

  // MESITA-1847. Pato: "members and places in organization i mean, fuck
  // nested things display shit there." The page IS its people and its places.
  // A door is a box that refuses to show you anything.
  it("Settings shows its people and its places, and offers no door", () => {
    const page = readCode("app/(shell)/orgs/[orgId]/settings/page.tsx");
    expect(page).not.toContain("DoorRow");
    expect(page).toContain("<MembersCard");
    expect(page).toContain("apiListOrgMembers");
    expect(page).toContain("placeHref(");
    expect(page).toContain("orgPlacesNewHref(org.id)");
    // The members ADDRESS is gone with the door that reached it, and the
    // money pages have rows of their own.
    expect(page).not.toContain('orgHref(org.id, "members")');
    expect(existsSync(path.join(SRC, "app/(shell)/orgs/[orgId]/organization"))).toBe(false);
    expect(page).not.toContain('orgHref(org.id, "payments")');
    expect(page).not.toContain("credits");
    // No Stripe read: the page shows nothing about Stripe, so it asks nothing.
    expect(page).not.toContain("apiGetPaymentAccount");
    expect(page).not.toContain("OrgStateBadge");
    // The list is CAPPED — `org.places` is unbounded and this is the rail's
    // first row, so an organization with 200 places must not render 200 rows
    // on the screen the console opens to.
    expect(page).toContain("org.places.slice(0, 10)");
  });

  // The selector moved to the page about the thing it selects (MESITA-1847).
  // Pato: "organization must be selected in organization not fucking there,
  // account is just for there."
  // MESITA-1848. Both selectors are in the rail, beside the pages they scope.
  // Account is the person alone and carries no selector at all.
  it("Account is the person alone; the selectors are the rail's", () => {
    const account = readCode("app/(shell)/account/page.tsx");
    expect(account).not.toContain("Switcher");
    expect(account).not.toContain("Selector");
    expect(account).toContain("SignOutButton");
    const sel = readCode("components/console/RailSelector.tsx");
    expect(sel).toContain("aria-label={label}");
    // The selector is DARK on its trigger and page-toned in its menu — the
    // popover floats over the page, not over this column.
    expect(sel).toContain("hover:bg-sidebar-accent");
    expect(sel).toContain("text-sidebar-foreground");
  });

  // The people live where the page does now; the address forwards.
  it("the Members page is deleted, and both spellings forward", () => {
    expect(existsSync(path.join(SRC, "app/(shell)/orgs/[orgId]/members"))).toBe(false);
    const config = readFileSync(path.join(SRC, "..", "next.config.ts"), "utf8");
    expect(config).toContain('source: "/orgs/:orgId/members"');
    expect(config).toContain('{ source: "/members", destination: "/organization", permanent: false }');
  });

  // CUSTOMERS IS A LIVE ROW WITH A REAL PAGE (MESITA-1845). Pato's list says
  // "(Soon)", and a Soon badge in a rail is a dimmed row — the thing
  // MESITA-1833 forbids in his own words. The badge lives on the page.
  it("Customers opens a real page, and the rail says nothing about Soon", () => {
    const r = rail();
    expect(r).not.toContain("Soon");
    expect(r).not.toContain("disabled");
    const page = readCode("app/(shell)/orgs/[orgId]/customers/page.tsx");
    expect(page).toContain("SOON_STRIPS.customers");
    expect(page).toContain("<h1");
    // Every page has a loading boundary, or Next keeps the PREVIOUS screen
    // painted and the rail reads as broken (MESITA-1729).
    expect(
      existsSync(path.join(SRC, "app/(shell)/orgs/[orgId]/customers/loading.tsx")),
    ).toBe(true);
  });

  // MESITA-1846. The bare `/orgs/<id>` is a FORWARDER: it renders nothing,
  // reads nothing, and exists for two jobs — sending a bookmark on to the page
  // that names itself, and catching Stripe's stored `?connect=` first. A
  // forwarder that fetches is a round trip bought for nothing.
  it("the bare organization address renders nothing and reads nothing", () => {
    const root = readCode("app/(shell)/orgs/[orgId]/page.tsx");
    expect(root).not.toContain("return (");
    expect(root).not.toContain("apiListOrganizations");
    expect(root).not.toContain("createServerSupabase");
    // `?connect=` is checked BEFORE the forward, or Stripe's return lands on
    // the organization page, which has no notice to greet it with.
    expect(root.indexOf('sp.connect')).toBeLessThan(
      root.indexOf('orgHref(orgId, "settings")'),
    );
    expect(root).toContain('orgHref(orgId, "payments")');
    // The query travels on BOTH branches: dropping it strands an owner on a
    // screen that knows neither which organization nor that they came back.
    expect((root.match(/withQuery\(/g) ?? []).length).toBe(2);
  });

  // The room Credits had for one issue is GONE, not orphaned: a route file
  // nobody links to is a page that drifts out of sync with the one that
  // replaced it.
  it("the Credits page is deleted, and both spellings forward", async () => {
    expect(existsSync(path.join(SRC, "app/(shell)/orgs/[orgId]/credits"))).toBe(false);
    const config = readFileSync(path.join(SRC, "..", "next.config.ts"), "utf8");
    expect(config).toContain('source: "/orgs/:orgId/credits"');
    expect(config).toContain('{ source: "/credits", destination: "/payments", permanent: false }');
  });

  // MESITA-1833: they are no longer DIMMED. Every one is a live link that
  // lands on NoPlaceYet — a real next step — so `opacity-60` and the "add a
  // place first" tooltip were painting working rows as disabled, and with an
  // empty catalogue that was every operator's first screen.
  it("the place rows are always there, at full strength, and the page answers with Add place", () => {
    const r = rail();
    expect(r).not.toContain("opacity-60");
    expect(r).not.toContain("add a place first");
    expect(r).toContain("const noPlace = org !== null && scope.place === null && !foreign;");
    // NoPlaceYet moved out of the place layout (MESITA-1839): under
    // `/places/<id>` there is always an id, so "no place" cannot happen
    // there. It is the flat address that has nothing to name, and answers.
    expect(readCode("lib/flat-address.tsx")).toContain("return <NoPlaceYet org={org} />;");
    expect(readCode("components/console/NoPlaceYet.tsx")).toContain("canAddPlace(org.myRole)");
  });

  it("the FLAT pages resolve the remembered scope; the canonical ones read the path (MESITA-1839)", () => {
    // The selection still exists — it is what a scope-free address resolves.
    // What changed is who reads it: the flat resolvers, not the place layout.
    const sel = readCode("lib/selected-place.ts");
    expect(sel).toContain("export const getSelection = cache(");
    expect(sel).toContain("findHolder(organizations, rememberedPlaceId)");
    expect(sel).toContain("RAIL_PLACE_COOKIE");

    const flat = readCode("lib/flat-address.tsx");
    expect(flat).toContain("await getSelection()");
    expect(flat).toContain("redirect(withQuery(placeTabHref(placeId, tab), sp))");
    expect(flat).toContain("redirect(withQuery(orgHref(org.id, page), sp))");
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

    // The switcher's forwarder still SELECTS on the way through: that is its
    // whole mechanism, and why `?to=` may be a flat address. It moved off the
    // bare `/orgs/<id>` in MESITA-1842 so the page could have that address.
    const org = readCode("app/(shell)/orgs/[orgId]/switch/route.ts");
    expect(org).toContain("res.cookies.set(RAIL_ORG_COOKIE, orgId");
    expect(org).toContain('res.cookies.set(RAIL_PLACE_COOKIE, ""');
    expect(org).toContain("orgHref(orgId)");
    expect(org).toContain("url.search = search.toString();");
  });

  it("the selectors: a name at n=1, and the transition is the pending clock", () => {
    const sw = readCode("components/console/Sidebar.tsx");
    // A selector with nothing to switch is a NAME (MESITA-1818): no chevron
    // at one organization or one place, and the row still opens its menu,
    // which is where the ceremony lives.
    expect(sw).toContain("switchable={organizations.length >= 2}");
    expect(sw).toContain("switchable={org.places.length >= 2}");
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
    // A viewer gets the READ surfaces. Capabilities and Rewards both write, so
    // the matrix withholds both (MESITA-1841). MENUS joined the read set in
    // MESITA-1848 rather than the write set: it rendered INSIDE Profile, which
    // every held role could open, and splitting a view out must never quietly
    // take a surface away from a viewer.
    expect(tabsForAccess({ held: true, role: "viewer", isSuperAdmin: false })).toEqual([
      "profile",
      "menus",
      "reviews",
    ]);
    expect(tabsForAccess({ held: true, role: "editor", isSuperAdmin: false })).toEqual([
      "profile",
      "menus",
      "reviews",
      "capabilities",
      "rewards",
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

describe("Capabilities first paint is a row list, not a meter (MESITA-1739)", () => {
  it("the loading skeleton is rows, not Profile's photo band", () => {
    const s = read("app/(shell)/places/[id]/capabilities/loading.tsx");
    expect(s).not.toContain("h-[420px]");
    expect(s).not.toContain("PlaceViewSkeleton");
    expect(s).toContain("Loading capabilities");
    expect(s).toContain("length: 6");
  });

  // MESITA-1841: Rewards came out of this page and took the strategy cards
  // with it, so its skeleton is a different SHAPE — one row, then the cards.
  // A copied skeleton showing six rows would be a promise the page breaks.
  it("Rewards has a skeleton of its own, and it is not Capabilities'", () => {
    const s = read("app/(shell)/places/[id]/rewards/loading.tsx");
    expect(s).toContain("Loading rewards");
    expect(s).not.toContain("length: 6");
    expect(s).toContain("length: 3");
  });

  // ONE ENGINE, TWO VIEWS (MESITA-1841). The ladder's rungs depend on one
  // another, so the computation is never split — only the display is. Two
  // copies of a dependency ladder is two copies that can disagree.
  it("the two views are one component, selected by zone", () => {
    const cap = readCode("app/(shell)/places/[id]/capabilities/CapabilitiesTab.tsx");
    const rew = readCode("app/(shell)/places/[id]/rewards/RewardsTab.tsx");
    expect(cap).toContain('zone="capabilities"');
    expect(rew).toContain('zone="rewards"');
    for (const t of [cap, rew]) expect(t).toContain("<PromosSection");
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
  // and the place selector was deleted, so what is left is one row: who you
  // are, how many organizations you are in, and the way out.
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
    expect(placeTabHref("p-1", "capabilities")).toBe("/places/p-1/capabilities");
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
