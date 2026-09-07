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

const CARD = "app/(shell)/me/ProfileSummaryCard.tsx";
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

/** `<InfoBox … label="X">` values, in render order. */
const infoLabels = (source: string) =>
  [...source.matchAll(/<InfoBox\b[\s\S]*?\/>/g)]
    .map((m) => m[0].match(/label="([^"]+)"/)?.[1])
    .filter((l): l is string => Boolean(l));

const planShaped = (names: string[]) =>
  names.filter((n) => /plan/i.test(n)).sort();

/** Source with comments stripped. A ban on a rendered string has to read the
 *  CODE: the comment explaining why a string is gone necessarily quotes it,
 *  and a guard that fires on its own rationale gets greened by deleting the
 *  rationale — which is the failure mode this whole file exists to prevent. */
const codeOnly = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("the Passport card is ONE box that displays, never controls", () => {
  const card = read(CARD);

  it("is exactly one button, with nothing clickable inside it", () => {
    // THE invariant (Pato, MESITA-1636): the card displays an identity and
    // the whole thing opens the document. A second control inside would be
    // invalid HTML nested in the card's own button AND would swallow its
    // press — and it is how the sub-cells crept back last time.
    expect([...card.matchAll(/<button\b/g)]).toHaveLength(1);
    const handlers = [...card.matchAll(/onClick=\{([^}]+)\}/g)].map(
      (m) => m[1],
    );
    expect(handlers).toEqual(["onOpenPassport"]);
  });

  it("displays both axes, Instagram then Class", () => {
    expect(infoLabels(card)).toEqual(["Instagram", "Class"]);
  });

  it("imports nothing plan-shaped from consumer-data", () => {
    const named = importedFrom(card, "@/lib/consumer-data");
    expect(named).toContain("CLASSES");
    expect(planShaped(named)).toEqual([]);
  });

  it("does not read the plan axis off the class context", () => {
    const bound = destructuredFrom(card, "useConsumerClass");
    expect(bound).toContain("key");
    expect(bound).not.toContain("plan");
    expect(bound).not.toContain("renewsAt");
  });

  it("states the rung in words, so the band and ring may stay aria-hidden", () => {
    // The metal band and the avatar ring are `aria-hidden` on the stated
    // ground that something else says the rung in words. That is the CLASS
    // box. If it goes, both become screen-reader regressions in silence.
    expect(card).toContain("aria-hidden");
    expect(card).toContain("classBadgeClass(key)");
    expect(card).toContain("value={classLabel}");
    // The slogan must not be RENDERED; the comment may quote it.
    expect(codeOnly(card)).not.toContain("Earned, not bought");
  });

  it("never paints the Instagram box with the badge gradient", () => {
    // White on that gradient's #feda75 stop measures 1.36:1 — the MESITA-1142
    // fill/ink failure, missed for a year because Instagram is not a metal.
    const named = importedFrom(card, "@/lib/ui-classes");
    expect(named).toEqual(["INSTAGRAM_ICON_GRADIENT_CLASS"]);
  });

  it("the skeleton mirrors the DESTINATION — same grid, same count", () => {
    // MESITA-1158's rule as a RELATION, not a literal: the card may be
    // relaid out, but a skeleton resolving to a different shape is the bug.
    const loading = card.indexOf("if (loading)");
    const live = card.indexOf("const name =");
    expect(loading).toBeGreaterThan(-1);
    expect(live).toBeGreaterThan(loading);

    const skeleton = card.slice(loading, live);
    const rendered = card.slice(live);
    const cols = (src: string) =>
      [...src.matchAll(/grid-cols-(\d+)/g)].map((m) => Number(m[1]));
    expect(cols(skeleton)).toEqual(cols(rendered));
    expect(cols(rendered)).not.toEqual([]);

    const boxes = [...rendered.matchAll(/<InfoBox\b/g)].length;
    expect(boxes).toBeGreaterThan(0);
    const len = skeleton.match(/Array\.from\(\{\s*length:\s*(\d+)\s*\}\)/);
    expect(len, "the skeleton no longer maps a fixed-length array").not.toBeNull();
    expect(Number(len![1])).toBe(boxes);
  });
});

describe("the Passport sheet is the same document as the card", () => {
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

  it("carries the three doors the card gave up", () => {
    // The card became one button in MESITA-1636, so these rows are the only
    // way in. Two of them are the ONLY way in anywhere: Instagram is the only
    // reach door, and the Class ladder holds "Join with Invitation", which
    // Docs › Passport §C calls the only entrance for a 10-digit PIN.
    for (const door of ["onOpenProfile", "onOpenInstagram", "onOpenClass"]) {
      expect(sheet).toContain(door);
    }
    // Each hands off rather than stacking — one LocalSheet layer (z-130).
    expect(sheet).toContain("function handOff");
  });
});

describe("the plan keeps one door, and only one", () => {
  const client = read(CLIENT);

  it("the Passport card is handed no plan door", () => {
    expect(selfClosingTag(client, "ProfileSummaryCard")).not.toContain(
      "onOpenPlan",
    );
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
    expect([...client.matchAll(/onOpenPassport=/g)]).toHaveLength(1);
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
  it.each([CARD, SHEET, DATA, "app/globals.css"])(
    "%s does not claim a three-tile passport",
    (rel) => {
      const source = read(rel);
      expect(source).not.toMatch(/\bthree\s+(passport\s+)?tiles\b/i);
      expect(source).not.toMatch(/in (a|its own) Plan tile/i);
    },
  );

  it("the card carries the negative-space notes that stop the next agent", () => {
    // A deleted comment leaves no trace of the decision. This is the idiom
    // consumer-data.ts already uses for the `perk` field that must not come
    // back — the only item on the rot list that stops a re-add.
    const card = read(CARD);
    // The negative space that has to survive a refactor: no plan on the
    // passport, and no clickable child inside a card that is itself one
    // button. The second is the one a "make this tappable" change breaks.
    expect(card).toContain("NO PLAN");
    expect(card).toContain("NOTHING INSIDE IT IS CLICKABLE");
  });
});
