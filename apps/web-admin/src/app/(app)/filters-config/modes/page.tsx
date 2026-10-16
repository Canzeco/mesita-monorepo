import { MapConfigClient } from "../MapConfigClient";
import { ModeFactList } from "../ModeFactList";
import { ModeWeightsClient } from "../ModeWeightsClient";
import { NameConfigClient } from "../NameConfigClient";
import { SwipeConfigClient } from "../SwipeConfigClient";
import { getDiscoveryConfig } from "../actions";
import { DEFAULT_CONFIG } from "../catalog";

// Discovery Modes. Facts for every mode, then the settings the runtime reads.
// Signal weights are only on Map and Swipe, the two modes that multiply
// more than one lineup signal. Word has one signal. Catalog's profile is
// on the Catalog tab.
export const dynamic = "force-dynamic";

export default async function DiscoveryModesPage() {
  const seed = await getDiscoveryConfig();
  const initialConfig = seed.ok ? seed.config : DEFAULT_CONFIG;
  const initialUpdatedAt = seed.ok ? seed.updatedAt : null;
  const loadError = seed.ok ? null : seed.error;
  const props = { initialConfig, initialUpdatedAt, loadError };
  return (
    <div className="flex flex-col gap-10">
      <ModeFactList />
      <NameConfigClient {...props} />
      <MapConfigClient {...props} />
      <SwipeConfigClient {...props} />
      <ModeWeightsClient {...props} />
    </div>
  );
}
