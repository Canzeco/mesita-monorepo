import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DISCOVERY_SCOPE_STOPS } from "@/lib/discovery-filters-engine";

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

describe("the catalog sheet offers Mesita rings only", () => {
  const src = readFileSync(
    join(__dirname, "../../components/consumer/DiscoveryFilters.tsx"),
    "utf8",
  );

  it("ships Family, Places, and location, and not a review floor", () => {
    expect(src).toContain("Family");
    expect(src).toContain("Places");
    expect(src).toContain("Use my location");
    expect(src).not.toContain("Minimum number of Google reviews");
  });

  it("offers Mesita Enriched Places, then Mesita Places", () => {
    expect(DISCOVERY_SCOPE_STOPS.map((stop) => stop.key)).toEqual([
      "enriched",
      "mesita",
    ]);
    expect(DISCOVERY_SCOPE_STOPS.map((stop) => stop.label)).toEqual([
      "Mesita Enriched Places",
      "Mesita Places",
    ]);
  });
});
