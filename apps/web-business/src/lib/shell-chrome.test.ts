// The two-row header's invariants (MESITA-1558).
//
// Every rule here is a pairing between two things that must agree and that no
// compiler checks: a Tailwind literal against the constant it encodes, a
// negative margin against the padding it cancels, a component against the
// context it may not import. Each one, when broken, ships something that looks
// fine on the viewport a developer checks first.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PLACEBAR_STICKY_CLASS,
  STATES_HEAD_STICKY,
  SHELL_BLEED,
  SHELL_GUTTER,
  TOPNAV_OCCUPIED_PX,
} from "./ui-classes";
import { PLACE_TABS, placeTabHref } from "./place-tabs";

const SRC = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");

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

describe("row 2 parks exactly on row 1", () => {
  it("the sticky class encodes TOPNAV_OCCUPIED_PX", () => {
    expect(PLACEBAR_STICKY_CLASS).toContain(`sm:top-[${TOPNAV_OCCUPIED_PX}px]`);
  });
  it("row 1's real height is 56px of bar plus its 1px border", () => {
    const nav = read("components/console/TopNav.tsx");
    expect(nav).toContain("h-14"); // 56
    expect(nav).toContain("border-b"); // +1
    expect(TOPNAV_OCCUPIED_PX).toBe(57);
  });
  it("is top-0 on mobile, because row 1 is static there", () => {
    // With row 1 scrolling away, a 57px offset would strand a band of body
    // content above the tab rail.
    expect(PLACEBAR_STICKY_CLASS).toContain("top-0");
    expect(read("components/console/TopNav.tsx")).toContain("static z-30");
  });
});

// MESITA-1637. The console is driven in a chromeless desktop window, so the
// address bar is not on screen and nothing else in the product says which
// route you are on. Row 1 says it — under the constraint row 1 has always had.
describe("row 1 names the route", () => {
  const nav = () => read("components/console/TopNav.tsx");

  it("renders pathname AND query — ?org= is half the answer", () => {
    // A bare /places is ambiguous the moment an account holds two orgs, which
    // is exactly when a person needs to be told where they are.
    expect(nav()).toContain("const route = q ? `${pathname}?${q}` : pathname");
  });

  it("is an anchor, so the browser's own copy-link works on it", () => {
    // A <span> would be a readout you cannot do anything with, and doing
    // something with it is most of the point.
    expect(nav()).toMatch(/<Link\s+href=\{route\}/);
  });

  it("cannot grow the header — a place route carries a uuid", () => {
    // Row 1 is the ALWAYS header. The Place pill stays the short word "Place"
    // for this same reason; an entry that widens per route destabilises it.
    const el = nav().slice(nav().indexOf("<Link\n          href={route}"));
    const cls = el.slice(el.indexOf("className="), el.indexOf(">\n          {route}"));
    expect(cls).toContain("truncate");
    expect(cls).toMatch(/max-w-\[/);
    expect(cls).toContain("shrink-0");
  });

  it("takes the ml-auto, and the switcher no longer holds one", () => {
    // Two ml-autos in one flex row is one too many: the second is inert and
    // the layout silently depends on source order.
    expect((nav().match(/ml-auto/g) ?? []).length).toBe(1);
  });
});

// MESITA-1658. Two sticky constants, one string, two different boxes — and
// copying the first into the second hid the Places table's first row behind a
// 57px gap for weeks. These pin the distinction so it cannot be re-collapsed.
describe("sticky offsets are measured against the right box", () => {
  it("PlaceBar clears the nav, because the PAGE is its scrollport", () => {
    // Unchanged and correct: no scrolling ancestor between it and the page.
    expect(PLACEBAR_STICKY_CLASS).toContain(`sm:top-[${TOPNAV_OCCUPIED_PX}px]`);
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
    expect(STATES_HEAD_STICKY).not.toContain(String(TOPNAV_OCCUPIED_PX));
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
  it("<main> has no max-width, or the full-bleed bar cannot reach the window", () => {
    const layout = read("app/(shell)/layout.tsx");
    const main = layout.slice(layout.indexOf("<main"), layout.indexOf("</main>"));
    expect(main).not.toMatch(/max-w-/);
  });
  it("TopNav is uncapped too, so both rows share one left edge", () => {
    const nav = read("components/console/TopNav.tsx");
    expect(nav).not.toMatch(/max-w-\dxl/);
  });
  it("the bar never sets w-full — that would kill the breakout", () => {
    // align-self: stretch only widens a flex item whose width is `auto`.
    const bar = read("components/console/PlaceBar.tsx");
    const cls = bar.slice(bar.indexOf("className={`bg-background"));
    expect(cls.slice(0, cls.indexOf("`}"))).not.toContain("w-full");
  });
});

describe("PlaceTabs is dumb by construction", () => {
  it("never imports PlaceContext — it renders where no provider exists", () => {
    // usePlaceContext throws outside its provider, and a pool place has none.
    // Match an IMPORT, not any mention: the file explains this rule in prose,
    // and a test that forbids documenting its own invariant is backwards.
    expect(read("components/console/PlaceTabs.tsx")).not.toMatch(
      /^\s*import[^;]*PlaceContext/m,
    );
  });
  it("the guarded variant is the only context consumer", () => {
    expect(read("components/console/GuardedPlaceTabs.tsx")).toContain("usePlaceContext");
  });
  it("the bar lives inside the provider, structurally", () => {
    // Passed as a prop, not rendered as a sibling: position-by-convention is
    // enforced by nothing, and getting it wrong crashes every managed place.
    const shell = read("app/(shell)/places/[id]/PlaceManageShell.tsx");
    const provider = shell.slice(shell.indexOf("<PlaceProvider"));
    expect(provider).toContain("{header}");
    expect(read("app/(shell)/places/[id]/layout.tsx")).toContain("header={bar}");
  });
});

describe("tab hrefs", () => {
  it("carry the organization, so a tab click cannot move the switcher", () => {
    expect(placeTabHref("p-1", "capabilities", "org-9")).toBe(
      "/places/p-1/capabilities?org=org-9",
    );
    expect(placeTabHref("p-1", "profile", "org-9")).toBe("/places/p-1?org=org-9");
  });
  it("omit it cleanly when there is no active organization", () => {
    expect(placeTabHref("p-1", "activity")).toBe("/places/p-1/activity");
  });
  it("every tab maps to a route file on disk", () => {
    // Under a permanent header a mislabelled tab is a 404 the operator stares
    // at on every screen, not a link they might never click.
    const shell = path.join(SRC, "app", "(shell)");
    for (const tab of PLACE_TABS) {
      const segs = placeTabHref("ID", tab).slice(1).split("/");
      segs[1] = "[id]";
      expect(existsSync(path.join(shell, ...segs, "page.tsx"))).toBe(true);
    }
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
