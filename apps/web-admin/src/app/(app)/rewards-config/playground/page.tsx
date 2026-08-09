import { getPromosConfig } from "../actions";
import { PromosPlaygroundClient } from "../PromosPlaygroundClient";
import { DEFAULT_PROMOS } from "../promos";

// Promos Config · Playground — reward-distribution simulator over the SAVED
// v10 config. Server-seeds the config like the Config tab; a failed GET shows
// a banner (there is nothing to save here, so no Save gating).
export const dynamic = "force-dynamic";

export default async function PromosPlaygroundPage() {
  const res = await getPromosConfig();
  return (
    <PromosPlaygroundClient
      initialConfig={res.ok ? res.config : DEFAULT_PROMOS}
      loadError={res.ok ? null : res.error}
    />
  );
}
