import { GeneralConfigClient } from "../GeneralConfigClient";
import { GoogleQualityFloorCard } from "../GoogleQualityFloorCard";
import { GoogleSourceCards } from "../GoogleSourceCards";
import { MesitaSourceCards } from "../MesitaSourceCards";
import { PoolQualityFloorCard } from "../PoolQualityFloorCard";
import { SignalsConfigClient } from "../SignalsConfigClient";
import { getDiscoveryConfig } from "../actions";
import { DEFAULT_CONFIG } from "../catalog";

// Search Sources — nine boxes after the shared Google types strip: the
// three Google Places searches, the four Mesita Places searches, the two
// Mesita Social searches. Then the signals every Mesita source ranks with.
// Neither quality floor is a Source. The Google one is a proposal over what
// the three Google searches return, while General on Modes stays its live
// box; the Mesita pool one is LIVE and is the only knob `filters` has ever
// had (MESITA-1667). They are two halves of one question: what Google gave
// back, and what the listed pool offers on the lanes that never ask Google.
//
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
      <GoogleQualityFloorCard />
      <PoolQualityFloorCard
        initialConfig={initialConfig}
        initialUpdatedAt={initialUpdatedAt}
        loadError={loadError}
      />
      <MesitaSourceCards />
      <SignalsConfigClient
        initialConfig={initialConfig}
        initialUpdatedAt={initialUpdatedAt}
        loadError={loadError}
      />
    </div>
  );
}
