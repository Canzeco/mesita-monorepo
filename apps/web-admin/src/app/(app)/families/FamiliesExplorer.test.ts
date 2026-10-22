// MVP test rule (MESITA-2600): only the data guard stays; UI pins were removed (MESITA-2601).
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
