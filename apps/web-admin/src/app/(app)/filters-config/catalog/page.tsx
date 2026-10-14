import { CatalogRankingClient } from "../CatalogRankingClient";
import { getDiscoveryConfig } from "../actions";
import { DEFAULT_CONFIG } from "../catalog";

// Catalog — seven family lists, one ranking profile. The mode card on
// Modes stays the guest-surface note. The exponents live here.
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
