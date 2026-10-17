import { CatalogRankingClient } from "../CatalogRankingClient";
import { MapConfigClient } from "../MapConfigClient";
import { ModeFact } from "../ModeFactList";
import { ModeWeightsClient } from "../ModeWeightsClient";
import { NameConfigClient } from "../NameConfigClient";
import type { ConfigSeed } from "@/components/admin-ui/use-config-editor";
import type { DiscoveryConfig } from "../catalog";

// Discovery Modes. Catalog stays here. A mode sets the weight of each signal
// it ranks. The function, the curve, and the graphic live on Signals.
export function DiscoveryModesView({ seed }: { seed: ConfigSeed<DiscoveryConfig> }) {
  const props = seed;
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
      <ModeFact modeKey="chat" />
      <ModeFact modeKey="favorites" />
    </div>
  );
}

export default function DiscoveryModesPage() {
  return null;
}
