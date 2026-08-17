import { getFiltersConfig } from "../actions";
import { GeneralConfigClient } from "../GeneralConfigClient";
import { DEFAULT_FILTERS } from "../filters";

// Filters Config · General — the law the six surface tabs inherit. Server-seeds
// like the other blob editors so a failed GET surfaces as loadError and Save
// stays blocked (MESITA-737) — never silently write code defaults over the
// live singleton.
export const dynamic = "force-dynamic";

export default async function FiltersGeneralPage() {
  const res = await getFiltersConfig();
  return (
    <GeneralConfigClient
      initialConfig={res.ok ? res.config : DEFAULT_FILTERS}
      initialUpdatedAt={res.ok ? res.updatedAt : null}
      initialSeeded={res.ok ? res.seeded : false}
      loadError={res.ok ? null : res.error}
    />
  );
}
