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
    expect(pairs.length).toBeGreaterThanOrEqual(2);
    expect(Object.fromEntries(pairs)).toEqual(ENRICHER_TIER_MODELS);
  });
});

describe("normalizeTier", () => {
  it("keeps the two tiers", () => {
    expect(normalizeTier("economy")).toBe("economy");
    expect(normalizeTier("standard")).toBe("standard");
  });
  it("reads the retired high as standard, never as the cheap default", () => {
    expect(normalizeTier("high")).toBe("standard");
  });
  it("falls back to economy for anything unknown", () => {
    expect(normalizeTier("ultra")).toBe("economy");
    expect(normalizeTier(undefined)).toBe("economy");
  });
});
