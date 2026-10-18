import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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

  it("the Feed's filter cluster is deleted, not parked", () => {
    const lib = join(__dirname, "..");
    for (const gone of [
      "use-discovery-filters.ts",
      "discovery-filters-engine.ts",
      "discovery-filters-wire.ts",
      "../components/consumer/DiscoveryFilters.tsx",
    ]) {
      expect(existsSync(join(lib, gone)), gone).toBe(false);
    }
  });
});
