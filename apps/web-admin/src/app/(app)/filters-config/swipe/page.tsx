import { getFiltersConfig } from "../actions";
import { SurfaceConfigClient } from "../SurfaceConfigClient";
import { DEFAULT_FILTERS } from "../filters";

// Filters Config · Swipe — one consumer surface. Same server-seed contract as
// General: a failed GET becomes loadError and Save stays blocked (MESITA-737).
export const dynamic = "force-dynamic";

export default async function FiltersSwipePage() {
  const res = await getFiltersConfig();
  return (
    <SurfaceConfigClient
      surfaceKey="swipe"
      initialConfig={res.ok ? res.config : DEFAULT_FILTERS}
      initialUpdatedAt={res.ok ? res.updatedAt : null}
      initialSeeded={res.ok ? res.seeded : false}
      loadError={res.ok ? null : res.error}
    />
  );
}
