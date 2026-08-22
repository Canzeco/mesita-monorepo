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
//      able to reach 9. The piece ran, resolved "there is nothing here", and is
//      `completed`. Only a piece that had something to do and could not do it
//      fails. Callers must make that distinction explicitly — it is the one
//      place where a wrong call quietly punishes a place for a fact about the
//      world.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { reportEnrichmentStep } from "./enrich-pipeline.ts";
import { PULSE_PIECE_META, type PulsePiece } from "./pulse-pieces.ts";

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
 * `step_name` is the PIECE key and `step` its S-number, so the ladder's order
 * is carried by the row rather than inferred by the reader.
 */
export async function reportPulsePieces(
  admin: SupabaseClient,
  projectId: string,
  pieces: Partial<Record<string, PieceOutcome>>,
): Promise<void> {
  for (const [key, outcome] of Object.entries(pieces)) {
    if (!outcome) continue;
    const meta = PULSE_PIECE_META[key as PulsePiece];
    if (!meta) continue;
    await reportEnrichmentStep(
      admin,
      projectId,
      `S${meta.index}`,
      key,
      outcome.status,
      outcome.detail,
      { piece: key, index: meta.index, ...(outcome.meta ?? {}) },
    );
  }
}
