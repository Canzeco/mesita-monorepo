// Status — the six facts that say where a place stands (MESITA-1171 · MESITA-1186).
// Renamed from `pulse` 2026-08-22: PULSE now names the enrichment pipeline.
//
//   seeded      a google_place_id exists — the identity spine every enrichment
//               run starts from. Without it nothing can be gathered.
//   listed      a guest can reach the place at all. projects.status is what the
//               consumer RLS policy gates on.
//   enriched    HOW FAR the Enricher got — a 0-3 LEVEL off place_research,
//               never a boolean.
//   verified    an approved project_verifications row (ownership proof).
//   partner     plan != free — the place pays Mesita.
//   promoting   a live discount right now (place-promoting.ts).
//
// The first three live here because two surfaces read them — admin-web-search-
// places (the Single Unit table) and business-web-get-overview (the Status box
// in the place editor) — and a status column that disagrees with itself across
// two screens is worse than no status column. The last three are one-liners the
// callers already own.

/** The place_research facts the enrich level is read from. Callers select
 *  `stage, gathered, analysis` and pass PRESENCE (`gathered != null`), never
 *  the payloads — those are tens of KB of JSON. */
export type ResearchFacts = {
  stage?: string | null;
  gathered?: boolean;
  analysis?: boolean;
} | null | undefined;

/** google_place_id present — the identity spine every run starts from. */
export function isPlaceSeeded(googlePlaceId: unknown): boolean {
  return typeof googlePlaceId === "string" && googlePlaceId.trim() !== "";
}

/**
 * A consumer can reach this place at all.
 *
 * This restates the RLS policy `projects_select_public_visible`:
 *   status IN (active, lead) AND content_status IN (ready, generating, queued, failed)
 * The content_status leg is a TAUTOLOGY — those are all four labels of the
 * enum — so `status` alone decides, and only `status` is checked here.
 *
 * CONFIRMED against the live DB 2026-08-22 (MESITA-1199), and it rests on two
 * facts that are NOT self-evident from this file:
 *   • content_status has exactly the labels {queued, generating, ready, failed}
 *   • the column is NOT NULL, default 'queued'
 * Both matter. Nullability is not decoration here: `col = ANY(...)` yields NULL
 * rather than true for a NULL column, so a nullable content_status would make
 * the leg load-bearing again and this function wrong in the unsafe direction.
 * ADDING A LABEL TO content_status SILENTLY BREAKS THIS — the policy would then
 * exclude rows that `status` alone still calls listed. If you add one, either
 * add it to the policy or check content_status here.
 *
 * Not to be confused with `listing_type`, which is a commercial tier, nor with
 * the discovery pool: _shared/place-pool.ts is stricter still (status='active'
 * only), so a `lead` place is reachable by link and search but never pooled for
 * Memo's RAG leg.
 */
export const LISTED_STATUSES: readonly string[] = ["active", "lead"];

export function isPlaceListed(status: unknown): boolean {
  return typeof status === "string" && LISTED_STATUSES.includes(status);
}

/**
 * 0 seeded only · 1 research gathered · 2 images analysed · 3 persisted.
 *
 * Presence of gathered/analysis decides it, not `stage` alone: a hard failure
 * parks the row at stage='failed' (failResearchRow) with whatever payloads had
 * already landed, and the level must still report how far it got.
 */
export function placeEnrichLevel(
  research: ResearchFacts,
  contentStatus: string | null,
): 0 | 1 | 2 | 3 {
  if (!research || contentStatus === "queued") return 0;
  if (research.stage === "done") return 3;
  if (research.analysis) return 2;
  if (research.gathered) return 1;
  return 0;
}
