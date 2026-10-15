import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { googleTypeHaystack, groupTags } from "./FamiliesExplorer";
import type { TagRow } from "./highlight";

describe("googleTypeHaystack", () => {
  it("matches the spaced label the column shows and the stored slug", () => {
    const haystack = googleTypeHaystack("ice_cream_shop");
    expect(haystack.toLowerCase()).toContain("ice cream shop");
    expect(haystack).toContain("ice_cream_shop");
  });
});

const tags: TagRow[] = [
  {
    slug: "cash",
    label: "Cash",
    facet: "payment",
    facetLabel: "Payment",
    facetEmoji: "💳",
    sortOrder: 1,
  },
  {
    slug: "card",
    label: "Card",
    facet: "payment",
    facetLabel: "Payment",
    facetEmoji: "💳",
    sortOrder: 2,
  },
  {
    slug: "late_night",
    label: "Late night",
    facet: "hours",
    facetLabel: "Hours",
    facetEmoji: "🕒",
    sortOrder: 1,
  },
];

describe("groupTags", () => {
  it("keeps facet order and drops a facet the search misses", () => {
    expect(groupTags(tags, "").map((group) => group.key)).toEqual(["payment", "hours"]);
    expect(groupTags(tags, "night")).toEqual([
      {
        key: "hours",
        title: "🕒 Hours",
        rows: [{ slug: "late_night", label: "Late night" }],
      },
    ]);
  });
});

describe("Atlas lists", () => {
  it("shows FamiliesIA DNA, Google Categories, Mesita Categories, then tags as text", () => {
    const src = readFileSync(join(__dirname, "FamiliesExplorer.tsx"), "utf8");
    const dna = src.indexOf('title="FamiliesIA DNA"');
    const google = src.indexOf('title="Google Categories"');
    const mesita = src.indexOf('title="Mesita Categories"');
    expect(dna).toBeGreaterThan(-1);
    expect(google).toBeGreaterThan(dna);
    expect(mesita).toBeGreaterThan(google);
    const tagsList = src.slice(src.indexOf("function TagsList"), src.indexOf("function Column"));
    expect(tagsList).toContain("The full catalog");
    expect(tagsList).not.toContain("<button");
  });
});
