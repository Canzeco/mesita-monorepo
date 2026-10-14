import { describe, expect, it } from "vitest";
import { googleTypeHaystack } from "./FamiliesExplorer";

describe("googleTypeHaystack", () => {
  it("matches the spaced label the column shows and the stored slug", () => {
    const haystack = googleTypeHaystack("ice_cream_shop");
    expect(haystack.toLowerCase()).toContain("ice cream shop");
    expect(haystack).toContain("ice_cream_shop");
  });
});
