import type { ConfigSeed } from "@/components/admin-ui/use-config-editor";
import { SignalsConfigClient } from "../SignalsConfigClient";
import type { DiscoveryConfig } from "../catalog";

// Signals — the function, the curve, and the graphic. Weights live on Modes.
export function DiscoverySignalsView({ seed }: { seed: ConfigSeed<DiscoveryConfig> }) {
  return (
    <SignalsConfigClient
      initialConfig={seed.initialConfig}
      initialUpdatedAt={seed.initialUpdatedAt}
      loadError={seed.loadError}
    />
  );
}

export default function DiscoverySignalsPage() {
  return null;
}
