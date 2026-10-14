import { GoogleSourceCards } from "../GoogleSourceCards";
import { MesitaSourceCards } from "../MesitaSourceCards";
import { getDiscoveryConfig } from "../actions";
import { DEFAULT_CONFIG } from "../catalog";

// Search Sources — the seven searches: three Google Places, three Mesita
// Places (Name · Nearby · Catalog), one Mesita Social Catalog.
// SEVEN BOXES AND NOTHING ELSE (Pato, 2026-10-13). Browse and Flexible are
// gone. Every quality floor now lives INSIDE the source it cuts, so the
// standalone floor cards are gone.
// One box owns each key and the rest mirror it read-only — see SourceFloor.
// The family switches are not a source. They live on Configurations ›
// Families (MESITA-2200): a shared battery, so they do not spend one of
// the seven.
//
// Signals moved to the Matrix subpage (MESITA-1675): they rank what a
// source returns, which is not the same question as which sources exist.
//
// THE PAGE IS SEARCH SOURCES (Pato, 2026-09-02). Every one of the seven is a
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
      <GoogleSourceCards seed={seed} />
      <MesitaSourceCards seed={seed} />
    </div>
  );
}
