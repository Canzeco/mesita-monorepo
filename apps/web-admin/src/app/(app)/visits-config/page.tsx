import { getVisitsConfig } from "./actions";
import { VisitsConfigClient } from "./VisitsConfigClient";
import { VISITS_FALLBACK } from "./defaults";
import { getOjoConfig } from "../ojo-config/actions";
import { OjoConfigClient } from "../ojo-config/OjoConfigClient";
import { OJO_FALLBACK } from "../ojo-config/defaults";
import { getPromosConfig } from "../rewards-config/actions";
import { PromosState } from "../rewards-config/PromosState";
import { DEFAULT_PROMOS } from "../rewards-config/promos";
import { VisitsRewardsForm } from "../rewards-config/VisitsRewardsForm";

// Visits — three boxes THE TICKET reads (Bill · Sync · Report), plus Visits
// Rewards (what it pays) and Ojo (who reads the proof). Three blobs, three
// Saves: visits_config, promos_config, ojo_config. Unwired visits keys stay
// in that blob and off the HTML. A rename of the Ojo or Rewards *label*
// never moves the column or the admin-web-*-{ojo,rewards}-config EFs.
export const dynamic = "force-dynamic";

export default async function VisitsConfigPage() {
  const [visits, ojo, promos] = await Promise.all([
    getVisitsConfig(),
    getOjoConfig(),
    getPromosConfig(),
  ]);
  return (
    <div className="flex flex-col gap-10">
      <VisitsConfigClient
        initialConfig={visits.ok ? visits.config : VISITS_FALLBACK}
        initialUpdatedAt={visits.ok ? visits.updatedAt : null}
        loadError={visits.ok ? null : visits.error}
      />
      <PromosState
        initialConfig={promos.ok ? promos.config : DEFAULT_PROMOS}
        initialUpdatedAt={promos.ok ? promos.updatedAt : null}
        initialSeeded={promos.ok ? promos.seeded : false}
        loadError={promos.ok ? null : promos.error}
      >
        <VisitsRewardsForm />
      </PromosState>
      <OjoConfigClient
        initialConfig={ojo.ok ? ojo.config : OJO_FALLBACK}
        initialUpdatedAt={ojo.ok ? ojo.updatedAt : null}
        loadError={ojo.ok ? null : ojo.error}
      />
    </div>
  );
}
