import { describe, expect, it } from "vitest";
import { MENU_SECTIONS } from "@/mock/fixtures";
import { nutritionLine } from "./nutrition";

describe("the headline line", () => {
  it("names the four facts a guest scans first", () => {
    expect(
      nutritionLine({ kcal: 1860, proteinG: 168, carbsG: 0, fatG: 128 }),
    ).toBe("1,860 kcal · 168 g protein · 0 g carbs · 128 g fat");
  });

  it("prints a dash when the dish has not been estimated", () => {
    expect(nutritionLine(null)).toBe("—");
  });
});

describe("the fixture menu", () => {
  it("gives every dish a nutrition fact, including the one still unestimated", () => {
    const dishes = MENU_SECTIONS.flatMap((s) => s.dishes);
    expect(dishes.every((d) => "nutrition" in d)).toBe(true);
    expect(dishes.filter((d) => d.nutrition === null).map((d) => d.id)).toEqual([
      "dish_paloma",
    ]);
    const tomahawk = dishes.find((d) => d.id === "dish_tomahawk")!;
    expect(nutritionLine(tomahawk.nutrition)).toContain("kcal");
    expect(nutritionLine(tomahawk.nutrition)).toContain("protein");
  });
});
