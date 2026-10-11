import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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

  it("ships Family, Scope, Google reviews, and location", () => {
    expect(src).toContain("Family");
    expect(src).toContain("Scope");
    expect(src).toContain("Minimum number of Google reviews");
    expect(src).toContain("Use my location");
  });
});
