// Three-rung place plan ladder (MESITA-2020) — Free · Pro · Ultra.

export type PlacePlanTier = "free" | "pro" | "ultra";

const ORDER: Record<PlacePlanTier, number> = {
  free: 0,
  pro: 1,
  ultra: 2,
};

export function normalizePlacePlan(
  plan: string | null | undefined,
): PlacePlanTier {
  if (plan === "pro" || plan === "ultra") return plan;
  return "free";
}

export function planMeetsMin(
  actual: string | null | undefined,
  min: PlacePlanTier | null,
): boolean {
  if (!min || min === "free") return true;
  return ORDER[normalizePlacePlan(actual)] >= ORDER[min];
}

export function minPlanLockNote(min: PlacePlanTier): string {
  if (min === "pro") return "Needs Mesita Pro.";
  if (min === "ultra") return "Needs Mesita Ultra.";
  return "Needs a paid plan.";
}
