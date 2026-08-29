import {
  INTAKE_FUNCTIONS,
  intakeFunctionLabel,
  type IntakeFunctionKey,
} from "@/lib/status-vocabulary";

export type EnrichFunctionState = {
  status: "pending" | "completed" | "failed";
  at: string | null;
  detail: string | null;
};

export type IntakeFunctionRow = {
  key: IntakeFunctionKey;
  n: number;
  label: string;
  on: boolean;
};

function called(status: EnrichFunctionState["status"] | undefined): boolean {
  return status === "completed" || status === "failed";
}

function functionCalled(
  functions: Record<string, EnrichFunctionState> | null | undefined,
  key: string,
): boolean {
  if (called(functions?.[key]?.status)) return true;
  // Function 10 was renamed `semantic` → `embedding` (§8.4). Stored blobs
  // stamped before the rename still say `semantic` — fold, never rewrite.
  if (key === "embedding") return called(functions?.semantic?.status);
  return false;
}

/**
 * The eleven Intake functions the Intake box mentions — 0. Seed … 10. Embedding
 * — each a bool: called or not. Same keys as Intake, never a second ladder.
 */
export function intakeFunctionRows(
  functions: Record<string, EnrichFunctionState> | null | undefined,
  seeded: boolean | "unknown",
): IntakeFunctionRow[] {
  return INTAKE_FUNCTIONS.map((def) => ({
    key: def.key,
    n: def.n,
    label: intakeFunctionLabel(def.n, def.label),
    on:
      def.key === "seed"
        ? seeded === true
        : functionCalled(functions, def.key),
  }));
}
