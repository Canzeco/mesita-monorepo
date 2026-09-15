// What a console control owes a person who is not using a mouse (MESITA-1862).
//
// Two invariants, both of which a compiler is blind to and both of which ship
// looking fine to the developer who checks with a trackpad:
//
//   1. FOCUS. Every shared control paints the brand's ring on :focus-visible,
//      and nothing here removes the user agent's outline without putting one
//      back. A bare `outline-none` is strictly worse than no rule at all — it
//      deletes the only indicator the browser gave for free.
//   2. TOUCH. Every control whose PAINT is under 44px carries a 44px hit area
//      around it. The paint is a design decision (MESITA-1861: these rows
//      already hold too many competing shapes); the target is not negotiable.
//
// The ring rule below is written as a LOOP over the module's exports, not as a
// list of six names, and that is the whole point of this file: a seventh
// button constant added next year cannot quietly skip the ring.
//
// This is deliberately NOT part of shell-chrome.test.ts, which is about the
// SHELL's pairings — the rail, the gutter, the sticky table. These are the
// control vocabulary's, and the rail is explicitly out of scope here: it is
// dark ground with `--sidebar-ring` of its own (MESITA-1831), asserted there.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as uiClasses from "./ui-classes";
import {
  CTA_BUTTON_CLASS,
  FOCUS_RING_CLASS,
  GHOST_PILL_BUTTON_CLASS,
  ICON_BUTTON_CLASS,
  ICON_TOUCH_TARGET_CLASS,
  INPUT_CLASS,
  PILL_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
  TOUCH_TARGET_CLASS,
} from "./ui-classes";

const SRC = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
/** Same helper idiom as shell-chrome.test.ts: several rules here ban a class
 *  that the subject's own prose NAMES while explaining the ban, and a raw scan
 *  reads that explanation as the mistake. */
const readCode = (rel: string) =>
  read(rel)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

const strings: [string, string][] = Object.entries(uiClasses)
  .filter(([, value]) => typeof value === "string")
  .map(([name, value]) => [name, String(value)]);

/** Every interactive primitive: the buttons, by name, plus the input. */
const interactive = strings.filter(
  ([name]) => name.endsWith("_BUTTON_CLASS") || name === "INPUT_CLASS",
);

describe("every shared control carries the brand's focus ring", () => {
  it("there are interactive constants to check at all", () => {
    // Guards the loops below against a rename turning them into no-ops.
    expect(interactive.map(([name]) => name).sort()).toEqual([
      "CTA_BUTTON_CLASS",
      "GHOST_PILL_BUTTON_CLASS",
      "ICON_BUTTON_CLASS",
      "INPUT_CLASS",
      "PILL_BUTTON_CLASS",
      "PRIMARY_BUTTON_CLASS",
    ]);
  });

  it.each(interactive)("%s rings on :focus-visible", (_name, value) => {
    expect(value).toContain("focus-visible:ring-2");
    expect(value).toContain("focus-visible:ring-ring");
  });

  it("the ring sits OFF the fill, not on it", () => {
    // Two pixels of page between a near-black pill and a 2px pink ring is what
    // makes it read as a ring rather than a border artifact.
    expect(FOCUS_RING_CLASS).toContain("focus-visible:ring-offset-2");
    expect(FOCUS_RING_CLASS).toContain("focus-visible:ring-offset-background");
  });

  it("nothing kills the UA outline without replacing it", () => {
    for (const [name, value] of strings) {
      if (!value.includes("outline-none")) continue;
      expect(
        value,
        `${name} removes the browser's outline and puts no ring back`,
      ).toContain("focus-visible:ring-");
    }
  });

  it("the ring is the page token, never the rail's", () => {
    // The rail is dark ground (MESITA-1831). Painting a page control with
    // --sidebar-ring, or the rail with --ring, is the same mistake twice.
    for (const [name, value] of interactive) {
      expect(value, `${name} borrows the rail's token`).not.toContain(
        "ring-sidebar-ring",
      );
    }
  });
});

describe("44px is a hit area, not a bigger pill", () => {
  it.each([
    ["ICON_BUTTON_CLASS", ICON_BUTTON_CLASS],
    ["GHOST_PILL_BUTTON_CLASS", GHOST_PILL_BUTTON_CLASS],
    ["PILL_BUTTON_CLASS", PILL_BUTTON_CLASS],
    ["CTA_BUTTON_CLASS", CTA_BUTTON_CLASS],
  ])("%s paints under 44px and so carries one", (_name, value) => {
    expect(value).toContain("after:h-11");
    // An absolutely positioned pseudo-element needs a positioned parent, and
    // it needs content or it does not generate a box at all. Either one
    // missing and the class string is 44px of nothing.
    expect(value).toContain("relative");
    expect(value).toContain("after:absolute");
    expect(value).toContain("after:content-['']");
  });

  it("the icon button grows on all four sides, the pills only vertically", () => {
    // The pills are already wide; growing them sideways would overlap the
    // control beside them, which turns a 44px target into a wrong button.
    expect(ICON_TOUCH_TARGET_CLASS).toContain("after:w-11");
    expect(TOUCH_TARGET_CLASS).toContain("after:inset-x-0");
    expect(TOUCH_TARGET_CLASS).not.toContain("after:w-11");
  });

  it("the two that already clear 44px are pinned against a future shrink", () => {
    expect(PRIMARY_BUTTON_CLASS).toContain("h-12");
    expect(INPUT_CLASS).toContain("h-11");
    // …and therefore need no pseudo-element.
    expect(PRIMARY_BUTTON_CLASS).not.toContain("after:h-11");
    expect(INPUT_CLASS).not.toContain("after:h-11");
  });

  it("the member and invite rows keep the expanded targets disjoint", () => {
    // The × grows 6px on each side. At gap-2 its hit area came within 2px of
    // the Change role pill and overlapped the role chip on the invite row.
    const members = readCode("components/console/MembersCard.tsx");
    expect(members).not.toContain(
      'className="flex shrink-0 items-center gap-2"',
    );
    expect(
      (members.match(/className="flex shrink-0 items-center gap-3"/g) ?? [])
        .length,
    ).toBe(2);
  });
});

describe("the browser surfaces this console used to leave at their defaults", () => {
  const css = read("app/globals.css");

  it("selection, caret and scrollbar are themed", () => {
    expect(css).toContain("::selection");
    expect(css).toContain("caret-color:");
    expect(css).toContain("scrollbar-color:");
  });

  it("all four surfaces read one token", () => {
    // Ring, caret and selection are the same colour by construction, so they
    // cannot drift and the dark block's lighter pink carries through without
    // a second declaration.
    expect(css).toContain("caret-color: var(--ring);");
    expect(css).toContain("color-mix(in oklab, var(--ring) 22%, transparent)");
  });

  it("--ring is still the brand pink in both themes", () => {
    const rings = css.match(/^\s*--ring:.*$/gm) ?? [];
    expect(rings.length).toBe(2);
    for (const line of rings) expect(line).toMatch(/var\(--brand-pink/);
  });
});

describe("the last hand-rolled control on a Settings-adjacent surface", () => {
  it("TeamSection's role select borrows the shared ring", () => {
    const team = readCode("components/place-manage/sections/TeamSection.tsx");
    expect(team).toContain("FOCUS_RING_CLASS");
    // Its own `outline-none` is gone; the shared string supplies it with a
    // ring attached.
    expect(team).not.toContain("text-xs capitalize outline-none");
  });
});
