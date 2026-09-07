import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ENGINELESS_STATE_FACT_KEYS,
  GENERAL_STATE_COUNT,
  GENERAL_STATE_FACTS,
  INTAKE_FUNCTION_COUNT,
  INTAKE_FUNCTIONS,
  intakeFunctionLabel,
  STATE_FACT_FALSE_TONE,
  operatorPromotingLevel,
  promotingLevelChip,
  promotingLevelFromStrategy,
  requestCountChip,
  requestCountFromRow,
  stateBoolChip,
} from "./state-vocabulary";

describe("state vocabulary", () => {
  it("is twelve general facts plus eleven Intake functions 0–10", () => {
    // Owned joined with MESITA-1608 — an organization holds this place, which
    // is not the same claim as Verified (having PROVED you hold it).
    expect(GENERAL_STATE_COUNT).toBe(12);
    expect(INTAKE_FUNCTION_COUNT).toBe(11);
    expect(GENERAL_STATE_FACTS.map((f) => f.label)).toEqual([
      "Created",
      "Active",
      "Listed",
      "Requested",
      "Enriched",
      "Enriching",
      "Verified",
      "Owned",
      "Partnered",
      "Visit Rewards",
      "Mesita Pay",
      "Mesita Credits",
    ]);
    expect(INTAKE_FUNCTIONS.map((f) => `${f.n}. ${f.label}`)).toEqual([
      "0. Seed",
      "1. Pulse",
      "2. Details",
      "3. Serp",
      "4. Links",
      "5. Social",
      "6. Images",
      "7. Menu",
      "8. Reviews",
      "9. Description",
      "10. Embedding",
    ]);
    expect(INTAKE_FUNCTIONS.map((f) => intakeFunctionLabel(f.n, f.label))).toEqual(
      INTAKE_FUNCTIONS.map((f) => `${f.n}. ${f.label}`),
    );
  });

  it("acceptance bits: neutral false tone, engineless (no chips/segments) until their engines land", () => {
    expect(STATE_FACT_FALSE_TONE.partner).toBe("neutral");
    expect(STATE_FACT_FALSE_TONE.mesita_pay).toBe("neutral");
    expect(STATE_FACT_FALSE_TONE.credits).toBe("neutral");
    // Unclaimed is the pool's normal condition, not a debt.
    expect(STATE_FACT_FALSE_TONE.owned).toBe("neutral");
    // Verified stays ROSE: on a place you hold, unproven ownership is a debt
    // you can settle. The pool withholds the fact instead of restyling it.
    expect(STATE_FACT_FALSE_TONE.verified).toBeUndefined();
    expect([...ENGINELESS_STATE_FACT_KEYS]).toEqual(["mesita_pay", "credits"]);
  });

  it("binary chips are true / false, not the fact name", () => {
    expect(stateBoolChip(true)).toBe("true");
    expect(stateBoolChip(false)).toBe("false");
    expect(stateBoolChip("unknown")).toBe("?");
    expect(stateBoolChip("loading")).toBe("…");
    expect(stateBoolChip(null)).toBe("?");
  });

  it("Visit Rewards is 0 | 1 | 2 — engine Dominant displays as 2", () => {
    expect(operatorPromotingLevel(0)).toBe(0);
    expect(operatorPromotingLevel(1)).toBe(1);
    expect(operatorPromotingLevel(2)).toBe(2);
    expect(operatorPromotingLevel(3)).toBe(2);
    expect(operatorPromotingLevel(-1)).toBe(0);
    expect(operatorPromotingLevel(undefined)).toBe(0);
    expect(promotingLevelChip(3)).toBe("2");
    expect(promotingLevelFromStrategy(false, "aggressive")).toBe(0);
    expect(promotingLevelFromStrategy(true, "conservative")).toBe(1);
    expect(promotingLevelFromStrategy(true, "aggressive")).toBe(2);
    expect(promotingLevelFromStrategy(true, "dominant")).toBe(2);
    expect(promotingLevelFromStrategy(true, null)).toBe(2);
  });

  it("Requested is 0…n, never a Yes/No", () => {
    expect(requestCountFromRow(0)).toBe(0);
    expect(requestCountFromRow(1)).toBe(1);
    expect(requestCountFromRow(12.9)).toBe(12);
    expect(requestCountFromRow("7")).toBe(7);
    expect(requestCountFromRow(null)).toBe("unknown");
    expect(requestCountFromRow(undefined)).toBe("unknown");
    expect(requestCountFromRow(-1)).toBe("unknown");
    expect(requestCountChip(0)).toBe("0");
    expect(requestCountChip(4)).toBe("4");
    expect(requestCountChip(undefined)).toBe("?");
  });
});

// A SECOND gate, deliberately.
//
// `deno task sync-shared:check` in rules.yml is the first: shared/ is the
// source and both copies are generated from it (MESITA-1614). This runs in
// each app's OWN path-filtered CI, so it still fires on a change that the
// repo-wide workflow's filter somehow misses — and it fails on the same
// mistake from the other direction, which is worth the four lines.
describe("the two app copies must not drift", () => {
  // apps/web-admin and apps/web-business each carry a byte-identical copy of
  // this file. There is no root pnpm workspace to share it from — packages are
  // independent install roots because mobile needs nodeLinker: hoisted — so
  // the only thing that can hold them together is a test.
  //
  // It lives in BOTH packages on purpose. CI is path-filtered per package, so
  // a guard only in web-business would never run on a web-admin-only edit,
  // which is exactly the change that would break it.
  it("is byte-identical to the other app copy", () => {
    const here = readFileSync(path.join(__dirname, "./state-vocabulary.ts"), "utf8");
    const other = path.join(__dirname, "../../../web-business/src/lib/state-vocabulary.ts");
    // Fail loudly if the file MOVED, rather than passing vacuously.
    expect(existsSync(other), `${other} not found — did the file move?`).toBe(true);
    expect(readFileSync(other, "utf8")).toBe(here);
  });
});
