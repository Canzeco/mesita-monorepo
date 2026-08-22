import { getFiltersConfig } from "../actions";
import { GeneralConfigClient } from "../GeneralConfigClient";
import { DEFAULT_FILTERS } from "../filters";

// Discovery › Signals — the six modules a guest can express, and the law each
// engine inherits. Server-seeds so a failed GET becomes loadError and Save
// stays blocked (MESITA-737).
export const dynamic = "force-dynamic";

export default async function DiscoverySignalsPage() {
  const res = await getFiltersConfig();
  return (
    <GeneralConfigClient
      initialConfig={res.ok ? res.config : DEFAULT_FILTERS}
      initialUpdatedAt={res.ok ? res.updatedAt : null}
      initialSeeded={res.ok ? res.seeded : false}
      loadError={res.ok ? null : res.error}
    />
  );
}
