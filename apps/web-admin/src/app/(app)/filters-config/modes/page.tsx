import { CatalogConfigClient } from "../CatalogConfigClient";
import { DiscoveryConfigClient } from "../DiscoveryConfigClient";
import { FavsConfigCard } from "../DiscoverySurfaceCards";
import { GeneralGateConfigClient } from "../GeneralGateConfigClient";
import { MapConfigClient } from "../MapConfigClient";
import { NameConfigClient } from "../NameConfigClient";
import { SwipeConfigClient } from "../SwipeConfigClient";
import { getDiscoveryConfig } from "../actions";
import { DEFAULT_CONFIG } from "../catalog";

// Discovery Modes — ways guests look. General (the post-Google wipe every
// mode runs) leads, then one card per mode with locked source chips, in
// section 8.1 order: Word · Map · Catalog · Swipe · Chat · Favorites. Word
// is one mode with two live boxes. The matrix moved to its own subpage
// (MESITA-1675); Google types live on Search Sources.
export const dynamic = "force-dynamic";

export default async function DiscoveryModesPage() {
  const seed = await getDiscoveryConfig();
  const initialConfig = seed.ok ? seed.config : DEFAULT_CONFIG;
  const initialUpdatedAt = seed.ok ? seed.updatedAt : null;
  const loadError = seed.ok ? null : seed.error;
  return (
    <div className="flex flex-col gap-10">
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
      <CatalogConfigClient />
      <SwipeConfigClient />
      <DiscoveryConfigClient />
      <FavsConfigCard />
    </div>
  );
}
