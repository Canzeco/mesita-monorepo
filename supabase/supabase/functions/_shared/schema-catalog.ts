// The sub-schema catalog (MESITA-1247, "Mesita as documents" §C).
//
// Recurring shapes, defined ONCE and composed into the aggregate validators
// this issue's follow-ups build (MESITA-1248-1251). This file does not
// change how anything is written today — it names shapes that already exist
// scattered across the codebase, so the validators that come next compose
// them instead of re-typing them per aggregate.
//
// The enrichment ladder's key set is ALREADY-LAW code (crenup-ladder.ts), on
// purpose: reinventing it here would be exactly the kind of
// duplicate-source-of-truth this catalog exists to prevent. Import the real
// thing; do not re-type it.

import {
  CRENUP_EXTRA_ALIASES,
  CRENUP_LADDER,
  CRENUP_TOTAL,
  crenupBlockedAt,
  crenupHighWater,
  type CrenupBlock,
  type CrenupEvent,
  type CrenupStep,
} from "./crenup-ladder.ts";
import { enumOf, nullable, num, object, refine, str, type Schema } from "./doc-schema.ts";

// ── FunctionState ────────────────────────────────────────────────────────
//
// "{state, at, detail} x 10 enrichment functions" — the 10 is not a round
// number, it is CRENUP_LADDER.length (Pulse through Embedding), the exact
// closed set crenup-ladder.ts already defines and crenup-report.ts already
// writes through StampableCrenupStep. FunctionState formalizes the PER-STEP
// record that MESITA-1249 (materializing the enrichment state map onto the
// place) will need to store; today that state lives only in the append-only
// event log crenup-ladder.ts folds over. Defining the type here does not
// materialize anything — it gives 1249 a name to build against instead of
// inventing its own shape.
// KNOWN GAP (MESITA-1247 survey, deliberately left for MESITA-1249, which
// owns materializing this map): the DB event log's `started` and `skipped`
// statuses (place_enrichment_events.state CHECK) have no home in this
// three-value enum, and the write-side StepOutcome (crenup-report.ts) is
// narrower still (`completed | failed`, no `pending`). Whether `skipped`
// projects as `completed` (skipped but fine), needs a fourth state, or
// something else, is 1249's call — don't let it get decided by accident
// when this map's first real writer lands. `detail` being nullable here
// while StepOutcome.detail is not is correct as designed, not a bug: this
// type has to represent `pending` (never run, no detail to report), a state
// StepOutcome structurally cannot hold since a piece that hasn't run never
// gets a StepOutcome written at all.
export type FunctionState = {
  state: "pending" | "completed" | "failed";
  /** ISO timestamp of the latest event for this step, or null if never run. */
  at: string | null;
  detail: string | null;
};

/** The closed key set FunctionState is indexed by — every CRENUP step, no other. */
export type FunctionStateMap = Partial<Record<CrenupStep, FunctionState>>;

/**
 * The closed set of keys FunctionState may be indexed by, re-derived from
 * crenup-ladder.ts rather than hand-typed — the same derivation discipline
 * CRENUP_STEP_META already enforces (MESITA-1222: an index written down
 * beside its source drifts; one derived from it cannot).
 */
export const FUNCTION_STATE_KEYS: readonly CrenupStep[] = CRENUP_LADDER;

export const FunctionStateSchema: Schema<FunctionState> = object({
  state: enumOf(["pending", "completed", "failed"] as const),
  at: nullable(str()),
  detail: nullable(str()),
});

/**
 * A `FunctionStateMap` is a PARTIAL record — most place_profiles have not run every
 * one of the 10 steps yet, and an absent key means exactly that, not
 * `{state:"pending",...}`. `object()` iterates every key of its shape
 * regardless of presence, which is the right behavior for a fixed-shape
 * document (place-doc.ts's own PlaceProfilePatch keys) but wrong here: a place
 * that has only run `pulse` must round-trip as `{pulse: {...}}`, not as
 * all 10 keys with 9 fabricated `pending` entries. Bespoke, small, and
 * kept local rather than promoted into doc-schema.ts's core until a SECOND
 * partial-record shape needs it too.
 */
const FUNCTION_STATE_PARSE_KEYS: readonly string[] = [
  ...FUNCTION_STATE_KEYS,
  ...CRENUP_EXTRA_ALIASES,
];

function laterAt(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

function foldSemanticPair(
  name: FunctionState | undefined,
  summary: FunctionState | undefined,
): FunctionState | undefined {
  const parts = [name, summary].filter((p): p is FunctionState => p != null);
  if (parts.length === 0) return undefined;
  const failed = parts.find((p) => p.state === "failed");
  const completed = parts.filter((p) => p.state === "completed");
  const at = parts.reduce<string | null>((acc, p) => laterAt(acc, p.at), null);
  if (failed) {
    return { state: "failed", at, detail: failed.detail };
  }
  if (completed.length > 0) {
    const detail = completed
      .map((p) => p.detail)
      .filter((d): d is string => typeof d === "string" && d.length > 0)
      .join(" · ") || null;
    return { state: "completed", at, detail };
  }
  return { state: "pending", at, detail: null };
}

/**
 * Pre-MESITA-1542 maps spell the per-function field `status`. The identifier
 * rename did not rewrite stored `place_profiles.enrichment` JSONB, so the fold
 * absorbs the old spelling on read — the same read-side absorption
 * CRENUP_RENAMES gives a renamed KEY. The next successful write
 * re-materializes the map in the new spelling.
 */
function foldLegacyStateSpelling(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return raw;
  const rec = raw as Record<string, unknown>;
  if ("state" in rec || !("status" in rec)) return raw;
  const { status: legacy, ...rest } = rec;
  return { ...rest, state: legacy };
}

/**
 * Fold legacy keys into `embedding`: the rename (`semantic`, the same
 * function 8 under its pre-§8.4-v3 name) and the pre-merge `name`/`summary`
 * extras. Precedence: a real `embedding` stamp wins, then `semantic`, then
 * the folded extras pair. Legacy `status`-spelled records fold first.
 */
export function foldFunctionStateMap(
  map: Partial<Record<string, FunctionState>>,
): FunctionStateMap {
  const norm: Partial<Record<string, FunctionState>> = {};
  for (const [key, rec] of Object.entries(map)) {
    if (rec) norm[key] = foldLegacyStateSpelling(rec) as FunctionState;
  }
  const embedding = norm.embedding ?? norm.semantic ??
    foldSemanticPair(norm.name, norm.summary);
  const out: FunctionStateMap = {};
  for (const key of CRENUP_LADDER) {
    const rec = norm[key];
    if (rec) out[key] = rec;
  }
  if (embedding) out.embedding = embedding;
  return out;
}


/**
 * The ten Enrich operator functions (1–10), every key present
 * so State can list them without inventing a second ladder.
 */
export function operatorFunctionStates(
  map: Partial<Record<string, FunctionState>>,
): Record<string, FunctionState> {
  const folded = foldFunctionStateMap(map);
  const out: Record<string, FunctionState> = {};
  for (const key of FUNCTION_STATE_KEYS) {
    out[key] = folded[key] ?? { state: "pending", at: null, detail: null };
  }
  return out;
}

export const FunctionStateMapSchema: Schema<FunctionStateMap> = {
  parse(raw) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return { ok: false, error: `expected object, got ${typeof raw}` };
    }
    const rawObj = raw as Record<string, unknown>;
    const unknownKeys = Object.keys(rawObj).filter(
      (k) => !FUNCTION_STATE_PARSE_KEYS.includes(k),
    );
    if (unknownKeys.length > 0) {
      return { ok: false, error: `unknown pulse step(s): ${unknownKeys.join(", ")}` };
    }
    const value: Record<string, FunctionState> = {};
    for (const key of Object.keys(rawObj)) {
      const r = FunctionStateSchema.parse(foldLegacyStateSpelling(rawObj[key]));
      if (!r.ok) return { ok: false, error: `${key}: ${r.error}` };
      value[key] = r.value;
    }
    return { ok: true, value: foldFunctionStateMap(value) };
  },
};

const PulseBlockSchema: Schema<CrenupBlock> = object({
  key: enumOf(CRENUP_LADDER),
  index: refine(num(), (v) => Number.isInteger(v) && v >= 1 && v <= CRENUP_TOTAL ? null : `index must be an integer between 1 and ${CRENUP_TOTAL}`),
  state: enumOf(["failed", "missing"] as const),
});

// ── The materialized enrichment state map (MESITA-1249) ────────────────────
//
// `place_profiles.enrichment`: the ONE-READ replacement for "RPC + fold over
// place_enrichment_events on every request" (admin-web-search-place_profiles,
// admin-web-get-overview). `functions`/`highWater`/`blockedAt` are the
// exact three values `crenupHighWater`/`crenupBlockedAt` already compute from
// the event log — this materializes their OUTPUT, kept current by
// crenup-report.ts's `reportCrenupSteps` merging into it on every write,
// instead of re-deriving it from scratch on every read.
//
// DELIBERATELY NOT in this shape: `everyDays`/`mode`/`nextAt`/`lastRunAt`
// (the schedule). The issue that named this map asked for those too, but
// `place_profiles.enrich_every_days`/`enrich_mode`/`enrich_next_at` are read AND
// WRITTEN directly by `queue_due_place_enrichments`, a live PL/pgSQL cron
// function — the exact class of change (a rename/restructure a stored
// function body doesn't auto-follow) that caused this repo's own documented
// 2-day enrichment outage (MESITA-1143). Folding the meter (a pure read-path
// win, zero cron risk) and folding the schedule (a real risk to a fragile
// live function) are two different shapes of change; this ships the first
// and leaves the second an explicit, separate decision. The three scalar
// columns are unchanged and still the source of truth for scheduling.
export type EnrichmentMap = {
  functions: FunctionStateMap;
  highWater: number;
  blockedAt: CrenupBlock | null;
};

export const EnrichmentMapSchema: Schema<EnrichmentMap> = object({
  functions: FunctionStateMapSchema,
  highWater: refine(num(), (v) => Number.isInteger(v) && v >= 0 && v <= CRENUP_TOTAL ? null : `highWater must be an integer between 0 and ${CRENUP_TOTAL}`),
  blockedAt: nullable(PulseBlockSchema),
});

/**
 * `crenupHighWater`/`crenupBlockedAt` (crenup-ladder.ts) walk a raw
 * `CrenupEvent[]` fetched fresh from `place_enrichment_events`. These two
 * walk the SAME logic over an already-materialized `FunctionStateMap`
 * instead, by converting the map back into the event shape those two
 * functions (and their 28 pinned tests) already handle — not a second walk
 * implementation to keep in sync by hand.
 */
function functionStateMapToEvents(map: FunctionStateMap): CrenupEvent[] {
  return CRENUP_LADDER.flatMap((piece) => {
    const rec = map[piece];
    if (!rec) return [];
    return [{ step_name: piece, state: rec.state, created_at: rec.at ?? "" }];
  });
}

export function crenupHighWaterFromMap(map: FunctionStateMap): number {
  return crenupHighWater(functionStateMapToEvents(map));
}

export function crenupBlockedAtFromMap(map: FunctionStateMap): CrenupBlock | null {
  return crenupBlockedAt(functionStateMapToEvents(map));
}

/**
 * Raw `place_enrichment_events.state` -> `FunctionState.state`. Only
 * needed for translating HISTORICAL event rows (the migration backfill) —
 * the live write path (crenup-report.ts) only ever produces `StepOutcome`,
 * whose state is already `"completed" | "failed"`, a strict subset of
 * `FunctionState.state`, so it never needs this mapping.
 *
 * `completed` stays itself. `started` (in-flight, no outcome yet) becomes
 * `pending`. Everything else — `failed`, the `skipped` a legacy row might
 * carry, or an unrecognized value — becomes `failed`. This is not a new
 * rule: it is `crenupBlockedAt`'s own documented one ("anything not
 * completed and not absent is the function having run and not delivered"),
 * applied here rather than invented — the decision this map's header
 * flagged as 1249's to make is "reuse the ladder's existing skipped-is-a-
 * form-of-failed rule", not a fresh one.
 */
export function toFunctionState(rawState: string): FunctionState["state"] {
  if (rawState === "completed") return "completed";
  if (rawState === "started") return "pending";
  return "failed";
}
