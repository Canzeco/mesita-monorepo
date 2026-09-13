import { getIntakerModelSettings, getModelsConfig } from "./actions";
import { ModelsConfigClient } from "./ModelsConfigClient";
import {
  DEFAULT_INTAKER_MODEL_SETTINGS,
  DEFAULT_MODELS_CONFIG,
} from "./types";

export const dynamic = "force-dynamic";

export default async function ModelsConfigPage() {
  const [models, intaker] = await Promise.all([
    getModelsConfig(),
    getIntakerModelSettings(),
  ]);
  return (
    <ModelsConfigClient
      initialConfig={models.ok ? models.data : DEFAULT_MODELS_CONFIG}
      initialIntaker={
        intaker.ok ? intaker.data : DEFAULT_INTAKER_MODEL_SETTINGS
      }
      loadError={models.ok ? null : models.error}
      intakerLoadError={intaker.ok ? null : intaker.error}
    />
  );
}
