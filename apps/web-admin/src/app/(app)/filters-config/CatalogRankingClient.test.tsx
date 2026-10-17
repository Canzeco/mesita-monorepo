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
  it("shows only the signals the catalog engine multiplies", () => {
    const markup = html();
    expect(markup).toContain("Proximity");
    expect(markup).toContain("Enriched");
    expect(markup).toContain("Popularity");
    expect(markup).toContain("Randomness");
    expect(markup).not.toContain(">Name<");
    expect(markup).not.toContain(">Description<");
    expect(markup).not.toContain(">Selected<");
    expect(markup).toContain("Share 50%");
    expect(markup).toContain("Share Off");
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
        ranking: {
          ...DEFAULT_CONFIG.catalog.ranking,
          proximity: 0,
          enriched: 0,
          popularity: 0,
          randomness: 0,
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
