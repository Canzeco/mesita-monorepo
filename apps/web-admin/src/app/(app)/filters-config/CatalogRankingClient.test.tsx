import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  getDiscoveryConfig: vi.fn(),
  updateDiscoveryConfig: vi.fn(),
}));

import { CatalogRankingClient } from "./CatalogRankingClient";
import { DEFAULT_CONFIG } from "./catalog";
import { CATALOG_ALL_ZERO_ERROR } from "./catalog-shares";
import type { DiscoveryConfig } from "./catalog";

function html(config: DiscoveryConfig = DEFAULT_CONFIG, loadError: string | null = null) {
  return renderToStaticMarkup(
    <CatalogRankingClient
      initialConfig={config}
      initialUpdatedAt={null}
      loadError={loadError}
    />,
  );
}

describe("Catalog ranking", () => {
  it("shows only the signals the shared engine multiplies for Mesita Selected", () => {
    const markup = html();
    expect(markup).toContain(">Proximity<");
    expect(markup).toContain(">Popularity<");
    // Enriched is the gate (every Selected row carries it) and Randomness is
    // pinned to 0 on a pin field; Name, Description and Selected are stored
    // and never applied. A knob nothing reads is not a knob (MESITA-2298).
    for (const absent of [
      ">Enriched<",
      ">Randomness<",
      ">Name<",
      ">Description<",
      ">Selected<",
    ]) {
      expect(markup, absent).not.toContain(absent);
    }
    // Proximity 1 and Popularity 1 → 50% each; nothing is Off at the defaults.
    expect(markup).toContain("Share 50%");
    expect(markup).not.toContain("Share Off");
    expect(markup).toContain("a shuffled pin is a moved pin");
    expect(markup).toContain("Google Places rank with the Map column");
    expect(markup).toContain("Family filter · shared profile");
    expect(markup).toContain("Coffee");
    expect(markup).toContain("Feel better");
    expect(markup).toContain("Unchanged");
  });

  it("rejects an all-zero profile before save", () => {
    const config: DiscoveryConfig = {
      ...DEFAULT_CONFIG,
      catalog: {
        ...DEFAULT_CONFIG.catalog,
        // Only the two live keys go to zero: a stored Enriched 2 or a
        // Randomness above 0 cannot rescue the profile, because the engine
        // never multiplies them.
        ranking: {
          ...DEFAULT_CONFIG.catalog.ranking,
          proximity: 0,
          popularity: 0,
        },
      },
    };
    const markup = html(config);
    expect(markup).toContain(CATALOG_ALL_ZERO_ERROR);
    expect(markup).toContain("disabled");
  });

  it("shows a load error and does not pretend the form is ready", () => {
    const markup = html(DEFAULT_CONFIG, "discovery_config_read");
    expect(markup).toContain("discovery_config_read");
  });
});
