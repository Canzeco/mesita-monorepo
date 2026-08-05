import { getVerificationConfig } from "./actions";
import { VerificationConfigClient } from "./VerificationConfigClient";

// Verification Config — create-as-verified policy for new places.
export const dynamic = "force-dynamic";

export default async function VerificationConfigPage() {
  const res = await getVerificationConfig();
  return (
    <VerificationConfigClient
      initialConfig={
        res.ok ? res.config : { createPlacesAsVerified: false }
      }
      initialUpdatedAt={res.ok ? res.updatedAt : null}
      loadError={res.ok ? null : res.error}
    />
  );
}
