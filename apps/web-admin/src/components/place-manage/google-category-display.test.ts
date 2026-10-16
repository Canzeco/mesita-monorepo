import { describe, expect, it } from "vitest";
import { googleCategoryDisplay } from "./google-category-display";

describe("googleCategoryDisplay", () => {
  it("prefers the synced label for a real Google type", () => {
    expect(googleCategoryDisplay("fine_dining_restaurant", "Fine Dining Restaurant")).toBe(
      "Fine Dining Restaurant",
    );
  });

  it("humanizes the slug when the label is missing", () => {
    expect(googleCategoryDisplay("wine_bar", null)).toBe("wine bar");
  });

  it("does not show the undefined bucket as a category", () => {
    expect(googleCategoryDisplay("undefined", "Undefined")).toBe("—");
    expect(googleCategoryDisplay(null, null)).toBe("—");
  });
});
