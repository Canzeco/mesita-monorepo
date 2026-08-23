import { getVerificationConfig, type VerificationConfig } from "../verification-config/actions";
import { VerificationConfigClient } from "../verification-config/VerificationConfigClient";
import { ModelsConfigClient } from "../models-config/ModelsConfigClient";
import { getOjoConfig } from "../ojo-config/actions";
import { OjoConfigClient } from "../ojo-config/OjoConfigClient";
import { OJO_FALLBACK } from "../ojo-config/defaults";

// General — Verification + Models, each keeping its own client, its own load
// and its own Save. The two clients render cards only (their page chrome lived
// in the layouts that this page replaces), so composing them needs no surgery
// on either form.
export const dynamic = "force-dynamic";

const FALLBACK_CONFIG: VerificationConfig = {
  createPlacesAsVerified: false,
  autoVerifyAiCall: true,
  autoVerifyAiEmail: true,
  autoVerifyVideo: false,
};

export default async function GeneralConfigPage() {
  const [res, ojo] = await Promise.all([getVerificationConfig(), getOjoConfig()]);
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

      {/* Ojo moved here (Pato, 2026-08-21): after its own reduction it is three
          controls, which is the ≤3 rule this page runs on. Its own save stays
          — a third write target, never fused with the other two. */}
      <section className="flex flex-col gap-4">
        <OjoConfigClient
          initialConfig={ojo.ok ? ojo.config : OJO_FALLBACK}
          initialUpdatedAt={ojo.ok ? ojo.updatedAt : null}
          loadError={ojo.ok ? null : ojo.error}
        />
      </section>
    </div>
  );
}
