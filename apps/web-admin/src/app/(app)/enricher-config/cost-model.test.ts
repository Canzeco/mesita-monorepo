import { describe, expect, it } from "vitest";

import { computeEnrichmentCost } from "./cost-model";

const base = {
  quality: "economy" as const,
  imageModel: "economy" as const,
  gCollect: 5,
  igCollect: 10,
  gAnalyze: 5,
  igAnalyze: 10,
  links: {
    website: 5,
    instagram: 5,
    facebook: 3,
    opentable: 3,
    ubereats: 0,
  },
  places: 1,
};

describe("computeEnrichmentCost", () => {
  it("standard synthesis costs more than economy and stays finite", () => {
    const economy = computeEnrichmentCost(base);
    const standard = computeEnrichmentCost({ ...base, quality: "standard" });
    expect(standard.perPlace).toBeGreaterThan(economy.perPlace);
    for (const n of [
      economy.perPlace,
      economy.total,
      economy.perPlaceSecs,
      standard.perPlace,
      standard.total,
    ]) {
      expect(Number.isFinite(n)).toBe(true);
    }
  });

  it("link N=0 drops the Firecrawl discovery lines", () => {
    const none = computeEnrichmentCost({
      ...base,
      links: {
        website: 0,
        instagram: 0,
        facebook: 0,
        opentable: 0,
        ubereats: 0,
      },
    });
    const firecrawl = none.lines.find((l) => l.label.startsWith("4 · link"));
    expect(firecrawl?.active).toBe(false);
    expect(firecrawl?.cost).toBe(0);
    expect(none.active.some((l) => l.label.startsWith("4 ·"))).toBe(false);
  });

  it("zero analyze counts drop vision spend", () => {
    const off = computeEnrichmentCost({
      ...base,
      gAnalyze: 0,
      igAnalyze: 0,
    });
    expect(off.lines.find((l) => l.label.startsWith("6 · image descriptions"))?.active).toBe(
      false,
    );
    const on = computeEnrichmentCost(base);
    expect(on.perPlace).toBeGreaterThan(off.perPlace);
  });
});
