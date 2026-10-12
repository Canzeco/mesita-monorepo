// State — the facts that say where a place stands (MESITA-1171 · MESITA-1186 · MESITA-1323).
// Renamed from `pulse` 2026-08-22. Since MESITA-2028 the ladder is CRENUP
// and `pulse` names only the liveness subprocess inside step 1.
//
//   seeded      a google_place_id exists — the identity spine every enrichment
//               run starts from. Without it nothing can be gathered.
//   listed      a guest can reach the place at all. projects.state is what the
//               consumer RLS policy gates on.
//   enriched    an Enrich run completed — `places.enriched_at` is set
//               (MESITA-2154). Create never stamps it, so a Created place
//               (content_state ready, enriched_at null) is NOT enriched.
//               HOW FAR the CRENUP queue got is a separate meter — the 0-8
//               high-water off place_enrichment_events, owned by
//               `crenupHighWater` in crenup-ladder.ts. The meter is
//               completeness, never the yes/no.
//
// Seeded and listed live here because two surfaces read them — admin-web-search-
// places (the Single Place table) and admin-web-get-overview (the State box
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
 * `lead` is dead (MESITA-2144): no writer sends it and no row carries it, so
 * only `active` counts here even while the policy still names it. The
 * profiles-view migration rebuilds the policy as `state = 'active'`.
 */
export const LISTED_STATES: readonly string[] = ["active"];

export function isPlaceListed(state: unknown): boolean {
  return typeof state === "string" && LISTED_STATES.includes(state);
}

/**
 * Requested is guest demand for Enricher — never a projects.state
 * label.
 *
 * Derived: request_count > 0 and not Enriched. Enriched is
 * `places.enriched_at` alone. Create stamps content_state ready with
 * enriched_at null — those rows can still be requested. `enrichedAt` is
 * required: a caller that forgets to select the column must not have
 * `ready` read as Enriched (MESITA-2154 deleted that fallback).
 */
export function isPlaceRequested(input: {
  requestCount?: unknown;
  enrichedAt: unknown;
}): boolean {
  if (isPlaceEnriched(input.enrichedAt)) return false;
  const count = Number(input.requestCount);
  return Number.isFinite(count) && count > 0;
}

/**
 * THE Enriched fact (MESITA-2154): an Enrich run completed, i.e. the
 * contents stage stamped `places.enriched_at`. Every reader — the consumer
 * wire `enriched`, Discovery's filter and signal, admin Status — asks this
 * one question. `content_state = 'ready'` is NOT enrichment: Create saves
 * `ready` because the profile can be shown.
 */
export function isPlaceEnriched(enrichedAt: unknown): boolean {
  return typeof enrichedAt === "string" && enrichedAt.trim() !== "";
}

/** Enricher pipeline mid-flight. content_state generating covers the
 *  whole run after MESITA-453 (re-enrich flips the column; never clear after
 *  research alone). Stage research|analysis|contents is the other half, read
 *  by admin-web-get-place-enrichment — notifications only have this column.
 *  `queued` is dead (MESITA-2144): no writer has sent it since the async
 *  create landed on 'generating'. */
export function isPlaceEnriching(contentState: unknown): boolean {
  return contentState === "generating";
}

/**
 * Usable Mesita profile — the profile can be shown. Create saves ready, and
 * the contents stage flips back to ready after an Enrich run. Ready is NOT
 * Enriched (see {@link isPlaceEnriched}); it gates Reserve and
 * `is_profile_ready`.
 */
export function isPlaceProfileReady(contentState: unknown): boolean {
  return contentState === "ready";
}
