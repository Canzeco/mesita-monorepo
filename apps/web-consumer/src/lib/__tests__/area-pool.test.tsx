import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { AreaDiagnostics as Area } from "@/lib/api/places";
import {
  AreaDiagnostics,
  diagExpression,
  diagNumber,
} from "@/components/consumer/home/AreaDiagnostics";

// MESITA-2384: the temporary score breakdown. The per-mode pool cache is
// pinned in catalog-modes.test.ts (MESITA-4454).
const base: Area = {
  familyKeys: ["coffee"],
  gates: { family: 1, radius: 1, active: 1, ready: 1, reviews: null },
  signals: { proximity: 0.82, popularity: null },
  source: "mesita",
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
