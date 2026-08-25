import { getDiscoveryConfig } from "./actions";
import { DiscoveryConfigClient } from "./DiscoveryConfigClient";
import { DEFAULT_CONFIG } from "./catalog";

// Discovery — two boxes: Signals (functions + hyperparameters) · Engines
// (Engine(signal(),…)). Slotting and filters ride the blob with no knobs.
export const dynamic = "force-dynamic";

export default async function DiscoveryPage() {
  const res = await getDiscoveryConfig();
  return (
    <DiscoveryConfigClient
      initialConfig={res.ok ? res.config : DEFAULT_CONFIG}
      initialUpdatedAt={res.ok ? res.updatedAt : null}
      loadError={res.ok ? null : res.error}
    />
  );
}
