import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Places' two filter counts stay distinct", () => {
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

describe("the sheet is the map set, not the old intent stack", () => {
  const src = readFileSync(
    join(__dirname, "../../components/consumer/DiscoveryFilters.tsx"),
    "utf8",
  );

  it("ships Scope, Google reviews, and location", () => {
    expect(src).not.toContain("Family");
    expect(src).toContain("Scope");
    expect(src).toContain("Minimum number of Google reviews");
    expect(src).toContain("Use my location");
  });
});
