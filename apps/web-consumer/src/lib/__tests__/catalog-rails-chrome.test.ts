import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Places has no chrome but its chip row (MESITA-2298, MESITA-2362, MESITA-2366)", () => {
  const src = readFileSync(
    join(__dirname, "../../components/consumer/home/CatalogRails.tsx"),
    "utf8",
  );

  it("draws no Filters pill and no location control of its own (MESITA-2401: the header's)", () => {
    expect(src).toContain("const coords = useUserLocation();");
    // The empty state's one button asks again; its label follows the last
    // ask's failure (MESITA-2437).
    expect(src).toContain("action={{ label: noLocation.action, onClick: locate }}");
    expect(src).toContain('action: "Use my location",');
    expect(src).not.toContain("data-places-location-bar");
    expect(src).not.toContain("locationStrip");
    expect(src).not.toContain("SlidersHorizontal");
    expect(src).not.toContain("Filter places");
    expect(src).not.toContain("DiscoveryFilters");
  });

  it("sends no predicates, so a saved scope cannot keep cutting the list", () => {
    expect(src).toContain("apiListAreaPool(supabase, from, prefer, families)");
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
