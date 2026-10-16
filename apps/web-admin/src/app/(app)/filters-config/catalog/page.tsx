import { CatalogRankingClient } from "../CatalogRankingClient";
import { ModeWeightsClient } from "../ModeWeightsClient";
import { getDiscoveryConfig } from "../actions";
import { DEFAULT_CONFIG } from "../catalog";

// Catalog — the family-list profile, then the Map and Swipe lineup exponents.
// Modes only links here.
export const dynamic = "force-dynamic";

export default async function DiscoveryCatalogPage() {
  const seed = await getDiscoveryConfig();
  const props = {
    initialConfig: seed.ok ? seed.config : DEFAULT_CONFIG,
    initialUpdatedAt: seed.ok ? seed.updatedAt : null,
    loadError: seed.ok ? null : seed.error,
  };
  return (
    <div className="flex flex-col gap-10">
      <CatalogRankingClient {...props} />
      <ModeWeightsClient {...props} />
    </div>
  );
}
