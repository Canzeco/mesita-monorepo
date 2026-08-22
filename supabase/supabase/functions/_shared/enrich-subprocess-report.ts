// Per-subprocess completion reporting (MESITA-1200).
//
// The admin catalog used to show a 0-3 meter derived from `place_research.stage`
// — the coarse stage machine — while the pipeline actually runs NINE
// subprocesses. It could not show more, because nothing recorded which ones
// finished: `place_research.subprocesses` is what a run was ALLOWED TO BUY, and
// `gathered.sources` is keyed per SOURCE (`apify_google_reviews`, `discovery`,
// `name_sync`) rather than per subprocess, with `synthesis`/`photos`/
// `embedding` leaving no trace there at all.
//
// This writes that missing record into `place_enrichment_events`, which already
// existed with exactly the right shape — including a `skipped` status, which is
// the third state the meter needs. No migration.
//
// TWO RULES, both load-bearing:
//
//   1. A stage reports ONCE, at its end, from outcomes it has already observed.
//      It does NOT sprinkle beacons at each subprocess's success line. These
//      are money-spending functions and every added statement is a chance to
//      change control flow; one call reading local state at the end cannot.
//
//   2. `completed` means THE EFFECT LANDED, never "we reached this line".
//      Development Rules say to judge enrichment by DB effects and never by
//      green beacons — precisely because a beacon can claim success while
//      nothing was written. Basing a meter on beacons is only safe if every
//      `completed` is derived from the recorded outcome of the work (a
//      `sources.X.ok`, a persisted `description`, a non-null embedding write).
//      Callers below pass exactly that. Do not "simplify" one into a literal
//      `true` — that rebuilds the failure mode the warning exists for.
//
//      A REAL example, caught in review of this very change: research writes
//      `sources.discovery.ok = true` as a hardcoded literal whenever the
//      discovery block runs, so that flag means "attempted", not "resolved".
//      The first draft here read it and would have marked `links` complete for
//      a place where discovery found nothing. Not every `ok` in `sources` is an
//      outcome — check the assignment before trusting one.
//
// The three states, and why `skipped` must not be `failed`:
//   completed  bought, and the effect landed.
//   failed     bought, and it did not. Counts AGAINST the place.
//   skipped    never bought — the trigger matrix excluded it, or the place has
//              no such data to gather. Must NOT count against the place, or a
//              place with no Instagram could never read as fully enriched.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { reportEnrichmentStep } from "./enrich-pipeline.ts";
import { SUBPROCESS_META, type SubprocessKey } from "./enrich-triggers.ts";

export type SubprocessStatus = "completed" | "failed" | "skipped";

export type SubprocessOutcome = {
  status: SubprocessStatus;
  /** Human sentence for the events feed. */
  detail: string;
  meta?: Record<string, unknown>;
};

/**
 * Record one stage's subprocess outcomes. Best-effort by construction —
 * `reportEnrichmentStep` swallows its own errors, so a logging failure can
 * never fail an enrichment run that already did its work.
 *
 * `step_name` is the SUBPROCESS KEY, not a stage label: `step` alone is not
 * unique (reviews and serp are both S2), so the key is what the reader groups
 * by. Legacy rows written before this existed carry step_names like "gather"
 * and "publish" and are simply not subprocess keys, so a reader that filters to
 * the known keys ignores them without special-casing.
 */
export async function reportSubprocessOutcomes(
  admin: SupabaseClient,
  projectId: string,
  outcomes: Partial<Record<SubprocessKey, SubprocessOutcome>>,
): Promise<void> {
  for (const [key, outcome] of Object.entries(outcomes)) {
    if (!outcome) continue;
    const meta = SUBPROCESS_META[key as SubprocessKey];
    if (!meta) continue;
    await reportEnrichmentStep(
      admin,
      projectId,
      meta.step as `S${number}`,
      key,
      outcome.status,
      outcome.detail,
      { subprocess: key, ...(outcome.meta ?? {}) },
    );
  }
}

/**
 * The common shape: a subprocess the matrix did not buy.
 *
 * Kept as a helper so every stage words it the same way, and so the `skipped`
 * status is never reached by accident — it is the one status that removes a
 * subprocess from the denominator.
 */
export function notBought(what: string): SubprocessOutcome {
  return {
    status: "skipped",
    detail: `${what} — the trigger that queued this run did not buy it.`,
    meta: { reason: "subprocess_not_requested" },
  };
}

/**
 * Bought, but the effect cannot be confirmed — e.g. the provider key is absent,
 * or the source recorded `ok: false`.
 *
 * This is `failed`, NOT `skipped`, and the distinction is the point: the place
 * really is missing that data, so it must count against its progress. Calling
 * it skipped would let a place read as fully enriched while a subprocess it
 * paid for silently did nothing.
 */
export function didNotLand(what: string, why: string): SubprocessOutcome {
  return { status: "failed", detail: `${what} — ${why}`, meta: { reason: why } };
}
