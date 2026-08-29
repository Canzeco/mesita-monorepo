import { CatalogConfigClient } from "../CatalogConfigClient";
import { DiscoveryConfigClient } from "../DiscoveryConfigClient";
import { DiscoveryMatrix } from "../DiscoveryMatrix";
import { FavsConfigCard } from "../DiscoverySurfaceCards";
import { GeneralGateConfigClient } from "../GeneralGateConfigClient";
import { MapConfigClient } from "../MapConfigClient";
import { NameConfigClient } from "../NameConfigClient";
import { SocialConfigClient } from "../SocialConfigClient";
import { SwipeConfigClient } from "../SwipeConfigClient";
import { getDiscoveryConfig } from "../actions";
import { DEFAULT_CONFIG } from "../catalog";

// Discovery Modes — ways guests look. Matrix first, then General (the
// post-Google wipe every mode runs), then one card per mode with locked
// module chips. Home boxes are Soon. Google types live on Modules.
export const dynamic = "force-dynamic";

export default async function SearchModesPage() {
  const seed = await getDiscoveryConfig();
  const initialConfig = seed.ok ? seed.config : DEFAULT_CONFIG;
  const initialUpdatedAt = seed.ok ? seed.updatedAt : null;
  const loadError = seed.ok ? null : seed.error;
  return (
    <div className="flex flex-col gap-10">
      <DiscoveryMatrix />
      <GeneralGateConfigClient
        initialConfig={initialConfig}
        initialUpdatedAt={initialUpdatedAt}
        loadError={loadError}
      />
      <NameConfigClient
        initialConfig={initialConfig}
        initialUpdatedAt={initialUpdatedAt}
        loadError={loadError}
      />
      <MapConfigClient
        initialConfig={initialConfig}
        initialUpdatedAt={initialUpdatedAt}
        loadError={loadError}
      />
      <SwipeConfigClient />
      <CatalogConfigClient />
      <DiscoveryConfigClient />
      <SocialConfigClient />
      <FavsConfigCard />
    </div>
  );
}
