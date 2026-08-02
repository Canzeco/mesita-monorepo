// Unit tests — the Lineup Config strict save gate (MESITA-805, after MESITA-804).
//
// WHY THIS FILE EXISTS. `/lineup-config` could not save ANY section for a week
// (2026-07-26 → 2026-08-02) and nothing caught it. The admin page posts the
// WHOLE blob on every section save, the client's coercer stopped emitting
// `rp.dominant` when #497 retired the Dominant strategy, and this validator
// hard-400s on the first missing key. No typecheck, lint or CI signal fired,
// because the client's key list and this one are separate literals in separate
// runtimes.
//
// CANONICAL_BLOB below is that missing link: it is the exact shape the admin
// console posts (verified against live app_settings.scoring_config). The
// required-key test deletes each key in turn and asserts a rejection, so the
// contract is written down and every load-bearing key is provably load-bearing.
//
// If you make a key optional or add a new required one, this file and
// web-admin lib/business/scores.ts `coerceScoringSettings` change together.

import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { validate } from "./lineup-config-validate.ts";

// The live v12 blob, exactly as the admin console posts it on any section save.
const CANONICAL_BLOB = {
  v: 12,
  laneN: { organic: 10, inorganic: 10 },
  sm: {
    where: { defaultTolKm: 5 },
    when: { patience: 0.35 },
    what: { tol: 0.5 },
  },
  gp: { lnCeiling: 10, ratingPow: 1 },
  rp: { zero: 0.1, conservative: 0.4, aggressive: 0.7, dominant: 1 },
  xx: { control: 0.1 },
};

// Every key the gate REQUIRES, as a path into the blob. Deleting any one of
// these must produce a 400 — that is the whole contract in one list.
const REQUIRED_PATHS: readonly string[][] = [
  ["laneN"],
  ["laneN", "organic"],
  ["laneN", "inorganic"],
  ["gp"],
  ["gp", "lnCeiling"],
  ["rp"],
  ["rp", "zero"],
  ["rp", "conservative"],
  ["rp", "aggressive"],
  ["rp", "dominant"], // the one that broke the page — MESITA-804
  ["xx"],
  ["xx", "control"],
];

function withoutPath(path: readonly string[]): unknown {
  const clone = structuredClone(CANONICAL_BLOB) as Record<string, unknown>;
  let node: Record<string, unknown> = clone;
  for (const key of path.slice(0, -1)) {
    node = node[key] as Record<string, unknown>;
  }
  delete node[path[path.length - 1]];
  return clone;
}

Deno.test("validate: the blob the admin console posts is accepted", () => {
  const r = validate(CANONICAL_BLOB);
  assert(r.ok, `canonical blob rejected: ${r.ok ? "" : r.error}`);
});

Deno.test("validate: output round-trips — its own clean blob is accepted again", () => {
  // The page saves, stores what the EF returned, then posts that back on the
  // next save. If the gate ever rejected its own output the page would wedge
  // after one successful save.
  const first = validate(CANONICAL_BLOB);
  assert(first.ok);
  const second = validate(first.config);
  assert(second.ok, `gate rejected its own output: ${second.ok ? "" : second.error}`);
  assertEquals(second.config, first.config);
});

Deno.test("validate: every required key is load-bearing", () => {
  for (const path of REQUIRED_PATHS) {
    const r = validate(withoutPath(path));
    assert(
      !r.ok,
      `dropping ${path.join(".")} was accepted — either the gate went lenient ` +
        `(good: remove it from REQUIRED_PATHS) or the key moved`,
    );
  }
});

Deno.test("validate: the MESITA-804 regression, named", () => {
  const r = validate(withoutPath(["rp", "dominant"]));
  assert(!r.ok);
  assertStringIncludes(r.error, "rp.dominant");
});

Deno.test("validate: non-object bodies are rejected", () => {
  for (const bad of [null, undefined, 42, "config", true]) {
    assert(!validate(bad).ok, `${String(bad)} was accepted`);
  }
});

Deno.test("validate: laneN accepts the scalar shorthand, both lanes off is rejected", () => {
  const scalar = { ...structuredClone(CANONICAL_BLOB), laneN: 8 };
  const r = validate(scalar);
  assert(r.ok);
  assertEquals((r.config as { laneN: unknown }).laneN, { organic: 8, inorganic: 8 });

  const allOff = { ...structuredClone(CANONICAL_BLOB), laneN: { organic: 0, inorganic: 0 } };
  const off = validate(allOff);
  assert(!off.ok);
  assertStringIncludes(off.error, "at least one lane");
});

Deno.test("validate: out-of-range numbers clamp rather than reject", () => {
  const wild = structuredClone(CANONICAL_BLOB);
  wild.laneN.organic = 9_999;
  wild.rp.dominant = 42;
  wild.xx.control = -3;
  const r = validate(wild);
  assert(r.ok);
  const c = r.config as typeof CANONICAL_BLOB;
  assertEquals(c.laneN.organic, 50); // LANE_N_MAX
  assertEquals(c.rp.dominant, 1);
  assertEquals(c.xx.control, 0);
});
