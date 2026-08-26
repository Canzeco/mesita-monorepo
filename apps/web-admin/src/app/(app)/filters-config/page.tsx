import { Compass } from "lucide-react";
import { ConfigSoon } from "@/components/admin-ui/ConfigSoon";
import { CatalogConfigClient } from "./CatalogConfigClient";
import { getDiscoveryConfig } from "./actions";
import { DEFAULT_CONFIG } from "./catalog";

// Discovery — Catalog knobs are LIVE (consumer-web-list-catalog). Signals ·
// Engines stay Soon while Search/Map ranking is recut. The blob is untouched
// aside from catalog: Swipe still ranks from last-saved weights.
export const dynamic = "force-dynamic";

export default async function DiscoveryPage() {
  const seed = await getDiscoveryConfig();
  return (
    <div className="flex flex-col gap-10">
      <CatalogConfigClient
        initialConfig={seed.ok ? seed.config : DEFAULT_CONFIG}
        initialUpdatedAt={seed.ok ? seed.updatedAt : null}
        loadError={seed.ok ? null : seed.error}
      />
      <ConfigSoon
        Icon={Compass}
        title="Signals and engines are coming soon"
        body="Swipe still ranks from the last-saved blob. Search is a name bar plus an unranked map viewport — those knobs return when that architecture is stable."
        doc="Notion Docs › Discovery"
      />
    </div>
  );
}
