import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Feed's two filter counts stay distinct", () => {
  const src = readFileSync(
    join(__dirname, "../../components/consumer/home/CatalogRails.tsx"),
    "utf8",
  );

  it("hands the SHEET the number of matching places", () => {
    expect(src).toContain("count={rails === null ? null : placesShown}");
  });

  it("hands the TRIGGER the number of applied filters", () => {
    expect(src).toContain("countAppliedDiscoveryFilters(filters)");
    expect(src).toContain("`Filters, ${appliedCount} applied`");
  });

  it("never labels the trigger with a place count", () => {
    expect(src).not.toContain("${placesShown} applied");
  });
});

describe("Scroll owns its end state", () => {
  const src = readFileSync(
    join(__dirname, "../../components/consumer/home/scroll/ScrollDeck.tsx"),
    "utf8",
  );

  it("renders a terminal card rather than deferring to the filter sheet", () => {
    expect(src).toContain("That&apos;s everywhere for now");
  });
});

describe("the sheet is the map set, not the old intent stack", () => {
  const src = readFileSync(
    join(__dirname, "../../components/consumer/DiscoveryFilters.tsx"),
    "utf8",
  );

  it("ships Super Category, Scope, Google reviews, and location", () => {
    expect(src).toContain("Super Category");
    expect(src).toContain("Scope");
    expect(src).toContain("Google reviews");
    expect(src).toContain("Use my location");
  });

  it("does not ship Visit, When, or a city search", () => {
    expect(src).not.toContain("I want to");
    expect(src).not.toContain("Pick a time");
    expect(src).not.toContain("Search a city");
    expect(src).not.toContain("Distance tolerance");
  });
});
