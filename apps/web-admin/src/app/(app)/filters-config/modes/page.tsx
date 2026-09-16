import { CatalogConfigClient } from "../CatalogConfigClient";
import { DiscoveryConfigClient } from "../DiscoveryConfigClient";
import { FavsConfigCard } from "../DiscoverySurfaceCards";
import { MapConfigClient } from "../MapConfigClient";
import { ModeWeightsClient } from "../ModeWeightsClient";
import { NameConfigClient } from "../NameConfigClient";
import { SwipeConfigClient } from "../SwipeConfigClient";
import { getDiscoveryConfig } from "../actions";
import { DEFAULT_CONFIG } from "../catalog";

// Discovery Modes — ways guests look. One card per mode with locked source
// chips, in section 8.1 order: Word · Map · Catalog · Swipe · Chat ·
// Favorites. Word is one mode with two live boxes.
//
// The matrix moved to its own subpage (MESITA-1675) and the General wipe
// moved INTO Google Places Autocomplete Search on Sources (MESITA-1681): a
// floor belongs to the source it cuts, not to a page about modes.
//
// THE WEIGHTS TABLE LEADS (MESITA-1859). It is the one control on this page
// that spans modes — signals down the side, the modes that actually rank
// across the top — so it reads before the per-mode cards rather than being
// filed inside one of them. The mode boxes follow in section 8.1 order.
export const dynamic = "force-dynamic";

export default async function DiscoveryModesPage() {
  const seed = await getDiscoveryConfig();
  const initialConfig = seed.ok ? seed.config : DEFAULT_CONFIG;
  const initialUpdatedAt = seed.ok ? seed.updatedAt : null;
  const loadError = seed.ok ? null : seed.error;
  return (
    <div className="flex flex-col gap-10">
      <ModeWeightsClient
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
      <SwipeConfigClient
        initialConfig={initialConfig}
        initialUpdatedAt={initialUpdatedAt}
        loadError={loadError}
      />
      <DiscoveryConfigClient />
      <FavsConfigCard />
    </div>
  );
}
