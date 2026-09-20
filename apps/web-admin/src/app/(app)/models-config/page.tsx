import { getEnricherModelSettings, getModelsConfig } from "./actions";
import { ModelsConfigClient } from "./ModelsConfigClient";
import {
  DEFAULT_ENRICHER_MODEL_SETTINGS,
  DEFAULT_MODELS_CONFIG,
} from "./types";

export const dynamic = "force-dynamic";

export default async function ModelsConfigPage() {
  const [models, enricher] = await Promise.all([
    getModelsConfig(),
    getEnricherModelSettings(),
  ]);
  return (
    <ModelsConfigClient
      initialConfig={models.ok ? models.data : DEFAULT_MODELS_CONFIG}
      initialEnricher={
        enricher.ok ? enricher.data : DEFAULT_ENRICHER_MODEL_SETTINGS
      }
      loadError={models.ok ? null : models.error}
      enricherLoadError={enricher.ok ? null : enricher.error}
    />
  );
}
