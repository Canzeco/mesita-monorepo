import {
  DEFAULT_VERIFICATION_CONFIG,
  getVerificationConfig,
} from "./actions";
import { VerificationConfigClient } from "./VerificationConfigClient";

// Verification Config — partner badge + ownership auto-confirm policies.
export const dynamic = "force-dynamic";

export default async function VerificationConfigPage() {
  const res = await getVerificationConfig();
  return (
    <VerificationConfigClient
      initialConfig={res.ok ? res.config : DEFAULT_VERIFICATION_CONFIG}
      initialUpdatedAt={res.ok ? res.updatedAt : null}
      loadError={res.ok ? null : res.error}
    />
  );
}
