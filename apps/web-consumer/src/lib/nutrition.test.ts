import { describe, expect, it } from "vitest";
import { nutritionLine, parseMenuNutrition } from "./nutrition";

describe("headline nutrition", () => {
  it("names the four facts a guest scans first", () => {
    expect(
      nutritionLine({ kcal: 1860, proteinG: 168, carbsG: 0, fatG: 128 }),
    ).toBe("1,860 kcal · 168 g protein · 0 g carbs · 128 g fat");
  });

  it("prints nothing when the place has not estimated", () => {
    expect(nutritionLine(null)).toBeNull();
    expect(nutritionLine(undefined)).toBeNull();
  });

  it("keeps a complete estimate and drops a broken one", () => {
    expect(
      parseMenuNutrition({ kcal: 315, proteinG: 0, carbsG: 0, fatG: 0 }),
    ).toEqual({ kcal: 315, proteinG: 0, carbsG: 0, fatG: 0 });
    expect(parseMenuNutrition({ kcal: 10 })).toBeNull();
    expect(parseMenuNutrition({ kcal: -1, proteinG: 0, carbsG: 0, fatG: 0 })).toBeNull();
  });
});
