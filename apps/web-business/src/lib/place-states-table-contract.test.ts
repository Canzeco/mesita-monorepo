// What the console states matrix must keep true. These read the SOURCE
// because the failures they guard against are silent: a wrong URL still
// renders, an unknown Tailwind class still compiles, and a class that pins a
// column on the wrong breakpoint looks fine until someone opens a laptop.
//
// Replaces place-row-contract.test.ts (MESITA-1608). Two of that file's
// guards had to go rather than move — it asserted the row rendered
// `place.organizationName` and "No organization", and that Requested used the
// literal `Requested ${requests}` template. Pato's identity rule deletes the
// org line, and Requested is now a column with a number in it. A guard removed
// with nothing in its place is how a rule quietly stops being enforced, so the
// identity rule gets an INVERSE guard below: the cell must contain neither.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const TABLE = readFileSync(
  path.join(__dirname, "../components/console/PlaceStatesTable.tsx"),
  "utf8",
);
const CELL = readFileSync(
  path.join(__dirname, "../components/console/StateCell.tsx"),
  "utf8",
);
const UI = readFileSync(path.join(__dirname, "./ui-classes.ts"), "utf8");

/** The table with its prose stripped. The file EXPLAINS which words are
 *  forbidden, so a naive search hits the explanation — vocabulary assertions
 *  have to read the code, not the commentary. */
const TABLE_CODE = TABLE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("photo contract", () => {
  // MESITA-1553: places.photos are full-resolution originals, up to 100 rows.
  // Pointing an <img> at one is the whole bug.
  it("routes the thumb through placeThumbUrl", () => {
    expect(TABLE).toContain("placeThumbUrl(place.photoUrl");
  });

  it("never puts the raw photo URL in an img src", () => {
    expect(TABLE).not.toMatch(/src=\{\s*place\.photoUrl/);
  });

  it("lazy-loads the thumb", () => {
    expect(TABLE).toContain('loading="lazy"');
  });

  // #1508's trap: web-business has ZERO @utility blocks and Tailwind drops
  // unknown classes silently — it would compile, deploy, and look broken.
  it("uses no utility that exists only in web-admin", () => {
    expect(TABLE).not.toContain("pink-gradient");
    expect(CELL).not.toContain("pink-gradient");
  });
});

describe("identity column contract", () => {
  // Pato, 2026-09-06: "Left columns of identity only contain image and name.
  // Nothing else. Everything else are states." This is the inverse guard for
  // the two facts that used to live there.
  it("holds no organization line", () => {
    expect(TABLE_CODE).not.toContain("organizationName");
    expect(TABLE_CODE).not.toContain("No organization");
  });

  it("holds no address or zone", () => {
    expect(TABLE_CODE).not.toContain("place.address");
    expect(TABLE_CODE).not.toContain("place.zone");
  });

  // The address is gone, so two branches of one chain can truncate alike. The
  // full name in `title` and a linked name are what carry that weight.
  it("keeps the full name reachable and the row checkable", () => {
    expect(TABLE).toContain("title={place.name}");
    expect(TABLE_CODE).toContain("placeHref(place.id)");
  });
});

describe("vocabulary contract", () => {
  // The table may only render facts that exist in the schema.
  it("invents no place state", () => {
    expect(TABLE_CODE).not.toMatch(/Adopted/i);
    expect(TABLE_CODE).not.toMatch(/Visits (enabled|rewards)/i);
  });

  // Labels come from the shared constant so the two apps cannot drift on
  // wording; only the ORDER is local, and it must be a named decision rather
  // than nine literals inlined in JSX where nothing can see them.
  it("takes its labels from the shared vocabulary", () => {
    expect(TABLE).toContain("GENERAL_STATE_FACTS");
    expect(TABLE).toContain("STATE_FACT_FALSE_TONE");
  });

  it("names the column order instead of inlining it", () => {
    expect(TABLE).toContain("const GENERAL_COLUMN_ORDER");
    expect(TABLE).toMatch(/satisfies readonly GeneralStateKey\[\]/);
  });

  // Do not rebuild what this app already answers. web-admin's factOn is a
  // twelve-branch if-chain whose trailing `return false` means a fact nobody
  // wired renders "no" forever.
  it("reads facts through the shared readers, not a fourth mapper", () => {
    expect(TABLE).toContain("generalHeaderFacts");
    expect(TABLE_CODE).not.toContain("factOn");
  });

  // MESITA-1687, reversing MESITA-1637's "the intake states are internal."
  // The map is back on the wire and back on this table, behind ONE toggle —
  // so the guard is now that the toggle exists, defaults closed, and the
  // eleven functions read through the same shared fold the Place screen
  // uses, not a second mapper.
  it("is a client component, so its own toggle state can exist", () => {
    expect(TABLE.startsWith('"use client"')).toBe(true);
  });

  it("gates intake behind one toggle, collapsed by default", () => {
    expect(TABLE_CODE).toContain("useState(false)");
    expect(TABLE_CODE).toContain("showIntake");
  });

  it("reads the eleven functions through the shared fold, not a second mapper", () => {
    expect(TABLE_CODE).toContain("intakeFunctionRows");
    expect(TABLE_CODE).not.toContain("enrich_pulse");
    expect(TABLE_CODE).not.toContain("intakePulse");
  });

  // The two general columns intake used to sit beside. Removing the block is
  // right; taking these with it would be the overshoot.
  it("keeps Enriching and Enriched as general columns", () => {
    expect(TABLE_CODE).toContain('"enriching"');
    expect(TABLE_CODE).toContain('"enriched"');
  });
});

describe("cell contract", () => {
  it("says the state in words, never colour alone", () => {
    expect(CELL).toContain('"yes"');
    expect(CELL).toContain('"no"');
    expect(CELL).toContain('"?"');
  });

  // web-admin has no dark theme, so its raw colour literals were never tested
  // on a dark ground. web-business ships a full .dark block.
  it("pairs every colour with a dark variant", () => {
    const colours = CELL.match(/text-(emerald|rose)-\d{3}/g) ?? [];
    expect(colours.length).toBeGreaterThan(0);
    for (const c of colours) {
      if (c.startsWith("text-emerald-7") || c.startsWith("text-rose-7")) {
        expect(CELL).toContain(`dark:${c.replace(/-\d{3}$/, "-300")}`);
      }
    }
  });

  it("gives every cell an accessible name carrying both halves", () => {
    expect(CELL).toContain("aria-label");
    expect(CELL).toContain("${label}");
  });
});

describe("layout contract", () => {
  // web-admin's twins end in `sm:static` because its catalog fits its column
  // from sm. This table does not. Porting them verbatim would pin identity on
  // phones and unpin it on every laptop.
  it("pins the identity column at EVERY width", () => {
    const head = UI.match(/STATES_COL_HEAD =\s*\n?\s*"([^"]*)"/)?.[1] ?? "";
    const cell = UI.match(/STATES_COL_CELL = "([^"]*)"/)?.[1] ?? "";
    expect(head).toContain("sticky left-0");
    expect(cell).toContain("sticky left-0");
    expect(head).not.toContain("sm:static");
    expect(cell).not.toContain("sm:static");
  });

  // 234px of identity plus 140px of actions exceeds the 358px of content
  // width on a 390pt phone, leaving negative room for the states between.
  it("pins the action column only from sm up", () => {
    const cell = UI.match(/STATES_ACTION_CELL = "([^"]*)"/)?.[1] ?? "";
    expect(cell).toContain("sm:sticky");
    expect(cell).not.toMatch(/(^|\s)sticky(\s|$)/);
  });

  // SHELL_BLEED is asserted to be the exact negative of SHELL_GUTTER by
  // shell-chrome.test.ts; admin's hardcoded -mx-5 would be off at every
  // breakpoint. SHELL_BLEED alone bleeds at every width, so the table needs
  // its own sm:mx-0 to re-seat inside the card above phones.
  it("bleeds with the shell's own constant, then re-seats at sm", () => {
    expect(TABLE).toContain("SHELL_BLEED");
    // TABLE_CODE, not TABLE: the header explains WHY -mx-5 is wrong here, so
    // a raw search hits the explanation.
    expect(TABLE_CODE).not.toContain("-mx-5");
    expect(TABLE).toContain("sm:mx-0");
  });

  it("keeps the scrollport reachable and named", () => {
    expect(TABLE).toContain("tabIndex={0}");
    expect(TABLE).toContain('role="region"');
    expect(TABLE).toContain("overscroll-x-contain");
  });

  it("gives every header a scope", () => {
    // Read each <th …> tag WHOLE: scope may sit on any line of a multi-line
    // element, and a regex anchored to the attribute order would pass a table
    // that lost one. The ported admin table has no scopes at all.
    const tags = TABLE.match(/<th\b[^>]*>/g) ?? [];
    expect(tags.length).toBeGreaterThan(0);
    const unscoped = tags.filter((t) => !/\bscope=/.test(t));
    expect(unscoped).toEqual([]);
  });

  it("keeps the header row pinned under the nav", () => {
    expect(TABLE).toContain("STATES_HEAD_STICKY");
  });
});
