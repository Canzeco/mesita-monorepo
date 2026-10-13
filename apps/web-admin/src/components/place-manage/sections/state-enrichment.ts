import {
  CRENUP_STEPS,
  crenupStepLabel,
  enrichmentStepLabel,
  type CrenupFlow,
  type CrenupStepKey,
} from "@/lib/state-vocabulary";

export type EnrichFunctionState = {
  state: "pending" | "completed" | "failed";
  at: string | null;
  detail: string | null;
};

export type CrenupStepRow = {
  key: CrenupStepKey;
  n: number;
  label: string;
  /** Called or not — `"unknown"` when we have no map to read at all. */
  on: boolean | "unknown";
  /** It RAN and could not do its job. `on` is still true: the function was
   *  called, which is what this ladder reports. The distinction matters to a
   *  matrix cell, which can show why, and not to the single-place box, which
   *  only asks whether the pipeline reached this rung. */
  failed: boolean;
  /** Which run shapes call this function. Create is 0 · 1 · 7 · 8. */
  flows: readonly CrenupFlow[];
};

function called(state: EnrichFunctionState["state"] | undefined): boolean {
  return state === "completed" || state === "failed";
}

function functionState(
  functions: Record<string, EnrichFunctionState> | null | undefined,
  key: string,
): EnrichFunctionState["state"] | undefined {
  const own = functions?.[key]?.state;
  if (own) return own;
  // Function 10 was renamed `semantic` → `embedding` (§8.4). Stored blobs
  // stamped before the rename still say `semantic` — fold, never rewrite.
  if (key === "embedding") return functions?.semantic?.state;
  return undefined;
}

/**
 * The nine functions — 0. Seed … 8. Embedding — each called or not. Same
 * keys as the ladder, never a second one. Enrichment Steps filters this to
 * the Enrich pass (1–8) and renames each row.
 *
 * THREE ANSWERS, NOT TWO (MESITA-1608). A missing map and a map that says a
 * function has not run are different facts, and the console list renders them
 * differently: `?` for "we were not told" (the pool withholds the map, and a
 * deploy can briefly serve a payload without it) versus `no` for "the pipeline
 * has not reached this rung". Collapsing the first into the second states
 * something we never read. `seeded` carries its own unknown for the same
 * reason — Seed is derived from google_place_id, not from a pipeline stamp.
 */
export function crenupStepRows(
  functions: Record<string, EnrichFunctionState> | null | undefined,
  seeded: boolean | "unknown",
): CrenupStepRow[] {
  const noMap = functions == null;
  return CRENUP_STEPS.map((def) => {
    if (def.key === "seed") {
      return {
        key: def.key,
        n: def.n,
        label: crenupStepLabel(def.n, def.label),
        on: seeded === "unknown" ? ("unknown" as const) : seeded === true,
        failed: false,
        flows: def.flows,
      };
    }
    const state = functionState(functions, def.key);
    return {
      key: def.key,
      n: def.n,
      label: crenupStepLabel(def.n, def.label),
      on: noMap ? ("unknown" as const) : called(state),
      failed: state === "failed",
      flows: def.flows,
    };
  });
}

/**
 * Enrichment Steps: the Enrich pass only, 1. Details Enriched …
 * 8. Embedding Enriched. Seed is Create-only and stays off this list.
 */
export function enrichmentStepRows(
  functions: Record<string, EnrichFunctionState> | null | undefined,
  seeded: boolean | "unknown",
): CrenupStepRow[] {
  return crenupStepRows(functions, seeded)
    .filter((row) => row.flows.includes("enrich"))
    .map((row) => {
      const name = CRENUP_STEPS.find((step) => step.key === row.key)?.label ?? row.key;
      return { ...row, label: enrichmentStepLabel(row.n, name) };
    });
}

/**
 * "1 of 8, stopped at Serp (missing)." — the completeness meter off the
 * server's high-water and its stop reason. Null when the payload carries
 * no number (an older payload), so the line is left out rather than guessed.
 * The banned umbrella word never reaches the screen.
 */
export function crenupMeterLine(place: {
  enrich_crenup?: number;
  enrich_crenup_total?: number;
  enrich_crenup_labels?: string[];
  enrich_crenup_blocked?: { key: string; index: number; state: string } | null;
}): string | null {
  const n = typeof place.enrich_crenup === "number" ? place.enrich_crenup : null;
  const total = typeof place.enrich_crenup_total === "number"
    ? place.enrich_crenup_total
    : null;
  if (n === null || total === null || total === 0) return null;
  const blocked = place.enrich_crenup_blocked ?? null;
  if (!blocked) return `${n} of ${total}.`;
  const label = place.enrich_crenup_labels?.[blocked.index] ?? blocked.key;
  return `${n} of ${total}, stopped at ${label} (${blocked.state}).`;
}
