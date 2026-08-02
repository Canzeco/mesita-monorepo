import { getSourcingConfig } from "./actions";
import { SourcingConfigClient } from "./SourcingConfigClient";
import { DEFAULT_CONFIG } from "./catalog";

// Sourcing Config — the per-channel eligibility policy table.
export const dynamic = "force-dynamic";

export default async function SourcingConfigPage() {
  const res = await getSourcingConfig();
  return (
    <SourcingConfigClient
      initialConfig={res.ok ? res.config : DEFAULT_CONFIG}
      initialUpdatedAt={res.ok ? res.updatedAt : null}
      loadError={res.ok ? null : res.error}
    />
  );
}
