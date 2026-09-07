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
// very decision says NO PLAN TILE — so the naive guard fails on the sentence
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

const planShaped = (names: string[]) =>
  names.filter((n) => /plan/i.test(n)).sort();

/** Source with comments stripped. A ban on a rendered string has to read the
 *  CODE: the comment explaining why a string is gone necessarily quotes it,
 *  and a guard that fires on its own rationale gets greened by deleting the
 *  rationale — which is the failure mode this whole file exists to prevent. */
const codeOnly = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("the Passport card carries the class and Instagram, never the plan", () => {
  const card = read(CARD);

  it("imports nothing plan-shaped from consumer-data", () => {
    const named = importedFrom(card, "@/lib/consumer-data");
    // Guards the parser itself: an extraction bug returning [] would make the
    // assertion below vacuously green (ticket-state-drift's precedent).
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
    // The metal band and the avatar ring are both `aria-hidden` on the stated
    // ground that something else says the rung in words. That used to be the
    // Class tile; it is the chip now. If the chip goes without a replacement,
    // two aria-hidden elements become screen-reader regressions in silence.
    expect(card).toContain("aria-hidden");
    expect(card).toContain("classBadgeClass(key)");
    expect(card).toContain("{classLabel}");
    expect(card).toContain("onClick={onOpenClass}");
    // The label announces the account's STATE, never the slogan: "Earned, not
    // bought" is identical on every account at every rung, forever.
    expect(card).toMatch(/aria-label=\{`Class: \$\{classLabel\}/);
    expect(card).toMatch(/cls\?\.reward/);
    // The slogan must not be RENDERED. The comment above the chip quotes it
    // to say why it is gone, which is why this reads code, not the file.
    expect(codeOnly(card)).not.toContain("Earned, not bought");
  });

  it("the skeleton mirrors the DESTINATION by sharing its shell", () => {
    // MESITA-1158's rule, pinned as a SHARED CONSTANT rather than as two
    // matching literals. The way it broke before was a hand-tuned `h-[92px]`
    // measured against a layout that had since moved — two numbers guessed
    // independently, drifting apart in silence.
    const loading = card.indexOf("if (loading)");
    const live = card.indexOf("const name =");
    expect(loading).toBeGreaterThan(-1);
    expect(live).toBeGreaterThan(loading);

    const skeletonBranch = card.slice(loading, live);
    const liveBranch = card.slice(live);
    expect(skeletonBranch).toContain("PASSPORT_ROW_CLASS");
    expect(liveBranch).toContain("PASSPORT_ROW_CLASS");
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

  it("lists Number · Class · Instagram, in that order", () => {
    expect(fieldLabels(sheet)).toEqual(["Number", "Class", "Instagram"]);
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

  it("More does NOT carry a second door to it", () => {
    // Wallet's precedent (MESITA-1609): a box promoted to primary loses its
    // More row, "removed, not demoted", because a second door is redundant
    // with the one the promotion exists to shorten.
    expect(selfClosingTag(client, "MoreModal")).not.toContain("onOpenPlan");
    expect(read("components/consumer/me/MoreModal.tsx")).not.toContain(
      "onOpenPlan",
    );
  });
});

describe("no comment still teaches the rule the code dropped", () => {
  // Comment rot is how this bug was born: MESITA-1464 corrected the docs in
  // 2026-09 and ten comment blocks kept asserting the old law, including
  // globals.css's entire justification for --tier-premium being black.
  //
  // Only AFFIRMATIVE PRESENT-TENSE spellings are banned. A guard on the bare
  // words "plan tile" would fire on the NO PLAN TILE sentinel below and on
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

  it("the card carries the negative-space note that stops the next agent", () => {
    // A deleted comment leaves no trace of the decision. This is the idiom
    // consumer-data.ts already uses for the `perk` field that must not come
    // back — the only item on the rot list that stops a re-add.
    expect(read(CARD)).toContain("NO PLAN TILE");
  });
});
