import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("the Feed has no chrome above the rails (MESITA-2298, MESITA-2362)", () => {
  const src = readFileSync(
    join(__dirname, "../../components/consumer/home/CatalogRails.tsx"),
    "utf8",
  );

  it("draws no Filters pill and no location bar; location is asked on mount", () => {
    expect(src).not.toContain("Use my location");
    expect(src).not.toContain("Near you");
    expect(src).not.toContain("useLocateUser");
    expect(src).toContain("const coords = useUserLocation();");
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
