import { Compass } from "lucide-react";
import { ConfigSoon } from "@/components/admin-ui/ConfigSoon";
import { CatalogConfigClient } from "./CatalogConfigClient";
import { DiscoveryConfigClient } from "./DiscoveryConfigClient";
import { FavsConfigCard } from "./DiscoverySurfaceCards";
import { GeneralConfigClient } from "./GeneralConfigClient";
import { MapConfigClient } from "./MapConfigClient";
import { NameConfigClient } from "./NameConfigClient";
import { SocialConfigClient } from "./SocialConfigClient";
import { SwipeConfigClient } from "./SwipeConfigClient";
import { getDiscoveryConfig } from "./actions";
import { DEFAULT_CONFIG } from "./catalog";

// Discovery boxes, operator order: General · Name · Map · Swipe · Catalog ·
// Chat · Social · Favs. General, Name, Map, Swipe, and Chat knobs are live.
// Fast Search and Deep Search stay two boxes. Catalog and Social are empty
// Soon boxes. Favs has no knobs. Signals stay Soon.
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
      <SwipeConfigClient
        initialConfig={initialConfig}
        initialUpdatedAt={initialUpdatedAt}
        loadError={loadError}
      />
      <CatalogConfigClient />
      <DiscoveryConfigClient
        initialConfig={initialConfig}
        initialUpdatedAt={initialUpdatedAt}
        loadError={loadError}
      />
      <SocialConfigClient />
      <FavsConfigCard />
      <ConfigSoon
        Icon={Compass}
        title="Signals are coming soon"
        body="Swipe ranks from the Swipe box on this page. Map floors stay on the Map box. General caps how many Google types are available. Fast Search and Deep Search still own their toggles."
        doc="Notion Docs › Discovery"
      />
    </div>
  );
}
