import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { coerceConfig, DEFAULT_CONFIG, MIN_RATING_MAX } from "./catalog";

vi.mock("./actions", () => ({
  getDiscoveryConfig: vi.fn(async () => ({
    ok: true,
    config: DEFAULT_CONFIG,
    updatedAt: "2026-09-08T00:00:00.000Z",
  })),
  updateDiscoveryConfig: vi.fn(),
}));

import { PoolQualityFloorCard } from "./PoolQualityFloorCard";

function render(minReviews = 0, minRating = 0) {
  const config = {
    ...DEFAULT_CONFIG,
    filters: { ...DEFAULT_CONFIG.filters, minReviews, minRating },
  };
  return renderToStaticMarkup(
    <PoolQualityFloorCard
      initialConfig={config}
      initialUpdatedAt="2026-09-08T00:00:00.000Z"
      loadError={null}
    />,
  );
}

describe("Discovery — the Mesita pool quality floor", () => {
  it("names the lanes it cuts, and they are the ones that never call Google", () => {
    // The whole point of the box (MESITA-1667): `filters` is enforced on
    // Home rails, Pay / bbox and Swipe via applyDiscoveryFilters, and had no
    // knob anywhere. A reader must be able to tell it apart from the General
    // gate, which only ever touches what a Google query returned.
    const html = render();
    expect(html).toContain("Mesita pool quality floor");
    expect(html).toContain("Home rails");
    expect(html).toContain("Swipe");
    expect(html).toContain("never call Google");
  });

  it("reads 0 as off on both, and says a floor drops unknowns", () => {
    const off = render();
    expect(off).toContain("0 is off on both");
    expect(off).toContain("no rating or no review count is dropped");

    const on = render(25);
    expect(on).toContain("drops a place with no number at all");
  });

  it("steers the operator to the count before the rating", () => {
    // gte excludes nulls and most of a young catalog is unrated, so a
    // rating floor empties rails a review floor would only thin.
    expect(render()).toContain("Reach for the count first");
  });

  it("clamps both floors on the way in", () => {
    expect(MIN_RATING_MAX).toBe(5);
    expect(coerceConfig({ filters: { minRating: 9 } }).filters.minRating).toBe(5);
    expect(coerceConfig({ filters: { minRating: -1 } }).filters.minRating).toBe(0);
    // One decimal — a floor at 4.300000000000001 would leave the page dirty.
    expect(coerceConfig({ filters: { minRating: 4.26 } }).filters.minRating).toBe(4.3);
    expect(coerceConfig({ filters: { minReviews: 1e9 } }).filters.minReviews).toBe(100_000);
    expect(coerceConfig({ filters: { minReviews: -5 } }).filters.minReviews).toBe(0);
  });

  it("leaves the two non-quality keys off the box", () => {
    // requireReady is the enrichment lifecycle gate; maxDistanceKm is
    // geography. Neither is a quality floor and neither gets a control here.
    const html = render();
    expect(html).not.toContain("Ready");
    expect(html).not.toContain("Distance");
  });
});
