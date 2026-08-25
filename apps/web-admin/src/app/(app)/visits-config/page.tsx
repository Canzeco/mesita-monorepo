import { getVisitsConfig } from "./actions";
import { VisitsConfigClient } from "./VisitsConfigClient";
import { VISITS_FALLBACK } from "./defaults";
import { getOjoConfig } from "../ojo-config/actions";
import { OjoConfigClient } from "../ojo-config/OjoConfigClient";
import { OJO_FALLBACK } from "../ojo-config/defaults";

// Visits — three boxes THE TICKET reads (Bill · Sync · Report) plus Ojo,
// who reads the proof. Two blobs, two Saves: visits_config and ojo_config.
// Unwired visits keys stay in that blob and off the HTML. A rename of the
// Ojo *label* never moves the column or the admin-web-*-ojo-config EFs.
export const dynamic = "force-dynamic";

export default async function VisitsConfigPage() {
  const [visits, ojo] = await Promise.all([
    getVisitsConfig(),
    getOjoConfig(),
  ]);
  return (
    <div className="flex flex-col gap-10">
      <VisitsConfigClient
        initialConfig={visits.ok ? visits.config : VISITS_FALLBACK}
        initialUpdatedAt={visits.ok ? visits.updatedAt : null}
        loadError={visits.ok ? null : visits.error}
      />
      <OjoConfigClient
        initialConfig={ojo.ok ? ojo.config : OJO_FALLBACK}
        initialUpdatedAt={ojo.ok ? ojo.updatedAt : null}
        loadError={ojo.ok ? null : ojo.error}
      />
    </div>
  );
}
