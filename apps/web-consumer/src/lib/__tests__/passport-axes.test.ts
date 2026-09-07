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

/** Whole `<DoorCell … />` elements, in render order. Anchored on the closing
 *  indent, not a bare `/>`, because the nested `icon={<Foo />}` closes first
 *  and a lazy match stops there — the same trap `full` fell into once. */
const doorCells = (source: string) =>
  [...source.matchAll(/<DoorCell\b[\s\S]*?\n {10}\/>/g)].map((m) => m[0]);

const doorLabels = (source: string) =>
  doorCells(source)
    .map((c) => c.match(/label="([^"]+)"/)?.[1])
    .filter((l): l is string => Boolean(l));

const planShaped = (names: string[]) =>
  names.filter((n) => /plan/i.test(n)).sort();

/** Source with comments stripped. A ban on a rendered string has to read the
 *  CODE: the comment explaining why a string is gone necessarily quotes it,
 *  and a guard that fires on its own rationale gets greened by deleting the
 *  rationale — which is the failure mode this whole file exists to prevent. */
const codeOnly = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("the Passport card is a document with four doors", () => {
  const card = read(CARD);

  it("the identity block and the doors are SIBLINGS, never nested", () => {
    // THE invariant (Pato, MESITA-1640). MESITA-1636 solved nesting by
    // allowing the card exactly one button; the doors are back, so the rule
    // has to be stated structurally instead. A <button> inside a <button> is
    // invalid HTML and the browser swallows the inner press — the cell just
    // stops working, with no error anywhere to find it by.
    const identity = card.indexOf("onClick={onOpenPassport}");
    expect(identity).toBeGreaterThan(-1);
    const closes = card.indexOf("</button>", identity);
    expect(card.slice(identity, closes)).not.toContain("<button");
    // ...and the grid of doors opens only after that button has closed.
    expect(
      card.indexOf('className="grid grid-cols-2', identity),
    ).toBeGreaterThan(closes);
  });

  it("every live door is wired, and exactly one is parked", () => {
    // Two of these are the ONLY entrance to something in the whole app:
    // Instagram is the only reach door, and the Class ladder carries "Join
    // with Invitation", which Docs › Passport §C calls the only entrance for
    // a 10-digit invite PIN. A door quietly losing its handler is how invite
    // redemption nearly shipped unreachable once already.
    const wired = doorCells(card)
      .filter((c) => /onClick=\{/.test(c))
      .map((c) => c.match(/onClick=\{(\w+)\}/)?.[1]);
    expect(wired).toEqual(["onOpenProfile", "onOpenClass", "onOpenInstagram"]);
    // Friends has no surface in this codebase — the nearest thing is a
    // Contacts toggle in Settings. Parked is honest; a live cell that opens
    // nothing is not.
    const parked = doorCells(card)
      .filter((c) => /^\s*soon$/m.test(c))
      .map((c) => c.match(/label="([^"]+)"/)?.[1]);
    expect(parked).toEqual(["Friends"]);
  });

  it("says its own name, above the identity row", () => {
    // MESITA-1638: it is the only card on Me that is itself a button, and it
    // was the only one that did not say what it opens. The eyebrow must sit
    // ABOVE the identity, or it reads as a caption on the name.
    const card = read(CARD);
    const eyebrow = card.indexOf(">\n            Passport\n          <");
    expect(eyebrow, "the PASSPORT eyebrow is gone").toBeGreaterThan(-1);
    expect(card.indexOf("{name}")).toBeGreaterThan(eyebrow);
  });

  it("states privacy exactly once, and never as a control", () => {
    // Two spellings of one flag is how two surfaces start disagreeing about
    // what public means. The sheet owns the sentence; the card owns the word.
    expect([...card.matchAll(/\{isPublic \? "Public" : "Private"\}/g)]).toHaveLength(
      1,
    );
  });

  it("carries four doors: Profile · Friends / Class · Instagram", () => {
    expect(doorLabels(card)).toEqual([
      "Profile",
      "Friends",
      "Class",
      "Instagram",
    ]);
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

    const boxes = [...rendered.matchAll(/<DoorCell\b/g)].length;
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

  it("owns nothing — no Field here is a door", () => {
    // The rows were buttons for exactly one release (MESITA-1636), because
    // the card could not hold doors then. It holds four now, so a row here
    // would be a second door to a surface one tap above — Wallet's precedent
    // (MESITA-1609), "removed, not demoted".
    for (const door of ["onOpenProfile", "onOpenInstagram", "onOpenClass"]) {
      expect(sheet).not.toContain(door);
    }
    expect(sheet).not.toContain("handOff");
    // The two handlers that remain are the copy affordance and the one
    // handoff this sheet legitimately owns: Settings, which holds the privacy
    // switch this sheet only states.
    const handlers = [...sheet.matchAll(/onClick=\{(\w+)\}/g)].map((m) => m[1]);
    expect(handlers.sort()).toEqual(["copyCode", "onOpenSettings"]);
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
    // passport, and the fact that these four doors are the ONLY doors — the
    // note that stops the next agent from making one inert and stranding
    // invite redemption, which nearly shipped that way once.
    expect(card).toContain("NO PLAN");
    expect(card).toContain("EVERY DOOR HERE IS THE ONLY ONE");
  });
});
