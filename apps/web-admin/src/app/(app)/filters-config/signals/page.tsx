import { SignalsConfigClient } from "../SignalsConfigClient";
import { getDiscoveryConfig } from "../actions";
import { DEFAULT_CONFIG } from "../catalog";

// Signals — the function each signal computes. Weights live on Modes.
export const dynamic = "force-dynamic";

export default async function DiscoverySignalsPage() {
  const seed = await getDiscoveryConfig();
  return (
    <SignalsConfigClient
      initialConfig={seed.ok ? seed.config : DEFAULT_CONFIG}
      initialUpdatedAt={seed.ok ? seed.updatedAt : null}
      loadError={seed.ok ? null : seed.error}
    />
  );
}
