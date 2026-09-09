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
} from "./ui-classes";
import { PLACE_TABS, placeTabHref } from "./place-tabs";

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

describe("PlaceBar has no offset left to get wrong (MESITA-1710)", () => {
  it("is a flat top-0 at every width, with no breakpoint", () => {
    // This used to be `sticky top-0 sm:top-[57px]`, paired with a
    // TOPNAV_OCCUPIED_PX constant that encoded the height of the bar above it.
    // The nav is a lateral rail now and AppShell makes `main` the only
    // scroller, so PlaceBar's scrollport has nothing above it. The constant
    // did not get a new value — it stopped having a job.
    expect(PLACEBAR_STICKY_CLASS).toBe("sticky top-0");
    expect(PLACEBAR_STICKY_CLASS).not.toMatch(/sm:|md:|lg:/);
    expect(PLACEBAR_STICKY_CLASS).not.toMatch(/top-\[/);
  });

  it("the constant is GONE from ui-classes, not merely unused", () => {
    // An exported 57 nobody reads is an invitation to wire it back up.
    const src = read("lib/ui-classes.ts");
    expect(src).not.toMatch(/^export const TOPNAV_OCCUPIED_PX/m);
  });

  it("no source file still writes a 57px offset", () => {
    // The literal has to be spelled out for Tailwind to see it, so a stale
    // copy would compile silently and only show up as a 57px band of dead
    // space under a bar that no longer exists.
    for (const f of [
      "components/console/PlaceBar.tsx",
      "components/console/AppShell.tsx",
      "app/(shell)/layout.tsx",
    ]) {
      expect(read(f)).not.toMatch(/(sm|md|lg):top-\[57px\]/);
    }
  });

  it("one breakpoint, lg — the rail and the chrome switch together", () => {
    // The old pairing switched PlaceBar at `sm` and the rail at `lg`, so
    // 640-1024px got a mobile topbar AND a desktop offset. Anything that
    // hides or shows chrome now does it at `lg`.
    const shell = read("components/console/AppShell.tsx");
    expect(shell).toContain("lg:hidden");
    expect(shell).toContain("lg:flex");
    expect(shell).not.toMatch(/\bsm:hidden\b/);
  });
});

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
  it("PlaceBar sticks to `main`, which is the shell's only scroller", () => {
    // Its scrollport is <main>, and the console header is main's SIBLING, so
    // there is nothing above it to clear (MESITA-1710).
    expect(PLACEBAR_STICKY_CLASS).toBe("sticky top-0");
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
