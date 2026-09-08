import { SuperCategoriesClient } from "../SuperCategoriesClient";
import { GoogleSourceCards } from "../GoogleSourceCards";
import { MesitaSourceCards } from "../MesitaSourceCards";
import { getDiscoveryConfig } from "../actions";
import { DEFAULT_CONFIG } from "../catalog";

// Search Sources — the nine searches: three Google Places, four Mesita
// Places, two Mesita Social, after the shared Super Categories strip.
// NINE BOXES AND NOTHING ELSE (Pato, 2026-09-08). Every quality floor now
// lives INSIDE the source it cuts, so the standalone floor cards are gone.
// One box owns each key and the rest mirror it read-only — see SourceFloor.
// The Super Categories strip stays a header above the three Google boxes: it
// is a shared battery, not a source, so it does not spend one of the nine.
//
// Signals moved to the Matrix subpage (MESITA-1675): they rank what a
// source returns, which is not the same question as which sources exist.
// The Super Categories strip is not a Source either. It used to be called
// `GeneralConfigClient`, which shared a name with the General box on Modes —
// the post-Google wipe, a different thing entirely (MESITA-1695).
//
// THE PAGE IS SEARCH SOURCES (Pato, 2026-09-02). Every one of the nine is a
// search, which is what the matrix band already called this set.
// The route stays /sources: the entity is Source, the page label says what
// kind. Modes stays Discovery Modes — a mode is a surface, not a search.
export const dynamic = "force-dynamic";

export default async function SearchSourcesPage() {
  const r = await getDiscoveryConfig();
  const initialConfig = r.ok ? r.config : DEFAULT_CONFIG;
  const initialUpdatedAt = r.ok ? r.updatedAt : null;
  const loadError = r.ok ? null : r.error;
  const seed = { initialConfig, initialUpdatedAt, loadError };
  return (
    <div className="flex flex-col gap-10">
      <SuperCategoriesClient
        initialConfig={initialConfig}
        initialUpdatedAt={initialUpdatedAt}
        loadError={loadError}
      />
      <GoogleSourceCards seed={seed} />
      <MesitaSourceCards seed={seed} />
    </div>
  );
}
