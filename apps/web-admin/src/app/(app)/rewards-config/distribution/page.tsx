import { getPromosConfig } from "../actions";
import { PromosDistributionClient } from "../PromosDistributionClient";
import { DEFAULT_PROMOS } from "../promos";

// Promos Config · Distribution — reward-distribution simulator over the SAVED
// v10 config. Server-seeds the config like the Config tab; a failed GET shows
// a banner (there is nothing to save here, so no Save gating).
export const dynamic = "force-dynamic";

export default async function PromosDistributionPage() {
  const res = await getPromosConfig();
  return (
    <PromosDistributionClient
      initialConfig={res.ok ? res.config : DEFAULT_PROMOS}
      loadError={res.ok ? null : res.error}
    />
  );
}
