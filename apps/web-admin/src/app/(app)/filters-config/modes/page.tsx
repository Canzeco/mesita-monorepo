import { CatalogConfigClient } from "../CatalogConfigClient";
import { DiscoveryConfigClient } from "../DiscoveryConfigClient";
import { FavsConfigCard } from "../DiscoverySurfaceCards";
import { MapConfigClient } from "../MapConfigClient";
import { NameConfigClient } from "../NameConfigClient";
import { SocialConfigClient } from "../SocialConfigClient";
import { SwipeConfigClient } from "../SwipeConfigClient";
import { getDiscoveryConfig } from "../actions";
import { DEFAULT_CONFIG } from "../catalog";

// Discovery Modes — ways guests look. Name (Fast) · Name (Deep) · Map ·
// Swipe · Catalog · Chat · Social · Favorites. Home boxes are Soon.
// This page still seeds the live Name / Map clients; no new EF work.
export const dynamic = "force-dynamic";

export default async function SearchModesPage() {
  const seed = await getDiscoveryConfig();
  const initialConfig = seed.ok ? seed.config : DEFAULT_CONFIG;
  const initialUpdatedAt = seed.ok ? seed.updatedAt : null;
  const loadError = seed.ok ? null : seed.error;
  return (
    <div className="flex flex-col gap-10">
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
