import { getVerificationConfig, type VerificationConfig } from "../verification-config/actions";
import { VerificationConfigClient } from "../verification-config/VerificationConfigClient";
import { ModelsConfigClient } from "../models-config/ModelsConfigClient";

// General — Verification + Models, each keeping its own client, its own load
// and its own Save. Ojo's policy lives on Visits (who reads the proof);
// Ojo · Vision stays in Models because it is a model picker, not visit policy.
export const dynamic = "force-dynamic";

const FALLBACK_CONFIG: VerificationConfig = {
  createPlacesAsVerified: false,
  autoVerifyAiCall: true,
  autoVerifyAiEmail: true,
};

export default async function GeneralConfigPage() {
  const res = await getVerificationConfig();
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight">
            Verification
          </h2>
          <p className="text-muted-foreground mt-1 type-body leading-relaxed">
            The Mesita Partner badge is separate from ownership proof. These
            decide whether a successful phone or email OTP grants ownership
            outright, or waits on the Verification Queue under Alerts.
          </p>
        </div>
        <VerificationConfigClient
          initialConfig={res.ok ? res.config : FALLBACK_CONFIG}
          initialUpdatedAt={res.ok ? res.updatedAt : null}
          loadError={res.ok ? null : res.error}
        />
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight">
            Models
          </h2>
          <p className="text-muted-foreground mt-1 type-body leading-relaxed">
            Which model each subsystem thinks with. Every one of these is read
            at run time by an Edge Function — changing it changes token spend.
          </p>
        </div>
        <ModelsConfigClient />
      </section>
    </div>
  );
}
