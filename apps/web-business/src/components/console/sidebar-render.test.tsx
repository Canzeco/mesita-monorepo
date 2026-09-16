// The rail, RENDERED (MESITA-1807; one subject since MESITA-1892).
//
// Source-reading contracts cannot see two pills: two rows computing `active`
// for one pathname pass every regex and light up together on screen. This
// file renders the real Sidebar over a pathname matrix with a mocked router
// and counts `aria-current="page"` — exactly one, on every route, in every
// viewer state — and proves the rail at zero, at one, on a pool place, and in
// its three bands. It is the strongest proof this app has: no browser can get
// past the OTP wall.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { resolveRailScope, type RailPlace } from "@/lib/rail-scope";
import {
  FLAT_ROUTES,
  FLAT_ROUTE_LIST,
  PLACE_PAGES,
  RAIL_GROUP_STARTS,
  RAIL_ROWS,
  RAIL_SECTIONS,
  SHELL_ROUTES,
  placePageHref,
  placePayHref,
  productRowHref,
} from "@/lib/console-routes";
import { PLACE_TABS, placeTabHref } from "@/lib/place-tabs";
import { PRODUCT_LABEL } from "@/lib/product-keys";

/** The canonical address of a view on the fixture place the rail resolves. */
const view = (tab: (typeof PLACE_TABS)[number]) => placeTabHref("p-1", tab);
/** The same, for one of the place's four pages. */
const page = (p: (typeof PLACE_PAGES)[number]) => placePageHref("p-1", p);

const nav = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(""),
}));

import { Sidebar } from "./Sidebar";

/** The majority customer: one place, owned. */
const SOLO: RailPlace[] = [
  { id: "p-1", name: "Strana Del Valle", photoUrl: null, myRole: "owner" },
];

/** Two places — the franchise path, deferred but not deleted. */
const MANY: RailPlace[] = [
  ...SOLO,
  { id: "p-2", name: "Strana Polanco", photoUrl: null, myRole: "owner" },
];

type Over = {
  places?: RailPlace[];
  isSuperAdmin?: boolean;
  viewerError?: boolean;
  rememberedPlaceId?: string | null;
  lastPlaceId?: string | null;
};

function scopeFor(pathname: string, over: Over = {}) {
  nav.pathname = pathname;
  const places = over.places ?? SOLO;
  return {
    places,
    scope: resolveRailScope({
      places,
      pathname,
      lastPlaceId: over.lastPlaceId ?? null,
      rememberedPlaceId: over.rememberedPlaceId ?? null,
      viewerError: over.viewerError ?? false,
    }),
  };
}

function render(pathname: string, over: Over = {}): string {
  // The PLACES still shape the scope — `multi` vs `solo` is a count — but the
  // rail no longer takes the list itself (MESITA-1918).
  const { scope } = scopeFor(pathname, over);
  return renderToStaticMarkup(
    <Sidebar
      scope={scope}
      isSuperAdmin={over.isSuperAdmin ?? false}
      viewerError={over.viewerError ?? false}
      accountLabel="pato@canzeco.com"
    />,
  );
}

const pills = (html: string) => html.match(/aria-current="page"/g) ?? [];
const hrefs = (html: string) => (html.match(/href="([^"]*)"/g) ?? []).map((m) => m.slice(6, -1));
const pillText = (html: string) =>
  (html.match(/<a[^>]*aria-current="page"[^>]*>[\s\S]*?<\/a>/)?.[0] ?? "").replace(/<[^>]+>/g, "");
const navOf = (html: string) => html.slice(html.indexOf("<nav"), html.indexOf("</nav>"));
/** The footer — ACCOUNT alone since MESITA-1909, pinned so the rail's slack
 *  falls between the rows and the person rather than below a control. */
const footerOf = (html: string) => html.slice(html.indexOf("</nav>"));
/** The head — the lockup, above `<nav>` and outside it. */
const headOf = (html: string) => html.slice(0, html.indexOf("<nav"));
const rows = (html: string) => html.match(/<a [^>]*href="[^"]*"/g) ?? [];
/** Every DESTINATION label, in render order. The selector renders its
 *  subject's name in a different span, so it never appears here — a name is
 *  not a place to go (MESITA-1848). */
const labels = (html: string) =>
  (html.match(/<span class="truncate">([^<]*)<\/span>/g) ?? [])
    .map((m) => m.replace(/<[^>]+>/g, ""));

// THE ROW LIST IS NOT WRITTEN HERE. It is `RAIL_ROWS` in console-routes, and
// this file derives its expectations from it — so a row added there without a
// render is a failure, and a row rendered here without an address is too. A
// second hand-typed list is how the rail came to mean three different things
// in one document (MESITA-1879).
const ROW_LABEL: Record<string, string> = {
  settings: "Settings",
  products: "Products",
  activity: "Activity",
  menus: "Menus",
  reviews: "Reviews",
};
/** The eleven, in `RAIL_ROWS` order, then Account at the foot. A product row
 *  takes the PRODUCT vocabulary's label, not a copy of it here — the rail, the
 *  card and the page heading are one noun (MESITA-1885). */
const RAIL_LABELS = RAIL_ROWS.map((r) =>
  r.kind === "page"
    ? ROW_LABEL[r.target]
    : r.kind === "product"
      ? PRODUCT_LABEL[r.product]
      : ROW_LABEL[r.view],
);
const ALL_LABELS = [...RAIL_LABELS, "Account"];

describe("exactly one pill, on every route (MESITA-1879)", () => {
  const ROUTES: [string, string][] = [
    [SHELL_ROUTES.account, "Account"],
    [page("settings"), "Settings"],
    [page("products"), "Products"],
    [page("customers"), "Customers"],
    [page("activity"), "Activity"],
    // Mesita Pay's setup reads as its PAGE, so the Products row stays lit
    // while an operator stands in it (MESITA-1872).
    [placePayHref("p-1"), "Products"],
    [view("profile"), "Profile"],
    // THE SIX PRODUCT VIEWS (MESITA-1885, Rewards added MESITA-1900), each
    // lighting its OWN row. Three of them used to be rows on `capabilities`,
    // so before the split these three addresses were one address and could
    // not have appeared here — and `/rewards` was a REDIRECT source until
    // MESITA-1900, so it could not have appeared here either.
    [view("visits"), "Visits"],
    [view("orders"), "Orders"],
    [view("reservations"), "Reservations"],
    [view("rewards"), "Rewards"],
    [view("pay"), "Payments"],
    [view("credits"), "Credits"],
    // The flat names an operator can still type light the same row while the
    // forward is in flight.
    [FLAT_ROUTES.settings, "Settings"],
    [FLAT_ROUTES.customers, "Customers"],
    [FLAT_ROUTES.products, "Products"],
    [FLAT_ROUTES.activity, "Activity"],
    [FLAT_ROUTES.profile, "Profile"],
    [FLAT_ROUTES.visits, "Visits"],
    [FLAT_ROUTES.orders, "Orders"],
    [FLAT_ROUTES.reservations, "Reservations"],
    [FLAT_ROUTES.rewards, "Rewards"],
    [FLAT_ROUTES.pay, "Payments"],
    [FLAT_ROUTES.credits, "Credits"],
  ];
  for (const [pathname, label] of ROUTES) {
    it(`${pathname} lights ${label} and nothing else`, () => {
      const html = render(pathname, { rememberedPlaceId: "p-1" });
      expect(pills(html)).toHaveLength(1);
      expect(pillText(html)).toBe(label);
    });
  }

  // THE OTHER HALF OF THE CONTRACT (MESITA-1879). Some addresses keep their
  // page and have no row, so each must light NOTHING — and "nothing" is a
  // real answer here, not an oversight. A row lighting for an address it does
  // not own is the two-pill bug; an address lighting a row that is not its
  // own is the same bug, quieter.
  //
  // MENUS AND REVIEWS JOINED THIS LIST (MESITA-1885): the product rail has
  // room for the place once, so they fold under Profile. They keep their
  // addresses and every viewer who could open them still can — `tabsForAccess`
  // is the gate, and a row was never it.
  const ROWLESS = [
    view("menus"),
    view("reviews"),
    view("admin"),
    FLAT_ROUTES.menus,
    FLAT_ROUTES.reviews,
    FLAT_ROUTES.admin,
    // The catalogue and its ceremony are above every place (MESITA-1892), and
    // neither is a row in the solo shape — the empty state is where Add place
    // earns one.
    SHELL_ROUTES.places,
    SHELL_ROUTES.placesNew,
  ];
  for (const pathname of ROWLESS) {
    it(`${pathname} is live and lights no row`, () => {
      const html = render(pathname, { rememberedPlaceId: "p-1", isSuperAdmin: true });
      expect(pills(html)).toHaveLength(0);
    });
  }

  it("never lights two rows, on any address in the whole vocabulary", () => {
    // The union of every address the console owns — canonical and flat — is
    // walked, and the rule is the same for all of them: at most one pill.
    const every = [
      ...FLAT_ROUTE_LIST,
      ...PLACE_TABS.map(view),
      ...PLACE_PAGES.map(page),
      placePayHref("p-1"),
      SHELL_ROUTES.account,
      SHELL_ROUTES.places,
      SHELL_ROUTES.placesNew,
    ];
    for (const href of every) {
      const n = pills(render(href, { isSuperAdmin: true, rememberedPlaceId: "p-1" })).length;
      expect(n, href).toBeLessThanOrEqual(1);
    }
  });
});

describe("one flat column, and Account at the foot (MESITA-1879)", () => {
  it("renders RAIL_ROWS in order, then Account — and nothing else", () => {
    const html = render(view("profile"), { rememberedPlaceId: "p-1" });
    expect(labels(html)).toEqual(ALL_LABELS);
    // ELEVEN ROWS AND ACCOUNT (MESITA-1885). Derived from the contract, not
    // typed again: the count is the thing this file's header bans a second
    // copy of, and a hand-written 8 is what MESITA-1883 already had to fix.
    expect(rows(html)).toHaveLength(RAIL_ROWS.length + 1);
    // WHAT LOST ITS ROW. Each of these keeps its address and is reachable;
    // none is a row. Asserted by NAME, because the failure mode is a row
    // creeping back in a later pass without anyone noticing the column grew.
    //
    // MENUS AND REVIEWS JOINED THEM (MESITA-1885) — they fold under Profile —
    // and Capabilities is not even a view any more.
    //
    // REWARDS LEFT THIS LIST (MESITA-1900): Pato's product list puts it back
    // in the rail, so it is a ROW now and asserting its absence would be this
    // test pinning the previous era. TERMINAL TOOK ITS PLACE here, for the
    // opposite reason — the product is retired, and a row creeping back is
    // exactly what this list is for.
    for (const gone of ["Capabilities", "Terminal", "Places", "Admin", "Menus", "Reviews"]) {
      expect(labels(html), gone).not.toContain(gone);
    }
    // THE WORDMARK IS BACK, IN THE HEAD (MESITA-1909, reversing MESITA-1842's
    // "no mesita logo, fuck it"). It is the horizontal lockup and it is NOT a
    // row: `labels` reads `<span class="truncate">`, and the head has none, so
    // the list above is unchanged by its return.
    expect(html).toContain('<svg viewBox="0 0 293.03 100"');
    expect(labels(html)).not.toContain("Mesita");
    // And the rail still names no product line of its own beside it.
    expect(html).not.toContain(">business<");
    // CREDITS IS A ROW AGAIN, AND THE PAYMENTS PAGE IS STILL NOT ONE. Both
    // were rows, both became products (MESITA-1845, MESITA-1869), and
    // MESITA-1885 put the PRODUCTS in the rail — so Credits returns under its
    // product name, while `payments`, a reading of money and not a product,
    // does not.
    //
    // THE ROW NOW SAYS "PAYMENTS" (MESITA-1900), so the LABEL can no longer
    // stand in for the address. It never should have: the invariant was
    // always that no row points at `/payments`, and a label assertion was a
    // proxy that Pato's rename has just falsified. The href is the assertion.
    expect(labels(html)).toContain("Credits");
    expect(labels(html)).toContain("Payments");
    expect(hrefs(html).some((h) => h.includes("/payments"))).toBe(false);
    // …and the row called Payments is the PRODUCT's view, whose segment is
    // still `pay`. The label moved; the persisted spelling did not.
    expect(hrefs(html)).toContain(view("pay"));
    // NO ROW SAYS "SOON": Customers renders at full strength and its page
    // carries the badge (MESITA-1833).
    expect(html).not.toContain("Soon");
    // NO ID IS VISIBLE, though every href carries one (MESITA-1839).
    expect(labels(html).some((l) => l.includes("p-"))).toBe(false);
  });

  it("has ONE depth: the selector is gone, so nothing indents", () => {
    // The indent existed to say "these rows are under that selector". With no
    // selector there is nothing to sit under, and an indent would be a tree
    // line drawn from nowhere.
    const n = navOf(render(view("profile"), { rememberedPlaceId: "p-1" }));
    expect(n).not.toContain("pl-7");
    expect(n).not.toContain("pl-6");
    expect(n).not.toContain("pl-10");
    expect(n).not.toContain("border-l");
    expect(n).not.toContain("list-disc");
    // PATO'S BLANK LINES, as seams (MESITA-1885): one over each group the
    // rail opens, and NO LONGER one over Account — that seam went to the
    // footer with the row (MESITA-1909), and is counted there below. Derived
    // from `RAIL_GROUP_STARTS` so a group added to the contract without a
    // hairline fails here.
    //
    // THEY CARRY NO NAMES. MESITA-1842 headed the rail's groups and
    // MESITA-1844 deleted the headers two issues later; a blank line is not a
    // heading, so a seam is a rule and nothing else.
    expect((n.match(/border-t/g) ?? []).length).toBe(RAIL_GROUP_STARTS.length);
    expect((footerOf(render(view("profile"), { rememberedPlaceId: "p-1" })).match(/border-t/g) ?? []).length).toBe(1);
    // The seam is a wrapper's border, never a row's: a row that grew a rule
    // would be a second row shape.
    expect(n).not.toMatch(/<a [^>]*class="[^"]*border-t/);
  });

  it("each row wears the mark of its subject", () => {
    const html = render(view("profile"), { rememberedPlaceId: "p-1" });
    for (const mark of [
      "lucide-settings", // Settings — the gear (MESITA-1871)
      "lucide-chart-no-axes-column", // Activity — counts over time
      "lucide-layout-grid", // Products — the catalogue IS a grid of tiles
      // The eight products, wearing the CATALOGUE's marks (MESITA-1885): the
      // same glyph each card carries, because a row and a card naming one
      // product with two pictures teaches an operator to distrust both.
      "lucide-store", // Profile — the place's public page
      "lucide-users", // Customers — people, plural, against Account's one
      "lucide-ticket", // Visits — the guest's check at the bill
      "lucide-shopping-bag", // Orders — pickup and delivery
      "lucide-calendar-check", // Reservations — a table, booked
      "lucide-gift", // Rewards — what a guest earns, given back
      "lucide-credit-card", // Payments — the card
      "lucide-wallet", // Credits — money held before it is spent
      "lucide-user-round", // Account — the person, one of them
      // THE TWO SECTION HEADS (MESITA-1915). Not rows, and their marks say so.
      // Manage wears a BRIEFCASE — the business itself. Every nearer mark is
      // banned below as a second gear or a second venue, which is the whole
      // reason this one is a briefcase and not a tool. Products' head wears
      // the catalogue's own `layout-grid`, the SAME mark as its row: the row
      // is the door to the eight and the section IS the eight, and one idea
      // drawn two ways is what this table exists to prevent.
      "lucide-briefcase",
    ]) {
      expect(html, mark).toContain(mark);
    }
    // The marks that left WITH their rows. Each still exists in the app on
    // the page it belongs to; none belongs in this column any more.
    for (const gone of [
      "lucide-layers", // Places — the catalogue, reached from the empty state
      "lucide-sliders-horizontal", // Capabilities, retired as a view
      "lucide-nfc", // Terminal, retired as a product (MESITA-1900)
      "lucide-shield", // Admin
      "lucide-utensils-crossed", // Menus, folded under Profile
      "lucide-star", // Reviews, folded under Profile
    ]) {
      expect(html, gone).not.toContain(gone);
    }
    // And the marks that never belonged.
    expect(html).not.toContain("lucide-coins");
    expect(html).not.toContain("lucide-building2");
    expect(html).not.toContain("lucide-cog");
    expect(html).not.toContain("lucide-settings-2");
    // The gear is on ONE row: a second would be two screens claiming to be
    // where you configure things.
    expect(html.match(/lucide-settings\b/g) ?? []).toHaveLength(1);
  });

  it("the rows are the CANONICAL addresses — one hop, and shareable", () => {
    const html = render(view("profile"), { rememberedPlaceId: "p-1" });
    // DERIVED, not retyped (MESITA-1883). This was a second hand-written
    // order, which is the thing this file's own header bans — and it is why
    // moving one row in `RAIL_ROWS` failed here instead of passing, in a test
    // whose subject is addresses rather than order.
    //
    // A PRODUCT ROW'S ADDRESS COMES FROM `productRowHref`, the one function
    // that knows the two shapes (MESITA-1885; the third died with Terminal in
    // MESITA-1900) — derived here too, so the rail and the contract cannot
    // disagree about where Customers lives.
    expect(hrefs(html)).toEqual([
      ...RAIL_ROWS.map((r) =>
        r.kind === "page"
          ? placePageHref("p-1", r.target)
          : r.kind === "product"
            ? productRowHref(r.product, "p-1", view)
            : view(r.view),
      ),
      SHELL_ROUTES.account,
    ]);
  });

  it("no two rows share an address — the reason the rooms had to split", () => {
    // THE WHOLE POINT OF MESITA-1885, as one assertion. Orders, Reservations
    // and Credits were three rows on `capabilities` before the split: this
    // list would have held that address three times, and three rows would
    // have lit together on every one of them.
    const html = render(view("profile"), { rememberedPlaceId: "p-1" });
    const addresses = hrefs(html);
    expect(addresses).toHaveLength(new Set(addresses).size);
  });

  it("the Account row says the page; the email is its tooltip", () => {
    const html = render(view("profile"), { rememberedPlaceId: "p-1" });
    expect(html).toContain(">Account<");
    expect(html).toContain('title="Account · pato@canzeco.com"');
    expect(html).not.toContain(">pato@canzeco.com<");
  });

  it("a VIEWER loses the five rows they could never open, and no others", () => {
    // THE ROWS FOLLOW THE MATRIX, and MESITA-1885 is when that started to
    // show. Capabilities and Rewards always withheld themselves from a
    // viewer, and neither was a row — so a viewer's column used to be
    // identical to an owner's. The five product views inherited that gate
    // exactly and ARE rows, so now the column shrinks with it.
    //
    // That is the honest answer, not a regression: a row a viewer cannot open
    // would 404 them through `PlaceTabGate`, and a rail row landing on a 404
    // is MESITA-1833's law failing. The gate did not move — `tabsForAccess`
    // is still the one matrix, still enforced server-side on a typed URL —
    // and the ROLE it reads is the caller's own `place_members` row now
    // (MESITA-1892), not a rank in the organization above the place.
    const viewer: RailPlace[] = [{ ...SOLO[0], myRole: "viewer" }];
    const html = render(FLAT_ROUTES.profile, { places: viewer, rememberedPlaceId: "p-1" });
    const seen = labels(html);

    // The six that write are gone…
    for (const gone of ["Visits", "Orders", "Reservations", "Rewards", "Payments", "Credits"]) {
      expect(seen, gone).not.toContain(gone);
    }
    // …and EVERYTHING ELSE stayed. The bijection, because "a viewer sees
    // fewer rows" passes for a rail that lost all of them.
    expect(seen).toEqual(
      ALL_LABELS.filter(
        (l) =>
          !["Visits", "Orders", "Reservations", "Rewards", "Payments", "Credits"].includes(l),
      ),
    );
    // A viewer still reaches every READ surface, including the one product
    // that is not a place view at all.
    for (const kept of ["Settings", "Activity", "Products", "Profile", "Customers"]) {
      expect(seen, kept).toContain(kept);
    }
  });
});

describe("the four shapes the console can be in (MESITA-1879)", () => {
  it("unknown — the read FAILED: a muted line, never the add row", () => {
    // MESITA-1793's law. And it must not read as the ZERO state either: an
    // empty array is a successful read of nothing, which gets a different
    // screen entirely.
    const html = render(SHELL_ROUTES.account, { places: [], viewerError: true });
    expect(html).toContain("Couldn&#x27;t load your places");
    expect(html).not.toContain("Add your place");
    // One link in the landmark: Account. The muted line is a div, not a row.
    expect(rows(html)).toHaveLength(1);
    expect(pillText(html)).toBe("Account");
  });

  it("zero PLACES: the ceremony and Account, and no row about a place", () => {
    // `ZERO_PLACE_ROWS` is a FILTER over `RAIL_ROWS`, never a second array —
    // and with the organization gone it keeps nothing, because every row in
    // this column names a place: a page OF one, a view OF one, or a product
    // configured ON one. A row with no subject opens a page about nothing,
    // which is the "a row lands somewhere real" law failing quietly
    // (MESITA-1833).
    //
    // So the ceremony takes the only row, which it does in no other state. A
    // rail with no door to the one thing a new operator came to do is a worse
    // empty state than a muted row ever was — and production holds zero
    // places, so this is every fresh environment.
    const html = render(SHELL_ROUTES.account, { places: [] });
    expect(labels(html)).toEqual(["Add your place", "Account"]);
    expect(hrefs(html)).toEqual([SHELL_ROUTES.placesNew, SHELL_ROUTES.account]);
    // No row about a place, by name: the failure mode is one creeping back.
    for (const gone of [
      "Settings",
      "Activity",
      "Products",
      "Customers",
      "Profile",
      "Menus",
      "Reviews",
      "Visits",
      "Orders",
      "Reservations",
      "Rewards",
      "Payments",
      "Credits",
    ]) {
      expect(labels(html), gone).not.toContain(gone);
    }
    expect(html).not.toContain("opacity-60");
  });

  it("zero places, and NOT an owner anywhere: the ceremony still renders", () => {
    // ADD PLACE HAS NO ROLE GATE ANY MORE (MESITA-1892). It was
    // `canAddPlace` — owner of the ORGANIZATION — so an editor with no place
    // met a rail holding Account alone. `claim_place(p_place_id, p_claimer)`
    // mints the claimer's own owner row, so there is no rank to hold first
    // and the one door a new operator has is always there.
    const html = render(SHELL_ROUTES.placesNew, { places: [] });
    expect(labels(html)).toEqual(["Add your place", "Account"]);
    expect(pills(html)).toHaveLength(1);
    expect(pillText(html)).toBe("Add your place");
  });

  it("solo — the customer this console is for: every row, nothing muted", () => {
    // `visits`, not `reviews`: Reviews folded under Profile (MESITA-1885) and
    // lights no row, and this test's subject is the row that DOES light.
    const html = render(FLAT_ROUTES.visits, { places: SOLO });
    expect(labels(html)).toEqual(ALL_LABELS);
    expect(html).not.toContain("opacity-60");
    expect(pillText(html)).toBe("Visits");
    // NO SELECTOR, AND NO VENUE NAMED AT ALL (MESITA-1918). Pato: *"now
    // remove the place selector from the top"*. MESITA-1899 had put it here on
    // the reasoning that the rail "opened cold on Settings, naming nothing it
    // was about" — that hole was filled since, by the lockup (MESITA-1909) and
    // the two section titles (MESITA-1915). The VENUE is named on the page, by
    // `PlaceHeading`; the rail carries destinations.
    expect(html).not.toContain('aria-label="Switch place"');
    expect(html).not.toContain('aria-label="Switch organization"');
    expect(html).not.toContain(">Strana Del Valle<");
    expect(html).not.toContain(">Pick a place<");
    // AND NO CATALOGUE DOOR AT SOLO: one place is nothing to switch between,
    // so the row would open a list of the venue you are already in.
    expect(labels(html)).not.toContain("All places");
  });

  it("multi — two places: a catalogue ROW, and nothing is picked for you", () => {
    // The franchise path is DEFERRED, not deleted — but it is a DOOR now, not
    // a selector (MESITA-1918). The menu's footer was this console's only link
    // to `/places`, and Account names the person and nothing else by its own
    // law, so deleting the selector without this row would strand a two-place
    // operator on whichever venue the address happened to name.
    const html = render(SHELL_ROUTES.account, { places: MANY });
    expect(html).not.toContain('aria-label="Switch place"');
    expect(html).not.toContain(">Pick a place<");
    expect(labels(html)).toContain("All places");
    expect(hrefs(html)).toContain(SHELL_ROUTES.places);
    // The rows still render; none of them lights, because no address names a
    // place and the rail refuses to choose one.
    expect(labels(html)).toEqual(["All places", ...ALL_LABELS]);
    expect(pillText(html)).toBe("Account");
    // With no place named, every row falls back to its FLAT twin, which
    // resolves at request time rather than pointing at a place the rail
    // refused to pick.
    expect(hrefs(html)).toContain(FLAT_ROUTES.settings);
    expect(hrefs(html)).toContain(FLAT_ROUTES.profile);
  });

  it("multi — but the ADDRESS names one: that place's rows light normally", () => {
    // `visits`, not `menus`: Menus folded under Profile in MESITA-1885 and
    // has no row to light. A product view is the right subject here anyway —
    // it is what most of this rail now is.
    const html = render(view("visits"), { places: MANY });
    expect(html).not.toContain('aria-label="Switch place"');
    // The rail names no venue in any shape now; the page's h1 does.
    expect(html).not.toContain(">Strana Del Valle<");
    expect(pills(html)).toHaveLength(1);
    expect(pillText(html)).toBe("Visits");
  });

  it("a pool place published by the layout: Profile alone among the place rows", () => {
    // A place the caller holds no membership on offers Profile and nothing
    // else (`tabsForAccess`), and its PAGES go with the rest: Settings,
    // Products, Customers and Activity are about a venue that is not theirs.
    const html = render(FLAT_ROUTES.profile, { lastPlaceId: "p-x" });
    expect(labels(html)).toEqual(["Profile", "Account"]);
    expect(pills(html)).toHaveLength(1);
    expect(pillText(html)).toBe("Profile");
  });

  // THREE BANDS (MESITA-1909): head, scroller, foot. Each answers a different
  // question, so this pins that none of them leaks into another — the lockup
  // is not a row of `nav`, and Account is not its last row.
  // THE EIGHT PRODUCTS ARE ONE SECTION (MESITA-1915), and this is the
  // assertion that says so. The seam COUNT elsewhere in this file derives from
  // `RAIL_GROUP_STARTS`, so it would follow the contract wherever it went and
  // catch nothing; the number itself is what Pato asked for — *"products whole
  // products is ONE sections"* — so the number is pinned here.
  it("one line inside the column, and the eight products sit whole under it", () => {
    expect(RAIL_GROUP_STARTS).toHaveLength(1);
    // And it falls exactly where the pages end and the products begin.
    expect(RAIL_ROWS[RAIL_GROUP_STARTS[0] - 1].kind).toBe("page");
    expect(RAIL_ROWS[RAIL_GROUP_STARTS[0]].kind).toBe("product");
    // No product row opens a group of its own any more: the three sub-groups
    // Pato cut (free / at-the-table / money) were three lists in one section.
    expect(RAIL_ROWS.filter((r) => r.kind === "product")).toHaveLength(8);
  });

  it("two section heads, in column order, and neither is a row", () => {
    const n = navOf(render(view("profile"), { rememberedPlaceId: "p-1" }));
    const heads = (n.match(/<p class="[^"]*uppercase[^"]*">.*?<\/p>/g) ?? []).map((h) =>
      h.replace(/<[^>]+>/g, "").trim(),
    );
    expect(heads).toEqual(RAIL_SECTIONS.map((x) => x.label));
    // A HEAD IS NOT A ROW: it is a <p>, never an <a>, so it carries no address
    // and cannot take the pill. `labels` reads the ROW span, so no head's text
    // may appear there — and neither head's text is a row label, which is also
    // why the second section is "Your products" and not "Products": that word
    // is taken, by the catalogue row one line above the head.
    for (const { label } of RAIL_SECTIONS) {
      expect(labels(n), label).not.toContain(label);
    }
    expect(n).not.toMatch(/<a [^>]*>\s*<svg[^>]*lucide-briefcase/);
  });

  it("the head is the lockup, outside the nav, and links nowhere", () => {
    const head = headOf(render(FLAT_ROUTES.visits, { places: SOLO }));
    expect(head).toContain('aria-label="Mesita"');
    // A LABEL, NOT A LINK. An anchor here would be a destination the guard
    // cannot cover, because it is not a NavRow.
    expect(head).not.toContain("<a ");
    // And the nav below carries no second copy of it.
    expect(navOf(render(FLAT_ROUTES.visits, { places: SOLO }))).not.toContain(
      'aria-label="Mesita"',
    );
  });

  it("the foot is Account alone, pinned, under the column's last seam", () => {
    const html = render(FLAT_ROUTES.visits, { places: SOLO });
    const foot = footerOf(html);
    expect(foot).toContain(SHELL_ROUTES.account);
    expect(foot).toContain('title="Account · pato@canzeco.com"');
    expect((foot.match(/<a /g) ?? []).length).toBe(1);
    expect((foot.match(/border-t/g) ?? []).length).toBe(1);
    // ACCOUNT LEFT THE SCROLLER, so the nav keeps only Pato's group seams —
    // one fewer than when Account trailed the rows inside it.
    expect((navOf(html).match(/border-t/g) ?? []).length).toBe(RAIL_GROUP_STARTS.length);
    // Still every row, still one pill: moving the row changed where it sits,
    // not what the column reaches.
    expect(rows(html)).toHaveLength(RAIL_ROWS.length + 1);
    expect(pills(html)).toHaveLength(1);
  });

  // NOTHING IS A TOOLTIP OF ITSELF (MESITA-1909). Every label is on screen at
  // the one width this rail has, so the only `title` left is the one that says
  // something the row does not: Account's email.
  it("no row repeats its own label in a tooltip", () => {
    const html = render(FLAT_ROUTES.visits, { places: SOLO });
    expect(html).not.toContain('title="Visits"');
    expect(html).not.toContain('title="Settings"');
    expect(html).toContain('title="Account · pato@canzeco.com"');
    expect(html).not.toContain("sr-only");
  });
});
