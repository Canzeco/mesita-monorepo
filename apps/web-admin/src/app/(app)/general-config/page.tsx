import { getVerificationConfig, type VerificationConfig } from "../verification-config/actions";
import { VerificationConfigClient } from "../verification-config/VerificationConfigClient";
import { getModelsConfig } from "../models-config/actions";
import { ModelsConfigClient } from "../models-config/ModelsConfigClient";
import { DEFAULT_MODELS_CONFIG } from "../models-config/types";
import { getOjoConfig } from "../ojo-config/actions";
import { OjoConfigClient } from "../ojo-config/OjoConfigClient";
import { OJO_FALLBACK } from "../ojo-config/defaults";

// General — Models first (Pato, 2026-08-24: "in general, models must be
// on top"), then Verification, then Ojo. Each keeps its own client, load
// and Save. Do not wrap them in a second heading — SectionCard already
// owns the title.
export const dynamic = "force-dynamic";

const FALLBACK_CONFIG: VerificationConfig = {
  createPlacesAsVerified: false,
  autoVerifyAiCall: true,
  autoVerifyAiEmail: true,
};

export default async function GeneralConfigPage() {
  const [res, models, ojo] = await Promise.all([
    getVerificationConfig(),
    getModelsConfig(),
    getOjoConfig(),
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
      <OjoConfigClient
        initialConfig={ojo.ok ? ojo.config : OJO_FALLBACK}
        initialUpdatedAt={ojo.ok ? ojo.updatedAt : null}
        loadError={ojo.ok ? null : ojo.error}
      />
    </div>
  );
}
