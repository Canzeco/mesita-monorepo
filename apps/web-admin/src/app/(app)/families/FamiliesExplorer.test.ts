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
  it("shows guest-family counts, then Tags and the live family rails", () => {
    const src = readFileSync(join(__dirname, "FamiliesExplorer.tsx"), "utf8");
    expect(src).toContain("guest families ·");
    const body = src.slice(
      src.indexOf("export function FamiliesExplorer"),
      src.indexOf("function FamiliesSection"),
    );
    const tags = body.indexOf("<TagsList");
    const families = body.indexOf("<FamiliesSection");
    expect(tags).toBeGreaterThan(-1);
    expect(families).toBeGreaterThan(tags);
    const tagsList = src.slice(src.indexOf("function TagsList"));
    expect(tagsList).toContain("The full catalog");
    expect(tagsList).not.toContain("<button");
    expect(src).toContain("Guest families");
    expect(src).toContain('family.slug !== "undefined"');
    expect(src).not.toContain("100 categories");
    expect(src).not.toContain("200 tags");
  });
});
