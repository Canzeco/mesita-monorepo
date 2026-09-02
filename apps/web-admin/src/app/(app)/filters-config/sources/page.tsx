import { GeneralConfigClient } from "../GeneralConfigClient";
import { GoogleSourceCards } from "../GoogleSourceCards";
import { MesitaSourceCards } from "../MesitaSourceCards";
import { SignalsConfigClient } from "../SignalsConfigClient";
import { getDiscoveryConfig } from "../actions";
import { DEFAULT_CONFIG } from "../catalog";

// Discovery Sources — nine boxes after the shared Google types strip: the
// three Google Places searches, the four Mesita Places searches, the two
// Mesita Social searches. Then the signals every Mesita source ranks with.
// Signals are not a Source. General is not a Source.
export const dynamic = "force-dynamic";

export default async function SearchSourcesPage() {
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
      <GoogleSourceCards />
      <MesitaSourceCards />
      <SignalsConfigClient
        initialConfig={initialConfig}
        initialUpdatedAt={initialUpdatedAt}
        loadError={loadError}
      />
    </div>
  );
}
