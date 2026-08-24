import { getDiscoveryConfig } from "./actions";
import { DiscoveryConfigClient } from "./DiscoveryConfigClient";
import { DEFAULT_CONFIG } from "./catalog";

// Discovery — the ranking model (MESITA-1196). TWO boxes: Signals · Engines.
// Slotting and operator filters still ride the blob; this page does not edit them.
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
