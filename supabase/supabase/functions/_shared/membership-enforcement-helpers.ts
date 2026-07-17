export type StrikeConsequence = "warning_retest" | "pause_30d" | "forfeit";

export function isPaidPlan(plan: string | null | undefined): boolean {
  return (plan ?? "free").toLowerCase() !== "free";
}

export function strikeConsequenceForCount(
  strikeNumber: number,
): StrikeConsequence {
  if (strikeNumber >= 3) return "forfeit";
  if (strikeNumber === 2) return "pause_30d";
  return "warning_retest";
}
