import { Compass } from "lucide-react";
import { ConfigSoon } from "@/components/admin-ui/ConfigSoon";
import { CatalogConfigClient } from "./CatalogConfigClient";
import { DiscoveryConfigClient } from "./DiscoveryConfigClient";
import { MapConfigClient } from "./MapConfigClient";
import { getDiscoveryConfig } from "./actions";
import { DEFAULT_CONFIG } from "./catalog";

// Discovery — Catalog live, Map live, Social staged, Chat prompt live.
// Signals stay Soon. Each box saves its slice against the live blob.
export const dynamic = "force-dynamic";

export default async function DiscoveryPage() {
  const seed = await getDiscoveryConfig();
  const initialConfig = seed.ok ? seed.config : DEFAULT_CONFIG;
  const initialUpdatedAt = seed.ok ? seed.updatedAt : null;
  const loadError = seed.ok ? null : seed.error;
  return (
    <div className="flex flex-col gap-10">
      <CatalogConfigClient
        initialConfig={initialConfig}
        initialUpdatedAt={initialUpdatedAt}
        loadError={loadError}
      />
      <MapConfigClient
        initialConfig={initialConfig}
        initialUpdatedAt={initialUpdatedAt}
        loadError={loadError}
      />
      <DiscoveryConfigClient
        initialConfig={initialConfig}
        initialUpdatedAt={initialUpdatedAt}
        loadError={loadError}
      />
      <ConfigSoon
        Icon={Compass}
        title="Signals are coming soon"
        body="Swipe still ranks from the last-saved blob. Map floors and Nearby type batteries are the Map box on this page."
        doc="Notion Docs › Discovery"
      />
    </div>
  );
}
