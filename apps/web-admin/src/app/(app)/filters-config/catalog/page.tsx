import { CatalogRankingClient } from "../CatalogRankingClient";
import { getDiscoveryConfig } from "../actions";
import { DEFAULT_CONFIG } from "../catalog";

// Catalog — one ranking profile for every guest family list. Family
// membership stays on Atlas. The relative weights live here.
export const dynamic = "force-dynamic";

export default async function DiscoveryCatalogPage() {
  const seed = await getDiscoveryConfig();
  return (
    <CatalogRankingClient
      initialConfig={seed.ok ? seed.config : DEFAULT_CONFIG}
      initialUpdatedAt={seed.ok ? seed.updatedAt : null}
      loadError={seed.ok ? null : seed.error}
    />
  );
}
