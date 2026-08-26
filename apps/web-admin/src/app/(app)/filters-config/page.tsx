import { Compass } from "lucide-react";
import { ConfigSoon } from "@/components/admin-ui/ConfigSoon";
import { getDiscoveryConfig } from "./actions";
import { DEFAULT_CONFIG } from "./catalog";
import { DiscoveryConfigClient } from "./DiscoveryConfigClient";

// Discovery — Chat prompt is live (MESITA-1337). Signals · Engines stay Soon
// while Search/Map is recut. Whole-blob save still round-trips weights so
// Swipe keeps last-saved ranking. catalog.ts still names vendor APIs.
export const dynamic = "force-dynamic";

export default async function DiscoveryPage() {
  const r = await getDiscoveryConfig();
  return (
    <div className="flex flex-col gap-10">
      <DiscoveryConfigClient
        initialConfig={r.ok ? r.config : DEFAULT_CONFIG}
        initialUpdatedAt={r.ok ? r.updatedAt : null}
        loadError={r.ok ? null : r.error}
      />
      <ConfigSoon
        Icon={Compass}
        title="Signals and Engines are coming soon"
        body="Swipe still ranks from the last-saved blob. Search is a name bar plus an unranked map viewport — those knobs return when that architecture is stable."
        doc="Notion Docs › Discovery"
      />
    </div>
  );
}
