import { getRewardsConfig } from "../actions";
import { RewardsConfigClient } from "../RewardsConfigClient";
import { DEFAULT_CONFIG } from "../catalog";

// Rewards Config · Config — the six-segment reward grid + universal cap.
export const dynamic = "force-dynamic";

export default async function RewardsConfigPage() {
  const res = await getRewardsConfig();
  return (
    <RewardsConfigClient
      initialConfig={res.ok ? res.config : DEFAULT_CONFIG}
      initialUpdatedAt={res.ok ? res.updatedAt : null}
      loadError={res.ok ? null : res.error}
    />
  );
}
