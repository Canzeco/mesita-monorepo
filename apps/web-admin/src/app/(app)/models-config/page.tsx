import { getModelsConfig } from "./actions";
import { ModelsConfigClient } from "./ModelsConfigClient";
import { DEFAULT_MODELS_CONFIG } from "./types";

export const dynamic = "force-dynamic";

export default async function ModelsConfigPage() {
  const models = await getModelsConfig();
  return (
    <ModelsConfigClient
      initialConfig={models.ok ? models.data : DEFAULT_MODELS_CONFIG}
      loadError={models.ok ? null : models.error}
    />
  );
}
