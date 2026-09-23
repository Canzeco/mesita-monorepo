// THE TOP OF THE LABEL (MESITA-2060).
//
// A guest scanning a dish reads four facts before the story: how much energy,
// then protein, carbs and fat. Everything under that — sodium, vitamins, a
// percent of a daily value — stays off the row. The numbers are an estimate
// the place approved, not a lab panel.
//
// NULL IS NOT ESTIMATED. It prints as a dash, the same sentence a missing
// channel price already uses: absence is a fact, and a zero would say the
// dish has no calories. A zero inside an estimate is different, and real —
// a pour of mezcal has no protein.

import type { DishNutrition } from "@/mock/types";

const KCAL = new Intl.NumberFormat("en-US");

export function nutritionLine(n: DishNutrition | null): string {
  if (n === null) return "—";
  return `${KCAL.format(n.kcal)} kcal · ${n.proteinG} g protein · ${n.carbsG} g carbs · ${n.fatG} g fat`;
}
