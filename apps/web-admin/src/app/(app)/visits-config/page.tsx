import { getVisitsConfig } from "./actions";
import { VISITS_FALLBACK } from "./defaults";
import { VisitsConfigClient } from "./VisitsConfigClient";

// Visits Config — the local context's policy blob.
export const dynamic = "force-dynamic";

export default async function VisitsConfigPage() {
  const res = await getVisitsConfig();
  return (
    <VisitsConfigClient
      initialConfig={res.ok ? res.config : VISITS_FALLBACK}
      initialUpdatedAt={res.ok ? res.updatedAt : null}
      loadError={res.ok ? null : res.error}
    />
  );
}
