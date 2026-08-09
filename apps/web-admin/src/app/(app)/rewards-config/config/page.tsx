import { getPromosConfig } from "../actions";
import { PromosConfigClient } from "../PromosConfigClient";
import { DEFAULT_PROMOS } from "../promos";

// Promos Config · Config — the v10 additive model. Server-seeds like the other
// blob editors so a failed GET surfaces as loadError and Save stays blocked
// (MESITA-737) — never silently edit code defaults over the live singleton.
export const dynamic = "force-dynamic";

export default async function PromosConfigPage() {
  const res = await getPromosConfig();
  return (
    <PromosConfigClient
      initialConfig={res.ok ? res.config : DEFAULT_PROMOS}
      initialUpdatedAt={res.ok ? res.updatedAt : null}
      initialSeeded={res.ok ? res.seeded : false}
      loadError={res.ok ? null : res.error}
    />
  );
}
