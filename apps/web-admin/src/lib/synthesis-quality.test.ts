import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ENRICHER_TIER_MODELS, normalizeTier } from "./synthesis-quality";

// The backend's tier→model map, read from the supabase package. The supabase
// side pins the same pair (_shared/enrich-tiers.test.ts); this half runs when
// only web-admin changes.
const BACKEND = join(
  __dirname,
  "../../../../supabase/supabase/functions/_shared/enrich-config.ts",
);

describe("ENRICHER_TIER_MODELS", () => {
  it("names the same model per tier as the backend's QUALITY_MODEL", () => {
    const src = readFileSync(BACKEND, "utf8");
    const block = src.match(/QUALITY_MODEL[^=]*=\s*\{([\s\S]*?)\}/)?.[1];
    expect(block, "QUALITY_MODEL not found in enrich-config.ts").toBeTruthy();
    const pairs = [...block!.matchAll(/(\w+):\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]);
    expect(pairs.length).toBeGreaterThanOrEqual(1);
    expect(Object.fromEntries(pairs)).toEqual(ENRICHER_TIER_MODELS);
  });
});

describe("normalizeTier", () => {
  it("reads every stored tier, retired ones included, as the one tier (MESITA-3966)", () => {
    for (const q of ["efficient", "economy", "standard", "high", "ultra", undefined]) {
      expect(normalizeTier(q)).toBe("efficient");
    }
  });
});
