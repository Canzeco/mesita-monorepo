import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CatalogRailList } from "./CatalogRailList";
import { CATALOG_FAMILY_FACTS, CATALOG_SIGNAL_RAILS } from "./discovery-surface";
import { previewRequest, proximitySamples } from "./SignalGraphic";
import { ProximityCurve } from "./SignalMarks";

describe("signal graphics", () => {
  it("samples the proximity curve past Max km, within the EF's 24-point cap", () => {
    const samples = proximitySamples(25);
    expect(samples[0]).toBe(0);
    expect(samples.at(-1)).toBe(35);
    expect(samples.length).toBeLessThanOrEqual(24);
    expect(samples).toEqual([...samples].sort((a, b) => a - b));
  });

  it("asks the EF with the form's numbers", () => {
    expect(previewRequest("proximity", 12, 0.2)).toMatchObject({ signal: "proximity", maxKm: 12 });
    expect(previewRequest("timing", 25, 0.35)).toEqual({ signal: "timing", closedFloor: 0.35 });
    expect(previewRequest("category", 25, 0.2).signal).toBe("family");
    expect(previewRequest("enriched", 25, 0.2).signal).toBe("enrichment");
  });

  it("draws the curve with Max km marked", () => {
    const html = renderToStaticMarkup(
      <ProximityCurve
        maxKm={25}
        points={[
          { km: 0, score: 1 },
          { km: 25, score: 0 },
          { km: 35, score: 0 },
        ]}
      />,
    );
    expect(html).toContain("polyline");
    expect(html).toContain("25 km");
  });
});

describe("rails on Modes", () => {
  it("lists Google Places, Mesita Selected, then every family in Feed order", () => {
    const html = renderToStaticMarkup(<CatalogRailList />);
    const labels = [
      ...CATALOG_SIGNAL_RAILS.map((rail) => rail.label),
      ...CATALOG_FAMILY_FACTS.map((family) => family.label),
    ];
    expect(labels.slice(0, 2)).toEqual(["Google Places", "Mesita Selected"]);
    let last = -1;
    for (const label of labels) {
      const idx = html.indexOf(`</span>${label}</span>`);
      expect(idx, label).toBeGreaterThan(last);
      last = idx;
    }
  });
});
