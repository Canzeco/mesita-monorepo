// THE TOP OF THE LABEL (MESITA-2060). Same line as web-consumer.

export type MenuNutrition = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

const KCAL = new Intl.NumberFormat('en-US');

function whole(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 20000) {
    return null;
  }
  return Math.round(v);
}

export function parseMenuNutrition(raw: unknown): MenuNutrition | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
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

export function nutritionLine(
  n: MenuNutrition | null | undefined,
): string | null {
  if (!n) return null;
  return `${KCAL.format(n.kcal)} kcal · ${n.proteinG} g protein · ${n.carbsG} g carbs · ${n.fatG} g fat`;
}
