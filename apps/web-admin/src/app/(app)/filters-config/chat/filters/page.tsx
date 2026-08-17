import { getFiltersConfig } from "../../actions";
import { SurfaceConfigClient } from "../../SurfaceConfigClient";
import { DEFAULT_FILTERS } from "../../filters";

// Filters Config › Chat › Filters — the discovery filter knobs for the Chat
// surface. Same server-seed contract as every other surface tab.
export const dynamic = "force-dynamic";

export default async function ChatFiltersPage() {
  const res = await getFiltersConfig();
  return (
    <SurfaceConfigClient
      surfaceKey="chat"
      initialConfig={res.ok ? res.config : DEFAULT_FILTERS}
      initialUpdatedAt={res.ok ? res.updatedAt : null}
      initialSeeded={res.ok ? res.seeded : false}
      loadError={res.ok ? null : res.error}
    />
  );
}
