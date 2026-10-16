import { DiscoveryMatrix } from "../DiscoveryMatrix";
import { SignalsConfigClient } from "../SignalsConfigClient";
import { getDiscoveryConfig } from "../actions";
import { DEFAULT_CONFIG } from "../catalog";

// Matrix — modes against the sources they call. Routing is fixed.
// Under it, the two signal shape numbers the lineup still reads.
export const dynamic = "force-dynamic";

export default async function DiscoveryMatrixPage() {
  const seed = await getDiscoveryConfig();
  const initialConfig = seed.ok ? seed.config : DEFAULT_CONFIG;
  const initialUpdatedAt = seed.ok ? seed.updatedAt : null;
  const loadError = seed.ok ? null : seed.error;
  return (
    <div className="flex flex-col gap-10">
      <DiscoveryMatrix />
      <SignalsConfigClient
        initialConfig={initialConfig}
        initialUpdatedAt={initialUpdatedAt}
        loadError={loadError}
      />
    </div>
  );
}
