import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("the sheet is the map set, not the old intent stack", () => {
  const src = readFileSync(
    join(__dirname, "../../components/consumer/DiscoveryFilters.tsx"),
    "utf8",
  );

  it("ships Family, Scope, Google reviews, and location", () => {
    expect(src).toContain("Family");
    expect(src).toContain("Scope");
    expect(src).toContain("Minimum number of Google reviews");
    expect(src).toContain("Use my location");
  });
});
