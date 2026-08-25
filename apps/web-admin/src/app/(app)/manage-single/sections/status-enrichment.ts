import { chipsFor, type IntakeFlow } from "../../enricher-config/intake-functions";

export type EnrichFunctionState = {
  status: "pending" | "completed" | "failed";
  at: string | null;
  detail: string | null;
};

export type EnrichFunctionRow = {
  key: string;
  label: string;
  status: EnrichFunctionState["status"];
};

function rowsFor(
  flow: IntakeFlow,
  functions: Record<string, EnrichFunctionState> | null | undefined,
): EnrichFunctionRow[] {
  return chipsFor(flow).map((chip) => {
    const key = chip.href.replace(/^#f-/, "");
    const rec = functions?.[key];
    return {
      key,
      label: chip.label,
      status: rec?.status ?? "pending",
    };
  });
}

/**
 * Intake Create (1 Seed · 2 Pulse · 3 Details · 4 Semantic).
 * Seed is the row existing (`google_place_id`) — nothing stamps a `seed` event.
 * Pulse / Details / Semantic reuse the same function map Enrich reads.
 */
export function createFunctionRows(
  functions: Record<string, EnrichFunctionState> | null | undefined,
  seeded: boolean,
): EnrichFunctionRow[] {
  return rowsFor("create", functions).map((row) =>
    row.key === "seed"
      ? { ...row, status: seeded ? "completed" : "pending" }
      : row,
  );
}

/** Intake Enrich 1–10 — same keys as Intake chips, never a second ladder. */
export function enrichFunctionRows(
  functions: Record<string, EnrichFunctionState> | null | undefined,
): EnrichFunctionRow[] {
  return rowsFor("enrich", functions);
}
