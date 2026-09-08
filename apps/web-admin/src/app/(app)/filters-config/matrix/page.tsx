import { DiscoveryMatrix } from "../DiscoveryMatrix";
import { SignalsConfigClient } from "../SignalsConfigClient";
import { getDiscoveryConfig } from "../actions";
import { DEFAULT_CONFIG } from "../catalog";

// Matrix — the first Discovery subpage (Pato, 2026-09-08). It holds the two
// things that are neither a mode nor a source: the locked mode × entity ×
// pool × source × signal matrix, and the weights that rank what any source
// returns. The matrix used to sit on top of Modes and Signals at the bottom
// of Sources; both were guests on pages that did not describe them.
//
// The matrix card says "Locked." about ITSELF, not about this page. Signals
// below it are fully editable and keep their own slice Save.
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
