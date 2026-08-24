import { getVisitsConfig } from "./actions";
import { VisitsConfigClient } from "./VisitsConfigClient";
import { VISITS_FALLBACK } from "./defaults";

// Visits — three boxes of knobs THE TICKET actually reads (Bill · Sync ·
// Report). Unwired keys stay in the blob and off the HTML.
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
