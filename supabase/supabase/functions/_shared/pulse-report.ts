// Writing PULSE piece outcomes (MESITA-1172).
//
// The read side is pulse-pieces.ts; this is how a stage stamps one. It replaces
// enrich-subprocess-report.ts, which recorded the SUBPROCESS vocabulary — that
// is what a run may buy, not what an operator is told. Pieces are the operator's
// ladder, and the meter reads how far it got.
//
// THE RULES, all of them load-bearing:
//
//   1. A stage reports ONCE, at its end, from outcomes it already observed —
//      never a beacon at each success line. These functions spend real money
//      and every added statement is a chance to change control flow.
//
//   2. `completed` means THE EFFECT LANDED. Development Rules say to judge
//      enrichment by DB effects and never by green beacons, so every caller
//      passes an observed value (`basics.hours`, a `sources.X.ok`, a persisted
//      description). A literal `true` here rebuilds the exact failure mode that
//      warning exists for — it already happened once in review, when a draft
//      read `sources.discovery.ok`, a HARDCODED flag meaning "attempted".
//
//   3. A piece this run did NOT BUY writes NOTHING. Not `skipped` — nothing.
//      The trigger matrix lets a cheap refresh buy a subset, so if a partial
//      run stamped the pieces it skipped, it would knock the high-water back
//      down to whatever that run happened to cover. Writing nothing lets the
//      previous run's result stand, so state accumulates instead of being reset
//      by the cheapest run that touched the place (MESITA-1172 blocker 2).
//
//   4. ABSENCE IS A RESULT, NOT A FAILURE. A place with no Instagram must be
//      able to reach 9. The function ran, resolved "there is nothing here", and
//      is `completed`. Only a function that had something to do and could not
//      do it fails. Callers must make that distinction explicitly — it is the
//      one place where a wrong call quietly punishes a place for a fact about
//      the world.
//
//   5. THE FLOOR CANNOT BE STAMPED. `seed` is function 0 and the type below
//      excludes it, because the row EXISTING is the seed — there is no effect
//      to observe. A seed beacon would also break every place created before
//      it: no seed event, the walk stops at 0, and the whole catalog reads 0
//      forever. Silently, since these writes swallow their own errors.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { reportEnrichmentStep } from "./enrich-pipeline.ts";
import {
  PULSE_EXTRA_LABELS,
  PULSE_FLOOR,
  PULSE_PIECE_META,
  type PulsePiece,
  type PulseStep,
} from "./pulse-pieces.ts";

/**
 * What a stage may stamp: any function EXCEPT the floor (rule 5).
 *
 * Excluded in the type rather than checked at runtime, so `seed:` fails to
 * compile instead of failing silently at 3am.
 */
export type StampablePulseStep = Exclude<PulseStep, typeof PULSE_FLOOR>;

export type PieceOutcome = {
  status: "completed" | "failed";
  detail: string;
  meta?: Record<string, unknown>;
};

/** The effect landed. */
export function pieceDone(
  detail: string,
  meta?: Record<string, unknown>,
): PieceOutcome {
  return { status: "completed", detail, meta };
}

/** It had something to do and could not do it. NOT for absence — see rule 4. */
export function pieceFailed(
  detail: string,
  meta?: Record<string, unknown>,
): PieceOutcome {
  return { status: "failed", detail, meta };
}

/**
 * Stamp one stage's pieces. Best-effort by construction: reportEnrichmentStep
 * swallows its own errors, so a logging failure can never fail a run that
 * already did the work.
 *
 * `step_name` is the FUNCTION key and `step` its S-number. The reader matches
 * on the KEY and treats the number as decorative, which is what makes a
 * renumbering survivable — see pulse-pieces.ts.
 */
export async function reportPulsePieces(
  admin: SupabaseClient,
  projectId: string,
  //   6. THE KEY IS `StampablePulseStep`, NOT `string`. A misspelled key used to
  //      compile, write nothing, and cap the ladder at the rung before it — with
  //      the run reporting success. `socail` for `social` pinned every place at
  //      3 and nothing in the type system, the tests or CI said a word
  //      (MESITA-1219). The runtime guards below stay as the belt.
  //   7. THE SEMANTIC FUNCTIONS ARE STAMPED HERE TOO, and marked `SX` rather
  //      than given a rung. Name and Summary are real work with real outcomes,
  //      but counting either would make `enriched` fall when someone edits a
  //      name — the On-Update path fires the same machinery (MESITA-1243).
  pieces: Partial<Record<StampablePulseStep, PieceOutcome>>,
): Promise<void> {
  for (const [key, outcome] of Object.entries(pieces)) {
    if (!outcome) continue;
    // The belt for rule 5. The type already forbids the floor; this catches a
    // cast, a spread from a wider record, or a hand-built object.
    if (key === PULSE_FLOOR) continue;
    const meta = PULSE_PIECE_META[key as PulsePiece];
    const extraLabel = PULSE_EXTRA_LABELS[key as keyof typeof PULSE_EXTRA_LABELS];
    if (!meta && !extraLabel) continue;
    await reportEnrichmentStep(
      admin,
      projectId,
      meta ? `S${meta.index}` : "SX",
      key,
      outcome.status,
      outcome.detail,
      meta
        ? { piece: key, index: meta.index, ...(outcome.meta ?? {}) }
        : { piece: key, extra: true, ...(outcome.meta ?? {}) },
    );
  }
}
