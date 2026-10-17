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

  it("ships Family, Places, Google reviews, and location", () => {
    expect(src).toContain("Family");
    expect(src).toContain("Places");
    expect(src).toContain("Minimum number of Google reviews");
    expect(src).toContain("Use my location");
  });

  it("offers Mesita Places and Mesita Enriched Places", () => {
    expect(DISCOVERY_SCOPE_STOPS.map((stop) => stop.key)).toEqual([
      "mesita",
      "enriched",
    ]);
    expect(DISCOVERY_SCOPE_STOPS.map((stop) => stop.label)).toEqual([
      "Mesita Places",
      "Mesita Enriched Places",
    ]);
  });
});
