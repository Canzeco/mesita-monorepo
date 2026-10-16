import { CatalogRankingClient } from "../CatalogRankingClient";
import { MapConfigClient } from "../MapConfigClient";
import { ModeFact } from "../ModeFactList";
import { ModeWeightsClient } from "../ModeWeightsClient";
import { NameConfigClient } from "../NameConfigClient";
import { SwipeConfigClient } from "../SwipeConfigClient";
import { getDiscoveryConfig } from "../actions";
import { DEFAULT_CONFIG } from "../catalog";

// Discovery Modes. Catalog stays here. Weights sit on the modes that rank.
export const dynamic = "force-dynamic";

export default async function DiscoveryModesPage() {
  const seed = await getDiscoveryConfig();
  const initialConfig = seed.ok ? seed.config : DEFAULT_CONFIG;
  const initialUpdatedAt = seed.ok ? seed.updatedAt : null;
  const loadError = seed.ok ? null : seed.error;
  const props = { initialConfig, initialUpdatedAt, loadError };
  return (
    <div className="flex flex-col gap-10">
      <ModeFact modeKey="word" />
      <NameConfigClient {...props} />
      <ModeFact modeKey="map" />
      <MapConfigClient {...props} />
      <ModeWeightsClient {...props} only="map" />
      <div id="s-catalog" className="scroll-mt-16 flex flex-col gap-10">
        <ModeFact modeKey="catalog" />
        <CatalogRankingClient {...props} />
      </div>
      <ModeFact modeKey="swipe" />
      <SwipeConfigClient {...props} />
      <ModeWeightsClient {...props} only="swipe" />
      <ModeFact modeKey="chat" />
      <ModeFact modeKey="favorites" />
    </div>
  );
}
