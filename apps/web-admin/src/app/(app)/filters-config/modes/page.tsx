import { MapConfigClient } from "../MapConfigClient";
import { ModeFactList } from "../ModeFactList";
import { NameConfigClient } from "../NameConfigClient";
import { SwipeConfigClient } from "../SwipeConfigClient";
import { getDiscoveryConfig } from "../actions";
import { DEFAULT_CONFIG } from "../catalog";

// Discovery Modes. Facts, then the settings the runtime reads.
// Catalog is a link to the next subpage. Signal weights live there.
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
    </div>
  );
}
