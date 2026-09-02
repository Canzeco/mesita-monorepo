import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  coerceConfig,
  DEFAULT_CONFIG,
  DEFAULT_GENERAL,
  GENERAL_MIN_REVIEWS_MAX,
} from "./catalog";

vi.mock("./actions", () => ({
  getDiscoveryConfig: vi.fn(async () => ({
    ok: true,
    config: DEFAULT_CONFIG,
    updatedAt: "2026-08-29T00:00:00.000Z",
  })),
  updateDiscoveryConfig: vi.fn(),
}));

import { GeneralGateConfigClient } from "./GeneralGateConfigClient";

function render(minReviews = 0, requireActive = true) {
  const config = {
    ...DEFAULT_CONFIG,
    general: { ...DEFAULT_CONFIG.general, minReviews, requireActive },
  };
  return renderToStaticMarkup(
    <GeneralGateConfigClient
      initialConfig={config}
      initialUpdatedAt="2026-08-29T00:00:00.000Z"
      loadError={null}
    />,
  );
}

describe("Discovery General — the post-Google wipe", () => {
  it("only active places is ON by default, and unknown is not active", () => {
    // A closed place is not a search result (Pato, 2026-08-29). The live
    // blob predates both keys, so the DEFAULT is what every surface reads.
    expect(DEFAULT_GENERAL.requireActive).toBe(true);
    expect(DEFAULT_GENERAL.minReviews).toBe(0);
    expect(coerceConfig({ general: { categoryCount: 5 } }).general).toEqual(
      DEFAULT_GENERAL,
    );

    const html = render();
    expect(html).toContain("Only active places");
    expect(html).toContain("OPERATIONAL");
    expect(html).toContain("unknown is not active");
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-label="Only active places"/);
  });

  it("names the modes it cuts and says a filter excludes", () => {
    const html = render();
    expect(html).toContain("after every Google Places query");
    expect(html).toContain("Fast · Deep · Map · suggest-places");
    expect(html).toContain("A filter excludes; a signal demotes");
    // It cuts on-Mesita rows too — that was the bug.
    expect(html).toContain("the Mesita rows they resolve to");
  });

  it("the review floor reads 0 as off and says a floor drops unknowns", () => {
    const off = render(0);
    expect(off).toContain("Minimum Google reviews");
    expect(off).toContain("0 is off");
    const on = render(25);
    expect(on).toContain("Under 25 reviews is wiped");
    expect(on).toContain("no review count");
  });

  it("clamps the review floor to the same ceiling as filters.minReviews", () => {
    expect(GENERAL_MIN_REVIEWS_MAX).toBe(100_000);
    expect(coerceConfig({ general: { minReviews: 1e9 } }).general.minReviews).toBe(
      GENERAL_MIN_REVIEWS_MAX,
    );
    expect(coerceConfig({ general: { minReviews: -3 } }).general.minReviews).toBe(0);
    expect(coerceConfig({ general: { minReviews: 4.6 } }).general.minReviews).toBe(5);
    expect(
      coerceConfig({ general: { requireActive: false } }).general.requireActive,
    ).toBe(false);
  });

  it("edits only its own slice — Google types stay on Search Sources", () => {
    const html = render();
    expect(html).not.toContain("Google categories");
    expect(html).not.toContain("Categories available");
    expect(html).not.toContain("Restaurants");
  });
});
