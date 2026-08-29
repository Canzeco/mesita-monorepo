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
//      able to reach 10. The function ran, resolved "there is nothing here", and
//      is `completed`. Only a function that had something to do and could not
//      do it fails. Callers must make that distinction explicitly — it is the
//      one place where a wrong call quietly punishes a place for a fact about
//      the world.
//
//   5. SEED IS NEVER STAMPED — it is not an enrich function at all
//      (MESITA-1253: seed is step 1 of CREATE, and the row existing IS the
//      seed). It is not in PULSE_PIECES, so a `seed:` key fails to compile
//      and an unknown-string cast falls through the META/label check below
//      and writes nothing.
//
//   6. CREATE IS A CALLER OF THIS REPORTER TOO. The create function stamps
//      the enrich functions it ran inline (pulse, details), so a fresh place
//      reads 2/10 immediately and state accumulates across create and every
//      later run under one rule.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { reportEnrichmentStep } from "./enrich-pipeline.ts";
import {
  PULSE_PIECE_META,
  type PulsePiece,
  type PulseStep,
} from "./pulse-pieces.ts";
import {
  foldFunctionStateMap,
  pulseBlockedAtFromMap,
  pulseHighWaterFromMap,
  type EnrichmentMap,
  type FunctionStateMap,
} from "./schema-catalog.ts";
import { writePlace } from "./place-doc.ts";

/**
 * What a caller may stamp: any enrich function. `seed`
 * is not among them by construction — it left PULSE_PIECES in MESITA-1253 —
 * so the old floor-exclusion type collapsed into the union itself. The alias
 * survives because call sites read better naming what they hold.
 */
export type StampablePulseStep = PulseStep;

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
  //   7. THE KEY IS `StampablePulseStep`, NOT `string`. A misspelled key used to
  //      compile, write nothing, and cap the ladder at the rung before it — with
  //      the run reporting success. `socail` for `social` pinned every place at
  //      3 and nothing in the type system, the tests or CI said a word
  //      (MESITA-1219). The unknown-key check below stays as the belt.
  //   8. SEMANTICS IS FUNCTION 10. It stamps `S10` like every other
  //      enrich function. Create also stamps it; the high-water stays at 2
  //      until 3–9 land, because 10 cannot skip a gap.
  pieces: Partial<Record<StampablePulseStep, PieceOutcome>>,
): Promise<void> {
  const stamped: Partial<Record<StampablePulseStep, PieceOutcome>> = {};
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
    stamped[key as StampablePulseStep] = outcome;
  }
  if (Object.keys(stamped).length > 0) {
    await mergeEnrichmentMap(admin, projectId, stamped);
  }
}

/**
 * MESITA-1249: keep `places.enrichment` current alongside the event log this
 * function already writes. Read-merge-write rather than a blind overwrite —
 * `stamped` only carries the pieces THIS stage bought (rule 3 above: a piece
 * a run didn't buy writes nothing), so the merge must preserve every other
 * piece's prior state, the same accumulation rule the append-only event log
 * already gives every reader for free.
 *
 * Best-effort like `reportEnrichmentStep` itself: the event log (this
 * function's caller, just above) is still the durable source of truth, so a
 * failure here degrades the read-path shortcut, not correctness — the next
 * successful write self-heals it.
 */
async function mergeEnrichmentMap(
  admin: SupabaseClient,
  projectId: string,
  stamped: Partial<Record<StampablePulseStep, PieceOutcome>>,
): Promise<void> {
  const { data, error: readError } = await admin
    .from("places")
    .select("enrichment")
    .eq("id", projectId)
    .maybeSingle();
  if (readError) {
    console.error("[pulse-report] enrichment map read:", readError.message);
    return;
  }
  const current = (data?.enrichment as EnrichmentMap | null | undefined) ??
    { functions: {}, highWater: 0, blockedAt: null };
  // Fold legacy keys first (renamed `semantic` → `embedding`, pre-merge
  // extras) — recomputing over a raw legacy map would rewrite a stored 10
  // as blocked-at-Embedding the moment any other piece stamps.
  const functions: FunctionStateMap = foldFunctionStateMap(current.functions);
  const now = new Date().toISOString();
  for (const [key, outcome] of Object.entries(stamped)) {
    if (!outcome) continue;
    // outcome.status is "completed" | "failed" — already a valid
    // FunctionState.status, no translation needed (that mapping only
    // applies to raw historical event rows — see toFunctionStatus).
    functions[key as PulseStep] = {
      status: outcome.status,
      at: now,
      detail: outcome.detail,
    };
  }
  const next: EnrichmentMap = {
    functions,
    highWater: pulseHighWaterFromMap(functions),
    blockedAt: pulseBlockedAtFromMap(functions),
  };
  const res = await writePlace(admin, {
    table: "places",
    mode: "update",
    id: projectId,
    patch: { enrichment: next },
  });
  if (!res.ok) {
    console.error("[pulse-report] enrichment map write:", res.error);
  }
}
