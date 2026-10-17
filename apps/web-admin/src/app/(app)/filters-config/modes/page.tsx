import { CatalogRankingClient } from "../CatalogRankingClient";
import { MapConfigClient } from "../MapConfigClient";
import { ModeFact } from "../ModeFactList";
import { ModeSignalProvider, ModeSignals } from "../ModeSignals";
import { ModeWeightsClient } from "../ModeWeightsClient";
import { NameConfigClient } from "../NameConfigClient";
import { getDiscoveryConfig } from "../actions";
import { DEFAULT_CONFIG } from "../catalog";

// Discovery Modes. Catalog stays here. Weights sit on the modes that rank.
// Each mode also shows the signals it uses.
export const dynamic = "force-dynamic";

export default async function DiscoveryModesPage() {
  const seed = await getDiscoveryConfig();
  const initialConfig = seed.ok ? seed.config : DEFAULT_CONFIG;
  const initialUpdatedAt = seed.ok ? seed.updatedAt : null;
  const loadError = seed.ok ? null : seed.error;
  const props = { initialConfig, initialUpdatedAt, loadError };
  return (
    <ModeSignalProvider {...props}>
      <div className="flex flex-col gap-10">
        <ModeFact modeKey="word" />
        <NameConfigClient {...props} />
        <ModeSignals modeKey="word" />
        <ModeFact modeKey="map" />
        <MapConfigClient {...props} />
        <ModeWeightsClient {...props} only="map" />
        <ModeSignals modeKey="map" />
        <div id="s-catalog" className="scroll-mt-16 flex flex-col gap-10">
          <ModeFact modeKey="catalog" />
          <CatalogRankingClient {...props} />
          <ModeSignals modeKey="catalog" />
        </div>
        <ModeFact modeKey="chat" />
        <ModeSignals modeKey="chat" />
        <ModeFact modeKey="favorites" />
        <ModeSignals modeKey="favorites" />
      </div>
    </ModeSignalProvider>
  );
}
