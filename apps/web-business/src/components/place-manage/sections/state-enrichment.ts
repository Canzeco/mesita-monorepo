import {
  INTAKE_FUNCTIONS,
  intakeFunctionLabel,
  type IntakeFunctionKey,
} from "@/lib/state-vocabulary";

export type EnrichFunctionState = {
  state: "pending" | "completed" | "failed";
  at: string | null;
  detail: string | null;
};

export type IntakeFunctionRow = {
  key: IntakeFunctionKey;
  n: number;
  label: string;
  /** Called or not — `"unknown"` when we have no map to read at all. */
  on: boolean | "unknown";
  /** It RAN and could not do its job. `on` is still true: the function was
   *  called, which is what this ladder reports. The distinction matters to a
   *  matrix cell, which can show why, and not to the single-place box, which
   *  only asks whether the pipeline reached this rung. */
  failed: boolean;
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
 * The eleven Intake functions the Intake box mentions — 0. Seed … 10. Embedding
 * — each called or not. Same keys as Intake, never a second ladder.
 *
 * THREE ANSWERS, NOT TWO (MESITA-1608). A missing map and a map that says a
 * function has not run are different facts, and the console list renders them
 * differently: `?` for "we were not told" (the pool withholds the map, and a
 * deploy can briefly serve a payload without it) versus `no` for "the pipeline
 * has not reached this rung". Collapsing the first into the second states
 * something we never read. `seeded` carries its own unknown for the same
 * reason — Seed is derived from google_place_id, not from a pipeline stamp.
 */
export function intakeFunctionRows(
  functions: Record<string, EnrichFunctionState> | null | undefined,
  seeded: boolean | "unknown",
): IntakeFunctionRow[] {
  const noMap = functions == null;
  return INTAKE_FUNCTIONS.map((def) => {
    if (def.key === "seed") {
      return {
        key: def.key,
        n: def.n,
        label: intakeFunctionLabel(def.n, def.label),
        on: seeded === "unknown" ? ("unknown" as const) : seeded === true,
        failed: false,
      };
    }
    const state = functionState(functions, def.key);
    return {
      key: def.key,
      n: def.n,
      label: intakeFunctionLabel(def.n, def.label),
      on: noMap ? ("unknown" as const) : called(state),
      failed: state === "failed",
    };
  });
}
