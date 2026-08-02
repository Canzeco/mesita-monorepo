import { getRewardsConfig } from "../actions";
import { RewardsPlaygroundClient } from "../RewardsPlaygroundClient";
import { DEFAULT_CONFIG } from "../catalog";

// Rewards Config · Playground — model one guest's bill against the saved grid.
export const dynamic = "force-dynamic";

export default async function RewardsPlaygroundPage() {
  const res = await getRewardsConfig();
  return (
    <RewardsPlaygroundClient
      config={res.ok ? res.config : DEFAULT_CONFIG}
      loadError={res.ok ? null : res.error}
    />
  );
}
