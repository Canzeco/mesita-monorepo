import { GeneralConfigClient } from "../GeneralConfigClient";
import { GoogleSourceCards } from "../GoogleSourceCards";
import { MesitaSourceCards } from "../MesitaSourceCards";
import { SignalsConfigClient } from "../SignalsConfigClient";
import { getDiscoveryConfig } from "../actions";
import { DEFAULT_CONFIG } from "../catalog";

// Search Sources — nine boxes after the shared Google types strip: the
// three Google Places searches, the four Mesita Places searches, the two
// Mesita Social searches. Then the signals every Mesita source ranks with.
// Signals are not a Source, and neither is the Google types strip — its
// `GeneralConfigClient` shares a name with the General box on Modes, which
// is the post-Google wipe and a different thing entirely.
//
// THE PAGE IS SEARCH SOURCES (Pato, 2026-09-02). Every one of the nine is a
// search, which is what the matrix band on Modes already called this set.
// The route stays /sources: the entity is Source, the page label says what
// kind. Modes stays Discovery Modes — a mode is a surface, not a search.
export const dynamic = "force-dynamic";

export default async function SearchSourcesPage() {
  const seed = await getDiscoveryConfig();
  const initialConfig = seed.ok ? seed.config : DEFAULT_CONFIG;
  const initialUpdatedAt = seed.ok ? seed.updatedAt : null;
  const loadError = seed.ok ? null : seed.error;
  return (
    <div className="flex flex-col gap-10">
      <GeneralConfigClient
        initialConfig={initialConfig}
        initialUpdatedAt={initialUpdatedAt}
        loadError={loadError}
      />
      <GoogleSourceCards />
      <MesitaSourceCards />
      <SignalsConfigClient
        initialConfig={initialConfig}
        initialUpdatedAt={initialUpdatedAt}
        loadError={loadError}
      />
    </div>
  );
}
