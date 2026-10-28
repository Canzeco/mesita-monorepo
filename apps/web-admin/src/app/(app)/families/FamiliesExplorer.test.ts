// MVP test rule (MESITA-2600): only the data guard stays; UI pins were removed (MESITA-2601).
import { describe, expect, it } from "vitest";
import { groupTags } from "./FamiliesExplorer";
import type { TagRow } from "./highlight";

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
