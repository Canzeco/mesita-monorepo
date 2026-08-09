// Unit tests — the Lineup Config strict save gate (MESITA-805, after MESITA-804).
//
// WHY THIS FILE EXISTS. `/lineup-config` could not save ANY section for a week
// (2026-07-26 → 2026-08-02) and nothing caught it. The admin page posts the
// WHOLE blob on every section save, the client's coercer stopped emitting a
// required `rp.*` key, and this validator hard-400s on the first missing key.
// No typecheck, lint or CI signal fired,
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
  rp: { zero: 0.1, conservative: 0.4, aggressive: 1 },
  // XX is the Randomness TABLE (Pato 2026-08-09): the consumer's word ladder
  // → one integer control 0–5 per rung. The pre-table flat `xx.control` is
  // still accepted (see the compat test below) so draining admin builds save.
  xx: { levels: { low: 0, medium: 1, high: 2, extra: 3, max: 5 } },
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
  ["xx"],
  ["xx", "levels"],
  ["xx", "levels", "low"],
  ["xx", "levels", "medium"],
  ["xx", "levels", "high"],
  ["xx", "levels", "extra"],
  ["xx", "levels", "max"],
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

Deno.test("validate: the MESITA-804 regression still catches a missing required RP key", () => {
  const r = validate(withoutPath(["rp", "aggressive"]));
  assert(!r.ok);
  assertStringIncludes(r.error, "rp.aggressive");
});

Deno.test("validate: retired dominant is ignored when stale clients include it", () => {
  const stale = structuredClone(CANONICAL_BLOB) as typeof CANONICAL_BLOB & {
    rp: typeof CANONICAL_BLOB.rp & { dominant: number };
  };
  stale.rp.dominant = 0.9;
  const r = validate(stale);
  assert(r.ok);
  assertEquals(
    "dominant" in ((r.config as { rp: Record<string, number> }).rp),
    false,
  );
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
  wild.rp.aggressive = 42;
  wild.xx.levels.max = 42;
  wild.xx.levels.low = -3;
  const r = validate(wild);
  assert(r.ok);
  const c = r.config as typeof CANONICAL_BLOB;
  assertEquals(c.laneN.organic, 50); // LANE_N_MAX
  assertEquals(c.rp.aggressive, 1);
  assertEquals(c.xx.levels.max, 5);
  assertEquals(c.xx.levels.low, 0);
});

Deno.test("validate: XX rungs are whole numbers 0–5 — decimals round", () => {
  const decimal = structuredClone(CANONICAL_BLOB);
  decimal.xx.levels.medium = 1.4;
  decimal.xx.levels.high = 2.6;
  const r = validate(decimal);
  assert(r.ok);
  const c = r.config as typeof CANONICAL_BLOB;
  assertEquals(c.xx.levels.medium, 1);
  assertEquals(c.xx.levels.high, 3);
});

Deno.test("validate: a pre-table blob's flat xx.control becomes the low rung", () => {
  // An admin build from before the table posts `xx: { control: 0.1 }`. It must
  // still save — a 400 here wedges EVERY section for that build (MESITA-804).
  const legacy = { ...structuredClone(CANONICAL_BLOB), xx: { control: 0.1 } };
  const r = validate(legacy);
  assert(r.ok, `legacy blob rejected: ${r.ok ? "" : r.error}`);
  assertEquals((r.config as typeof CANONICAL_BLOB).xx.levels, {
    low: 0, // round(0.1) — the flat default WAS the no-filter value
    medium: 1,
    high: 2,
    extra: 3,
    max: 5,
  });
});
