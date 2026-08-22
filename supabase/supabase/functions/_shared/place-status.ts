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

// ── enriched, as PROGRESS rather than a stage proxy (MESITA-1200) ───────────
//
// `placeEnrichLevel` above answers "which stage did the machine reach", 0-3.
// That was the most that could be said while nothing recorded per-subprocess
// outcomes. Now that the stage EFs report one event per subprocess, the honest
// answer is a fraction: how many of the subprocesses this place actually BOUGHT
// have landed.
//
// The denominator is PER-PLACE, never a constant 9. A place with no Instagram
// never buys `social`; a run queued as a cheap liveness refresh buys two or
// three. Against a fixed 9 both would read as permanently unfinished, which is
// worse than the coarse meter this replaces.

import { SUBPROCESS_KEYS, type SubprocessKey } from "./enrich-triggers.ts";

/** One row of place_enrichment_events, narrowed to what the count needs. */
export type SubprocessEvent = {
  step_name?: string | null;
  status?: string | null;
  created_at?: string | null;
};

export type EnrichProgress = {
  /** Subprocesses bought AND landed. */
  done: number;
  /** Subprocesses bought — skipped ones are not in here. */
  total: number;
};

const KNOWN = new Set<string>(SUBPROCESS_KEYS);

/**
 * Fold one place's events into progress, or null when this place has no
 * subprocess events at all (an older run, or one that never reported) — the
 * caller then falls back to the 0-3 stage level rather than showing 0/0.
 *
 * Events are an APPEND-ONLY LOG: a re-enrich appends a second row for the same
 * subprocess, so only the LATEST event per subprocess counts. Counting rows
 * would inflate a re-enriched place and could report done > total.
 */
export function placeEnrichProgress(
  events: readonly SubprocessEvent[],
): EnrichProgress | null {
  const latest = new Map<SubprocessKey, { status: string; at: string }>();

  for (const e of events) {
    const key = (e.step_name ?? "").trim();
    // Legacy rows carry stage labels ("gather", "publish") rather than
    // subprocess keys. They are not subprocesses, so they are not counted.
    if (!KNOWN.has(key)) continue;
    const status = (e.status ?? "").trim();
    const at = e.created_at ?? "";
    const prev = latest.get(key as SubprocessKey);
    if (!prev || at >= prev.at) latest.set(key as SubprocessKey, { status, at });
  }

  // SENTINEL: only trust the fold when this place has been through the
  // per-subprocess reporting at all.
  //
  // `google` is hard-locked on for every trigger (enrich-triggers lockedCell)
  // and is reported by every research run since MESITA-1200, so its presence
  // marks "these events describe subprocesses". Without this check a place
  // whose only legacy beacon happened to be named `images` — a real subprocess
  // key, unlike `gather`/`publish` — would fold to a confident 1/1 and read as
  // fully enriched off a single stage beacon. That is the live state of the one
  // enriched place in production today, which is how this was caught.
  if (!latest.has("google")) return null;

  let done = 0;
  let total = 0;
  for (const { status } of latest.values()) {
    // `skipped` leaves the denominator entirely — it was never bought.
    if (status === "skipped") continue;
    total += 1;
    if (status === "completed") done += 1;
  }

  return { done, total };
}
