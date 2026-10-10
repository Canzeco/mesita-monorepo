// THE TOP OF THE LABEL (MESITA-2060).
//
// Four headline facts on a menu file. Blank means not estimated. A partial
// row is not a number the guest should see.

export type MenuNutrition = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type NutritionDraft = {
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
};

export const EMPTY_NUTRITION: NutritionDraft = {
  kcal: "",
  protein: "",
  carbs: "",
  fat: "",
};

function whole(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 20000) {
    return null;
  }
  return Math.round(v);
}

export function parseMenuNutrition(raw: unknown): MenuNutrition | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const kcal = whole(o.kcal);
  const proteinG = whole(o.proteinG);
  const carbsG = whole(o.carbsG);
  const fatG = whole(o.fatG);
  if (kcal == null || proteinG == null || carbsG == null || fatG == null) {
    return null;
  }
  return { kcal, proteinG, carbsG, fatG };
}

export function nutritionDraftFrom(raw: unknown): NutritionDraft {
  const n = parseMenuNutrition(raw);
  if (!n) return { ...EMPTY_NUTRITION };
  return {
    kcal: String(n.kcal),
    protein: String(n.proteinG),
    carbs: String(n.carbsG),
    fat: String(n.fatG),
  };
}

/** null = leave it off the row. "partial" = the operator started and did not finish. */
export function nutritionFromDraft(
  draft: NutritionDraft,
): { ok: true; value: MenuNutrition | null } | { ok: false } {
  const raw = [draft.kcal, draft.protein, draft.carbs, draft.fat].map((s) => s.trim());
  if (raw.every((s) => s === "")) return { ok: true, value: null };
  if (raw.some((s) => s === "")) return { ok: false };
  const nums = raw.map((s) => Number(s));
  if (
    nums.some((n) => !Number.isInteger(n) || n < 0 || n > 20000)
  ) {
    return { ok: false };
  }
  return {
    ok: true,
    value: {
      kcal: nums[0]!,
      proteinG: nums[1]!,
      carbsG: nums[2]!,
      fatG: nums[3]!,
    },
  };
}
