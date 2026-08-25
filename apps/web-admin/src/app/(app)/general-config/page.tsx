import { getVerificationConfig, type VerificationConfig } from "../verification-config/actions";
import { VerificationConfigClient } from "../verification-config/VerificationConfigClient";
import { getModelsConfig } from "../models-config/actions";
import { ModelsConfigClient } from "../models-config/ModelsConfigClient";
import { DEFAULT_MODELS_CONFIG } from "../models-config/types";

// General — Models first (Pato, 2026-08-24: "in general, models must be
// on top"), then Verification. Each keeps its own client, load and Save.
// Ojo's policy lives on Visits (who reads the proof); Ojo · Vision stays
// in Models because it is a model picker, not visit policy. Do not wrap
// them in a second heading — SectionCard already owns the title.
export const dynamic = "force-dynamic";

const FALLBACK_CONFIG: VerificationConfig = {
  createPlacesAsVerified: false,
  autoVerifyAiCall: true,
  autoVerifyAiEmail: true,
};

export default async function GeneralConfigPage() {
  const [res, models] = await Promise.all([
    getVerificationConfig(),
    getModelsConfig(),
  ]);
  return (
    <div className="flex flex-col gap-10">
      <ModelsConfigClient
        initialConfig={models.ok ? models.data : DEFAULT_MODELS_CONFIG}
        loadError={models.ok ? null : models.error}
      />
      <VerificationConfigClient
        initialConfig={res.ok ? res.config : FALLBACK_CONFIG}
        initialUpdatedAt={res.ok ? res.updatedAt : null}
        loadError={res.ok ? null : res.error}
      />
    </div>
  );
}
