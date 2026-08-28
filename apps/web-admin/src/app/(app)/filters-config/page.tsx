import { CatalogConfigClient } from "./CatalogConfigClient";
import { DiscoveryConfigClient } from "./DiscoveryConfigClient";
import { FavsConfigCard } from "./DiscoverySurfaceCards";
import { GeneralConfigClient } from "./GeneralConfigClient";
import { MapConfigClient } from "./MapConfigClient";
import { NameConfigClient } from "./NameConfigClient";
import { SignalsConfigClient } from "./SignalsConfigClient";
import { SocialConfigClient } from "./SocialConfigClient";
import { SwipeConfigClient } from "./SwipeConfigClient";
import { getDiscoveryConfig } from "./actions";
import { DEFAULT_CONFIG } from "./catalog";

// Discovery boxes, operator order: General · Name (Fast Search) ·
// Name (Deep Search) · Map · Swipe · Catalog · Chat · Social ·
// Favorites · Signals. Home boxes (Swipe · Catalog · Chat · Social ·
// Favorites) are Soon.
export const dynamic = "force-dynamic";

export default async function DiscoveryPage() {
  const seed = await getDiscoveryConfig();
  const initialConfig = seed.ok ? seed.config : DEFAULT_CONFIG;
  const initialUpdatedAt = seed.ok ? seed.updatedAt : null;
  const loadError = seed.ok ? null : seed.error;
  return (
    <div className="flex flex-col gap-10">
      <GeneralConfigClient
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
      <SignalsConfigClient
        initialConfig={initialConfig}
        initialUpdatedAt={initialUpdatedAt}
        loadError={loadError}
      />
    </div>
  );
}
