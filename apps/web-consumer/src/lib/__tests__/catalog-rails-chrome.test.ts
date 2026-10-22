// MVP test rule (MESITA-2600): only the EF contract guard stays; UI pins were removed (MESITA-2601).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Places has no chrome but its chip row (MESITA-2298, MESITA-2362, MESITA-2366)", () => {
  const src = readFileSync(
    join(__dirname, "../../components/consumer/home/CatalogRails.tsx"),
    "utf8",
  );

  it("sends no predicates, so a saved scope cannot keep cutting the list", () => {
    expect(src).toContain("apiListAreaPool(supabase, from, families)");
    expect(src).not.toContain("toDiscoveryPredicatesWire");
    expect(src).not.toContain("useDiscoveryFilters");
  });
});
