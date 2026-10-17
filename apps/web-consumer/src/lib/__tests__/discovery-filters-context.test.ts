import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DISCOVERY_SCOPE_STOPS } from "@/lib/discovery-filters-engine";

describe("the Feed has no Filters bar, only Use my location (MESITA-2298)", () => {
  const src = readFileSync(
    join(__dirname, "../../components/consumer/home/CatalogRails.tsx"),
    "utf8",
  );

  it("draws one location control where the Filters pill was", () => {
    expect(src).toContain('"Use my location"');
    expect(src).toContain("onClick={locate}");
    expect(src).not.toContain("SlidersHorizontal");
    expect(src).not.toContain("Filter places");
    expect(src).not.toContain("DiscoveryFilters");
  });

  it("sends no predicates, so a saved scope cannot keep cutting the list", () => {
    expect(src).toContain("apiListCatalog(supabase, coords)");
    expect(src).not.toContain("toDiscoveryPredicatesWire");
    expect(src).not.toContain("useDiscoveryFilters");
  });
});

describe("the catalog sheet offers Mesita rings only", () => {
  const src = readFileSync(
    join(__dirname, "../../components/consumer/DiscoveryFilters.tsx"),
    "utf8",
  );

  it("ships Places and location, and not a family or review cut", () => {
    expect(src).toContain("Places");
    expect(src).toContain("Use my location");
    expect(src).not.toContain('label="Family"');
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
