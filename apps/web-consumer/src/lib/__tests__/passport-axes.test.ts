import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// THE PASSPORT PRINTS WHAT IS EARNED AND PUBLIC (MESITA-1619).
//
// Class is earned and public; the plan is bought and private. So the identity
// card — and the document behind it — carry the class and the Instagram
// handle, and the plan keeps its own surfaces (Me › Plan, Help, the
// place-detail matrix).
//
// Consumer web is OTP-gated and has no visual QA path, so this is a SOURCE
// contract, the shape ticket-state-drift and route-structure already use.
//
// WHY PARSED LISTS AND NOT SUBSTRINGS. `expect(SRC).not.toContain("PLAN")`
// looks like the right guard and is not: `PLAN_ORDER`, `PREMIUM_PLAN_ICON`
// and `PREMIUM_PLAN_PRICE_MXN` all contain it, and the comment stating this
// very decision says NO PLAN CELL — so the naive guard fails on the sentence
// it exists to protect, and the cheapest way to green it would be deleting
// that sentence. The precedent is business-web-list-places/payload.test.ts,
// where `!SRC.includes("functions:")` sailed straight past `intakeFunctions:`.
// Every assertion below reads a PARSED list — import specifiers, destructured
// bindings, JSX attributes, field labels — so a rename cannot slip through and
// prose about the decision cannot trip it.

const SRC = join(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

const BAR = "app/(shell)/me/PassportBar.tsx";
const SHEET = "components/consumer/me/PassportModal.tsx";
const CLIENT = "app/(shell)/me/ProfileClient.tsx";
const DATA = "lib/consumer-data.ts";

/** Named specifiers of `import { … } from "<module>"`. `[^}]*` on purpose: a
 *  lazy `[\s\S]*?` starts at the file's FIRST `import {` and runs to the
 *  module string, swallowing every statement in between. */
function importedFrom(source: string, module: string): string[] {
  const escaped = module.replace(/[/\\^$*+?.()|[\]{}]/g, "\\$&");
  const m = source.match(
    new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*["']${escaped}["']`),
  );
  if (!m) return [];
  return m[1]
    .replace(/\/\/[^\n]*/g, "")
    .split(",")
    .map((s) => s.split(/\s+as\s+/)[0].trim())
    .filter(Boolean);
}

/** Bindings of `const { … } = hook()`, renames resolved to the SOURCE key —
 *  `handle: classHandle` is a read of `handle`. */
function destructuredFrom(source: string, hook: string): string[] {
  const m = source.match(
    new RegExp(`const\\s*\\{([^}]*)\\}\\s*=\\s*${hook}\\(\\)`),
  );
  if (!m) throw new Error(`no \`const { … } = ${hook}()\` found`);
  return m[1]
    .replace(/\/\/[^\n]*/g, "")
    .split(",")
    .map((s) => s.split(":")[0].trim())
    .filter(Boolean);
}

/** The attribute text of a self-closing `<Component … />`. */
function selfClosingTag(source: string, component: string): string {
  const start = source.indexOf(`<${component}`);
  if (start === -1) throw new Error(`no <${component}> found`);
  const end = source.indexOf("/>", start);
  if (end === -1) throw new Error(`<${component}> is not self-closing`);
  return source.slice(start, end);
}

/** `<Field label="X">` only — `aria-label` and `ariaLabel` are excluded by the
 *  lookbehind, or the copy button's "Copy member number" reads as a field. */
const fieldLabels = (source: string) =>
  [...source.matchAll(/(?<![-\w])label="([^"]+)"/g)].map((m) => m[1]);

const planShaped = (names: string[]) =>
  names.filter((n) => /plan/i.test(n)).sort();

/** Source with comments stripped. A ban on a rendered string has to read the
 *  CODE: the comment explaining why a string is gone necessarily quotes it,
 *  and a guard that fires on its own rationale gets greened by deleting the
 *  rationale — which is the failure mode this whole file exists to prevent. */
const codeOnly = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("the Passport is the page HEADER, and it is the door", () => {
  const bar = read(BAR);

  it("carries BOTH doors, as real buttons", () => {
    // MESITA-1652 REVERSES MESITA-1646's "no tap target of any kind". The
    // gate asked this question directly, because Instagram is the only reach
    // door in the app and the Class ladder carries "Join with Invitation" —
    // Docs › Passport §C calls it the ONLY entrance for a 10-digit invite
    // PIN. A display-only header plus deleted cells would have stranded both
    // silently. The bar is fixed, so these are 1 tap from anywhere on the
    // page; the cells they replace had to be scrolled to.
    expect([...bar.matchAll(/<button\b/g)]).toHaveLength(2);
    for (const door of ["onOpenInstagram", "onOpenClass"]) {
      expect(bar).toContain(door);
    }
    // ...and still no plan door. NO PLAN is the older law and it survives.
    for (const prop of ["onOpenPassport", "onOpenProfile", "onOpenPlan"]) {
      expect(bar).not.toContain(prop);
    }
  });

  it("nothing here is parked", () => {
    // A dead chip in permanent chrome is worse than a dead cell: it never
    // scrolls away.
    expect(bar).not.toContain("aria-disabled");
    expect(bar).not.toMatch(/\bsoon\b/i);
  });

  it("is fixed by FLEX, not by sticky, and outside the scroller", () => {
    // Me wraps a `flex-1 overflow-y-auto px-4` scroller. A `sticky top-0`
    // inside it would inherit that gutter and fight its z-index; a shrink-0
    // sibling above it is fixed for free and spans the full width.
    expect(bar).toContain("shrink-0");
    // codeOnly, because the header comment must be free to NAME the approach
    // it rejects — DiscoverModeNav's `sticky top-0` — and a guard that fires
    // on its own rationale gets greened by deleting the rationale.
    expect(codeOnly(bar)).not.toContain("sticky");
    const client = read(CLIENT);
    const barMount = client.indexOf("<PassportBar");
    const scroller = client.indexOf("overflow-y-auto");
    expect(barMount).toBeGreaterThan(-1);
    expect(barMount).toBeLessThan(scroller);
  });

  it("spends 56px of row and no more", () => {
    // The card was 235px. Permanent chrome on a scrolling grid cannot cost a
    // third of a phone viewport, and that budget is the whole argument for
    // what is NOT in the bar.
    expect(bar).toContain("h-14");
    expect(bar).not.toContain("py-6");
  });

  it("drops the three things that did not fit, and none is lost", () => {
    // PASSPORT eyebrow: the bar IS the passport. Public/Private: the Passport
    // CELL still opens the sheet, where privacy belongs. age·sex·country:
    // Profile owns name, photo, birthday. All three stop printing twice.
    const code = codeOnly(bar);
    expect(code).not.toMatch(/>\s*Passport\s*</);
    expect(code).not.toContain('isPublic ? "Public" : "Private"');
    expect(code).not.toContain("detailLine");
    // The sheet still owns privacy, so the fact did not vanish with the card.
    expect(read(SHEET)).toContain("privacy_public");
  });

  it("prints BOTH axes — that is what the header is for", () => {
    // MESITA-1650 took these off the card because the cells 150px below said
    // the same two things. The cells are gone now, so the bar is the only
    // place either fact appears.
    expect(bar).toContain("classLabel");
    expect(bar).toContain("instagramSummary");
    const client = read(CLIENT);
    expect(client).not.toContain('title="Instagram"');
    expect(client).not.toContain('title="Class"');
  });

  it("Instagram chip first, Class second", () => {
    // Pato, MESITA-1653. Order was unpinned until now: the test above proves
    // both chips EXIST, which stays true however they are arranged, so a
    // refactor that reflowed the row would have flipped them silently. This
    // is the second ordering call on a passport pair in a day (MESITA-1648
    // was Passport before Profile), which is what makes it worth a pin.
    const handlers = [...bar.matchAll(/onClick=\{(onOpen\w+)\}/g)].map(
      (m) => m[1],
    );
    expect(handlers).toEqual(["onOpenInstagram", "onOpenClass"]);
  });

  it("imports nothing plan-shaped from consumer-data", () => {
    expect(planShaped(importedFrom(bar, "@/lib/consumer-data"))).toEqual([]);
  });

  it("does not read the plan axis off the class context", () => {
    const bound = destructuredFrom(bar, "useConsumerClass");
    expect(bound).toContain("key");
    expect(bound).not.toContain("plan");
    expect(bound).not.toContain("renewsAt");
  });

  it("states the rung in words, so the band and ring may stay aria-hidden", () => {
    // The band and ring are colour-only and aria-hidden on the stated ground
    // that something says the rung in words. That something is now the class
    // CHIP, inside this subtree — closer than since MESITA-1650 put it on a
    // cell further down the page. Losing it makes both undescribed, silently.
    expect(bar).toContain("aria-hidden");
    expect(bar).toContain("${classLabel} class");
    expect(bar).toContain("`Class: ${classLabel}`");
    expect(codeOnly(bar)).not.toContain("Earned, not bought");
  });

  it("wears no fill but the metal, and the metal is band and ring ONLY", () => {
    // Colour means class and lives on the passport (MESITA-1132) — and the
    // passport is the chrome now. Exactly two metal surfaces: the full-width
    // band and the avatar ring. The class chip deliberately carries none; a
    // third inside 62px turns a law about meaning into decoration.
    expect([...bar.matchAll(/classFillClass\(key\)/g)]).toHaveLength(2);
    expect(bar).not.toContain("INSTAGRAM_ICON_GRADIENT_CLASS");
    expect(bar).not.toContain("classBadgeClass");
  });

  it("the skeleton mirrors the DESTINATION — same row, same avatar maths", () => {
    const loading = bar.indexOf("{loading ? (");
    expect(loading).toBeGreaterThan(-1);
    // 36 core + the 2px ring and 1.5px inset on both sides is 43.
    expect(bar).toContain("h-[43px] w-[43px]");
    expect(bar).toContain("h-9 w-9");
    // Both chips have a skeleton, or the bar resolves to a wider shape.
    const skeleton = bar.slice(loading, bar.indexOf(") : ("));
    expect([...skeleton.matchAll(/rounded-full/g)].length).toBeGreaterThanOrEqual(3);
  });
});

describe("the Passport sheet is the same document as the bar", () => {
  const sheet = read(SHEET);

  it("imports nothing plan-shaped from consumer-data", () => {
    const named = importedFrom(sheet, "@/lib/consumer-data");
    expect(named).toContain("CLASSES");
    expect(planShaped(named)).toEqual([]);
  });

  it("does not read the plan axis off the class context", () => {
    const bound = destructuredFrom(sheet, "useConsumerClass");
    expect(bound).toContain("key");
    expect(bound).not.toContain("plan");
    expect(bound).not.toContain("renewsAt");
  });

  it("lists Number · Profile · Class · Instagram, in that order", () => {
    expect(fieldLabels(sheet)).toEqual([
      "Number",
      "Profile",
      "Class",
      "Instagram",
    ]);
  });

  it("carries the two doors the card gave up, and only those two", () => {
    // The bar now carries these two as chips (MESITA-1652), so the sheet is
    // the SECOND path, exactly as it was while the cells existed. Keeping it
    // matters: Instagram is the only reach door and the Class ladder holds
    // "Join with Invitation", Docs › Passport §C's only entrance for a
    // 10-digit PIN. Two paths beat one for the doors that cannot be lost.
    for (const door of ["onOpenInstagram", "onOpenClass"]) {
      expect(sheet).toContain(door);
    }
    // Profile is NOT a door here — it is a cell on Me, one tap away, and a
    // second door to a promoted surface is MESITA-1609's removed-not-demoted.
    expect(sheet).not.toContain("onOpenProfile");
    // Each hands off rather than stacking — one LocalSheet layer (z-130).
    expect(sheet).toContain("function handOff");
  });
});

describe("the plan keeps one door, and only one", () => {
  const client = read(CLIENT);

  it("the Passport bar is handed no plan door", () => {
    expect(selfClosingTag(client, "PassportBar")).not.toContain("onOpenPlan");
  });

  it("Me carries the Plan box itself", () => {
    expect(client).toContain('title="Plan"');
    expect(client).toContain("onClick={openPlan}");
    expect(client).toMatch(/<PlanModal\b/);
  });

  it("nothing carries a second door to the plan or the passport", () => {
    // Wallet's precedent (MESITA-1609): a box promoted to primary loses its
    // More row, "removed, not demoted", because a second door is redundant
    // with the one the promotion exists to shorten. That rule outlived the
    // drawer itself — More held only Gift and Share by MESITA-1635 and was
    // deleted, so the invariant is now simply ONE door each, page-wide.
    expect(client).not.toContain("MoreModal");
    expect([...client.matchAll(/onClick=\{openPlan\}/g)]).toHaveLength(1);
    // The bar carries the two AXIS doors (MESITA-1652) and no others; the
    // Passport CELL is still the only way into the document itself.
    expect(client).not.toContain("onOpenPassport");
    expect([...client.matchAll(/setPassportOpen\(true\)/g)]).toHaveLength(1);
  });
});

describe("no comment still teaches the rule the code dropped", () => {
  // Comment rot is how this bug was born: MESITA-1464 corrected the docs in
  // 2026-09 and ten comment blocks kept asserting the old law, including
  // globals.css's entire justification for --tier-premium being black.
  //
  // Only AFFIRMATIVE PRESENT-TENSE spellings are banned. A guard on the bare
  // words "plan cell" would fire on the NO PLAN CELL sentinel below and on
  // globals.css's honest account of the history — the decision record, not
  // the drift.
  it.each([BAR, SHEET, DATA, "app/globals.css"])(
    "%s does not claim a three-tile passport",
    (rel) => {
      const source = read(rel);
      expect(source).not.toMatch(/\bthree\s+(passport\s+)?tiles\b/i);
      expect(source).not.toMatch(/in (a|its own) Plan tile/i);
    },
  );

  it("the bar carries the negative-space notes that stop the next agent", () => {
    // A deleted comment leaves no trace of the decision. This is the idiom
    // consumer-data.ts already uses for the `perk` field that must not come
    // back — the only item on the rot list that stops a re-add.
    const bar = read(BAR);
    // The negative space that has to survive a refactor: no plan on the
    // passport, and the fact that the two chips are the ONLY entrance to the
    // connect flow and to the invite PIN — the note that stops the next agent
    // from making one inert, which nearly shipped that way once.
    expect(bar).toContain("NO PLAN");
    expect(bar).toContain("THE BAR IS THE DOOR");
  });
});
