import { getAtlasSettings } from "../actions";
import { AtlasSettingsError } from "@/components/AtlasSettingsError";
import { EnrichmentTriggersClient } from "../TriggersClient";

// Enricher Config · Triggers — the trigger x subprocess matrix. Which event
// re-runs which part of the pipeline, and how often it is allowed to.
export const dynamic = "force-dynamic";

export default async function EnrichmentTriggersPage() {
  const result = await getAtlasSettings();
  if (!result.ok) return <AtlasSettingsError error={result.error} />;

  return (
    <EnrichmentTriggersClient
      initialConfig={result.data.enrichmentTriggers}
      meta={result.data.enrichmentTriggersMeta}
    />
  );
}
