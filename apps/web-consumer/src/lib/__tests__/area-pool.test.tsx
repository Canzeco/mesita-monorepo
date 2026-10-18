import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { AreaDiagnostics as Area } from "@/lib/api/places";
import {
  AreaDiagnostics,
  diagExpression,
  diagNumber,
} from "@/components/consumer/home/AreaDiagnostics";
import {
  AREA_POOL_TTL_MS,
  areaPoolKey,
  readAreaPool,
  writeAreaPool,
} from "@/lib/area-pool-cache";

// MESITA-2384: the temporary score breakdown and the per-location pool.
const base: Area = {
  familyKeys: ["coffee"],
  gates: { family: 1, territory: null, radius: 1, active: 1, ready: 1, reviews: null },
  signals: { proximity: 0.82, popularity: null },
  selected: 1,
  source: "selected",
  base: 0.41,
  final: 0.41,
  formula: "point",
};

describe("AreaDiagnostics (temporary)", () => {
  it("prints two decimals and n/a for null — never 0 for a missing number", () => {
    expect(diagNumber(0)).toBe("0.00");
    expect(diagNumber(null)).toBe("n/a");
    expect(diagNumber(0.456)).toBe("0.46");
  });

  it("a point reads base × selected = final", () => {
    expect(diagExpression(base)).toBe("base 0.41 × selected 1.00 = 0.41");
    const html = renderToStaticMarkup(<AreaDiagnostics area={base} />);
    expect(html).toContain("proximity 0.82");
    expect(html).toContain("popularity n/a");
    expect(html).toContain("radius 1");
    expect(html).not.toContain("in area");
    expect(html).toContain("data-area-diagnostics");
  });

  it("an area reads area × popularity × selected = final, and never says Territory", () => {
    const area: Area = {
      ...base,
      gates: { ...base.gates, territory: 1, radius: null },
      signals: { proximity: null, popularity: 0.4 },
      selected: 0.3,
      source: "google",
      base: 0.4,
      final: 0.12,
      formula: "area",
    };
    expect(diagExpression(area)).toBe("area 1 × popularity 0.40 × selected 0.30 = 0.12");
    const html = renderToStaticMarkup(<AreaDiagnostics area={area} />);
    expect(html).toContain("in area 1");
    expect(html).not.toContain("proximity");
    expect(html).not.toMatch(/territory/i);
  });
});

describe("the per-location pool cache", () => {
  it("keys a saved location by id, current location by ~1 km cell, none without a location", () => {
    expect(areaPoolKey(null)).toBe("none");
    expect(areaPoolKey({ key: "saved:x", lat: 1, lng: 2 })).toBe("saved:x");
    expect(areaPoolKey({ lat: 25.6512, lng: -100.2891 })).toBe("current:25.65,-100.29");
    expect(areaPoolKey({ lat: 25.6538, lng: -100.2899 })).toBe("current:25.65,-100.29");
  });

  it("keeps a pool ten minutes, then forgets it", () => {
    const pool = { shape: "unified" as const, kind: "point" as const, places: [] };
    writeAreaPool("k", pool, 1000);
    expect(readAreaPool("k", 1000 + AREA_POOL_TTL_MS - 1)).toBe(pool);
    expect(readAreaPool("k", 1000 + AREA_POOL_TTL_MS)).toBeNull();
    expect(readAreaPool("k", 1000)).toBeNull();
  });
});
