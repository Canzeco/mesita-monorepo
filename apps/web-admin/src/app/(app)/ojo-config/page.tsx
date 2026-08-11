import { getOjoConfig } from "./actions";
import { OJO_FALLBACK } from "./defaults";
import { OjoConfigClient } from "./OjoConfigClient";

// Ojo Config — the proof-verification engine's policy blob.
export const dynamic = "force-dynamic";

export default async function OjoConfigPage() {
  const res = await getOjoConfig();
  return (
    <OjoConfigClient
      initialConfig={res.ok ? res.config : OJO_FALLBACK}
      initialUpdatedAt={res.ok ? res.updatedAt : null}
      loadError={res.ok ? null : res.error}
    />
  );
}
