import { getEnricherModelSettings, getModelsConfig } from "./actions";
import { ModelsConfigClient } from "./ModelsConfigClient";

// Server-only load (MESITA-2126): the route is dynamic, so client navigation
// re-renders it with fresh values and the client needs no re-fetch of its own.
// A failed half passes null, and the client shows "unavailable" rather than a
// default dressed as the live value.
export const dynamic = "force-dynamic";

export default async function ModelsConfigPage() {
  const [models, enricher] = await Promise.all([
    getModelsConfig(),
    getEnricherModelSettings(),
  ]);
  return (
    <ModelsConfigClient
      initialConfig={models.ok ? models.data : null}
      initialEnricher={enricher.ok ? enricher.data : null}
      loadError={!models.ok ? models.error : !enricher.ok ? enricher.error : null}
    />
  );
}
