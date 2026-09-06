// State — the facts that say where a place stands (MESITA-1171 · MESITA-1186 · MESITA-1323).
// Renamed from `pulse` 2026-08-22: PULSE now names the enrichment pipeline.
//
//   seeded      a google_place_id exists — the identity spine every enrichment
//               run starts from. Without it nothing can be gathered.
//   listed      a guest can reach the place at all. projects.state is what the
//               consumer RLS policy gates on.
//   enriched    HOW FAR the PULSE queue got — a 0-10 high-water off
//               place_enrichment_events, never a boolean. It does NOT live
//               here: `pulseHighWater` in pulse-pieces.ts owns it, beside the
//               ladder it counts. This file kept a rival 0-3 stage level until
//               MESITA-1218; two numbers for one fact disagreed on every row.
//   verified    an approved project_verifications row (ownership proof).
//   partner     plan != free — the place pays Mesita.
//   promoting   a live discount right now (place-promoting.ts).
//
// Seeded and listed live here because two surfaces read them — admin-web-search-
// places (the Single Place table) and business-web-get-overview (the State box
// in the place editor) — and a state column that disagrees with itself across
// two screens is worse than no state column. The rest are one-liners the
// callers already own.

/** google_place_id present — the identity spine every run starts from. */
export function isPlaceSeeded(googlePlaceId: unknown): boolean {
  return typeof googlePlaceId === "string" && googlePlaceId.trim() !== "";
}

/**
 * A consumer can reach this place at all.
 *
 * This restates the RLS policy `projects_select_public_visible`:
 *   state IN (active, lead) AND content_state IN (ready, generating, queued, failed)
 * The content_state leg is a TAUTOLOGY — those are all four labels of the
 * enum — so `state` alone decides, and only `state` is checked here.
 *
 * CONFIRMED against the live DB 2026-08-22 (MESITA-1199), and it rests on two
 * facts that are NOT self-evident from this file:
 *   • content_state has exactly the labels {queued, generating, ready, failed}
 *   • the column is NOT NULL, default 'queued'
 * Both matter. Nullability is not decoration here: `col = ANY(...)` yields NULL
 * rather than true for a NULL column, so a nullable content_state would make
 * the leg load-bearing again and this function wrong in the unsafe direction.
 * ADDING A LABEL TO content_state SILENTLY BREAKS THIS — the policy would then
 * exclude rows that `state` alone still calls listed. If you add one, either
 * add it to the policy or check content_state here.
 *
 * Not to be confused with `listing_type`, which is a commercial tier, nor with
 * the discovery pool: _shared/place-pool.ts is stricter still (state='active'
 * only), so a `lead` place is reachable by link and search but never pooled for
 * Memo's RAG leg.
 */
export const LISTED_STATES: readonly string[] = ["active", "lead"];

export function isPlaceListed(state: unknown): boolean {
  return typeof state === "string" && LISTED_STATES.includes(state);
}

/**
 * Requested is guest demand for Intaker — never a projects.state
 * label. pending_review / pending_verification stay on the enum and stay
 * unlisted; they are not this fact.
 *
 * Derived: request_count > 0 and not Enriched. Enriched is
 * `places.enriched_at` (Intaker finished). Create-without-enrich stamps
 * content_state ready with enriched_at null — those rows can still be
 * requested. When enrichedAt is omitted, ready still wins (legacy callers).
 */
export function isPlaceRequested(input: {
  requestCount?: unknown;
  contentState?: unknown;
  enrichedAt?: unknown;
}): boolean {
  if (isPlaceEnriched(input.enrichedAt)) return false;
  if (input.enrichedAt === undefined && isPlaceProfileReady(input.contentState)) {
    return false;
  }
  const count = Number(input.requestCount);
  return Number.isFinite(count) && count > 0;
}

/** Intaker finished — contents stamped places.enriched_at. */
export function isPlaceEnriched(enrichedAt: unknown): boolean {
  return typeof enrichedAt === "string" && enrichedAt.trim() !== "";
}

/** Intaker pipeline mid-flight. content_state generating/queued covers the
 *  whole run after MESITA-453 (re-enrich flips the column; never clear after
 *  research alone). Stage research|analysis|contents is the other half, read
 *  by admin-web-get-place-enrichment — notifications only have this column. */
export function isPlaceEnriching(contentState: unknown): boolean {
  return contentState === "generating" || contentState === "queued";
}

/**
 * Usable Mesita profile. Contents persist stamps content_state ready
 * (and enriched_at). Listed and Requested must not unlock Enriched-only
 * capabilities — Visit / Order / Reserve / the normal place modal.
 */
export function isPlaceProfileReady(contentState: unknown): boolean {
  return contentState === "ready";
}
