import { INTAKE_FUNCTIONS, type IntakeFunctionKey } from "@/lib/status-vocabulary";

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

/**
 * The eleven Intake functions Status mentions — 0 Seed … 10 Semantics —
 * each a bool: called or not. Same keys as Intake, never a second ladder.
 */
export function intakeFunctionRows(
  functions: Record<string, EnrichFunctionState> | null | undefined,
  seeded: boolean | "unknown",
): IntakeFunctionRow[] {
  return INTAKE_FUNCTIONS.map((def) => ({
    key: def.key,
    n: def.n,
    label: `${def.n} ${def.label}`,
    on:
      def.key === "seed"
        ? seeded === true
        : called(functions?.[def.key]?.status),
  }));
}
