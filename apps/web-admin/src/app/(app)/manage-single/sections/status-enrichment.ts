import { chipsFor } from "../../enricher-config/intake-functions";

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

const ENRICH_CHIPS = chipsFor("enrich");

function stripChipPrefix(label: string): string {
  return label.replace(/^(?:\d+\s+|◇\s+)/, "");
}

/**
 * The ten Enrich subfunctions Status lists under Enriched — same keys as
 * Intake chips, never a second ladder.
 */
export function enrichFunctionRows(
  functions: Record<string, EnrichFunctionState> | null | undefined,
): EnrichFunctionRow[] {
  return ENRICH_CHIPS.map((chip) => {
    const key = chip.href.replace(/^#f-/, "");
    const rec = functions?.[key];
    return {
      key,
      label: stripChipPrefix(chip.label),
      status: rec?.status ?? "pending",
    };
  });
}
