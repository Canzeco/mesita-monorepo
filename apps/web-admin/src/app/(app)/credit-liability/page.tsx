import { getCreditLiability } from "./actions";
import { CreditLiabilityClient } from "./CreditLiabilityClient";

// Credits Liability (MESITA-1679) — issued value, outstanding balance,
// pending lots, per-org exposure and breakage to date, plus the
// refund/cancel/adjust action support needs on a money feature. Distinct
// from /controls-config, which is the Credits POLICY page (the hold, the
// bonus, the expiry knobs) — this is the exposure that policy produces.
export const dynamic = "force-dynamic";

export default async function CreditLiabilityPage() {
  const r = await getCreditLiability();
  return (
    <CreditLiabilityClient
      initialLiability={r.ok ? r.liability : null}
      loadError={r.ok ? null : r.error}
    />
  );
}
