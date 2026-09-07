// The mirror of web-admin's state-vocabulary test.
//
// It exists twice on purpose. `apps/web-admin` and `apps/web-business` each
// carry a byte-identical copy of `state-vocabulary.ts`, there is no root pnpm
// workspace to share it from (packages are independent install roots because
// mobile needs `nodeLinker: hoisted`), and CI is path-filtered per package —
// so a guard living only in one app would never run on the other app's edit,
// which is precisely the change that breaks them apart.
//
// MESITA-1608 is the first change that actually edits both copies. Before it,
// nothing in the repo would have noticed a divergence.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  GENERAL_STATE_COUNT,
  GENERAL_STATE_FACTS,
  INTAKE_FUNCTION_COUNT,
  INTAKE_FUNCTIONS,
  STATE_FACT_FALSE_TONE,
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
      "Enriching",
      "Enriched",
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
  });

  it("keeps rose for a debt and grey for a fact that simply is not true", () => {
    expect(STATE_FACT_FALSE_TONE.owned).toBe("neutral");
    expect(STATE_FACT_FALSE_TONE.partner).toBe("neutral");
    // Verified stays ROSE: on a place you hold, unproven ownership is a debt
    // you can settle. The pool withholds the fact rather than restyling it.
    expect(STATE_FACT_FALSE_TONE.verified).toBeUndefined();
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
  it("is byte-identical to the other app copy", () => {
    const here = readFileSync(path.join(__dirname, "./state-vocabulary.ts"), "utf8");
    const other = path.join(
      __dirname,
      "../../../web-admin/src/lib/state-vocabulary.ts",
    );
    // Fail loudly if the file MOVED, rather than passing vacuously.
    expect(existsSync(other), `${other} not found — did the file move?`).toBe(true);
    expect(readFileSync(other, "utf8")).toBe(here);
  });
});
