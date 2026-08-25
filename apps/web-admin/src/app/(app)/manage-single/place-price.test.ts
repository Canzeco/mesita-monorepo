import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  formatPlacePriceRange,
  priceLevelName,
} from "./place-price";

const here = dirname(fileURLToPath(import.meta.url));

describe("formatPlacePriceRange", () => {
  it("prints the MXN band the consumer chip uses", () => {
    expect(formatPlacePriceRange(1, "MXN")).toBe("MX$100–200 per person");
    expect(formatPlacePriceRange(2, null)).toBe("MX$200–300 per person");
    expect(formatPlacePriceRange(3, "MXN")).toBe("MX$300–500 per person");
    expect(formatPlacePriceRange(4, "MXN")).toBe("MX$500–800 per person");
  });

  it("uses $ / € prefixes for USD and EUR", () => {
    expect(formatPlacePriceRange(2, "USD")).toBe("$200–300 per person");
    expect(formatPlacePriceRange(2, "EUR")).toBe("€200–300 per person");
  });

  it("is silent when Google left price_level empty", () => {
    expect(formatPlacePriceRange(null, "MXN")).toBeNull();
    expect(formatPlacePriceRange(0, "MXN")).toBeNull();
  });

  it("names the Google $$$$ rung", () => {
    expect(priceLevelName(2)).toBe("Casual");
    expect(priceLevelName(4)).toBe("Fine dining");
    expect(priceLevelName(null)).toBeNull();
  });
});

describe("PlaceSection Google price", () => {
  it("renders the numeric band next to $$$$ Casual", () => {
    const src = readFileSync(
      join(here, "sections/PlaceSection.tsx"),
      "utf8",
    );
    expect(src).toMatch(/label="Google price"/);
    expect(src).toMatch(/formatPlacePriceRange/);
    expect(src).toMatch(/place\.currency/);
  });
});
