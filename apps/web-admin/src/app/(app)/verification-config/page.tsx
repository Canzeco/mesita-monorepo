import { getVerificationConfig, type VerificationConfig } from "./actions";
import { VerificationConfigClient } from "./VerificationConfigClient";

// Verification Config — partner badge + ownership auto-confirm policies.
export const dynamic = "force-dynamic";

const FALLBACK_CONFIG: VerificationConfig = {
  createPlacesAsVerified: false,
  autoVerifyAiCall: true,
  autoVerifyAiEmail: true,
  autoVerifyVideo: false,
};

export default async function VerificationConfigPage() {
  const res = await getVerificationConfig();
  return (
    <VerificationConfigClient
      initialConfig={res.ok ? res.config : FALLBACK_CONFIG}
      initialUpdatedAt={res.ok ? res.updatedAt : null}
      loadError={res.ok ? null : res.error}
    />
  );
}
