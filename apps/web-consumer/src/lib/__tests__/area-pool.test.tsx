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
  gates: { family: 1, radius: 1, active: 1, ready: 1, reviews: null },
  signals: { proximity: 0.82, popularity: null },
  source: "selected",
  final: 0.41,
  formula: "point",
};

describe("AreaDiagnostics (temporary)", () => {
  it("prints two decimals and n/a for null — never 0 for a missing number", () => {
    expect(diagNumber(0)).toBe("0.00");
    expect(diagNumber(null)).toBe("n/a");
    expect(diagNumber(0.456)).toBe("0.46");
  });

  it("a point reads proximity × popularity = final, no exponents (MESITA-2722)", () => {
    expect(diagExpression(base)).toBe("proximity 0.82 × popularity n/a = 0.41");
    const html = renderToStaticMarkup(<AreaDiagnostics area={base} />);
    expect(html).toContain("proximity 0.82");
    expect(html).toContain("popularity n/a");
    expect(html).toContain("radius 1");
    expect(html).not.toContain("in area");
    expect(html).toContain("data-area-diagnostics");
  });

  it("no point has no Proximity and no zone gate (MESITA-2501, MESITA-2603)", () => {
    const area: Area = {
      ...base,
      gates: { ...base.gates, radius: null },
      signals: { proximity: null, popularity: 0.4 },
      source: "google",
      final: 0.4,
      formula: "none",
    };
    expect(diagExpression(area)).toBe("popularity 0.40 = 0.40");
    const html = renderToStaticMarkup(<AreaDiagnostics area={area} />);
    expect(html).not.toContain("in area");
    expect(html).not.toContain("proximity");
    expect(html).not.toMatch(/territory/i);
  });
});

describe("the per-location pool cache", () => {
  it("keys a saved pin by id and spot, current location by ~1 km cell, none without a location", () => {
    expect(areaPoolKey(null)).toBe("none");
    expect(areaPoolKey({ key: "saved:x", lat: 1, lng: 2 })).toBe("saved:x@1.0000,2.0000|r:op");
    // A moved pin is a new question (MESITA-2501); a renamed one is not.
    expect(areaPoolKey({ key: "saved:x", lat: 1.0005, lng: 2 })).not.toBe(
      areaPoolKey({ key: "saved:x", lat: 1, lng: 2 }),
    );
    expect(areaPoolKey({ lat: 25.6512, lng: -100.2891 })).toBe("current:25.65,-100.29|r:op");
    expect(areaPoolKey({ lat: 25.6538, lng: -100.2899 })).toBe("current:25.65,-100.29|r:op");
  });

  it("the radius is part of the question: same pin, two radii, two pools (MESITA-2703)", () => {
    const pin = { key: "saved:x", lat: 1, lng: 2 };
    expect(areaPoolKey({ ...pin, radiusKm: 3 })).toBe("saved:x@1.0000,2.0000|r:3.0");
    expect(areaPoolKey({ ...pin, radiusKm: 3 })).not.toBe(areaPoolKey({ ...pin, radiusKm: 5 }));
    expect(areaPoolKey({ ...pin, radiusKm: null })).toBe(areaPoolKey(pin));
  });

  it("keeps a pool ten minutes, then forgets it", () => {
    const pool = { kind: "point" as const, places: [] };
    writeAreaPool("k", pool, 1000);
    expect(readAreaPool("k", 1000 + AREA_POOL_TTL_MS - 1)).toBe(pool);
    expect(readAreaPool("k", 1000 + AREA_POOL_TTL_MS)).toBeNull();
    expect(readAreaPool("k", 1000)).toBeNull();
  });
});
