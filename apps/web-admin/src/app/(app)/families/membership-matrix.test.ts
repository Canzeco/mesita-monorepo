import { describe, expect, it } from "vitest";
import {
  cellOn,
  filterMembershipRows,
  googleCategoryLabel,
  guestFamilyColumns,
  inNoFamily,
  type MembershipFamily,
  type MembershipRow,
} from "./membership-matrix";

const families: MembershipFamily[] = [
  { slug: "undefined", label: "Undefined", emoji: "·", sortOrder: 999 },
  { slug: "breakfast", label: "Breakfast", emoji: "·", sortOrder: 2 },
  { slug: "coffee", label: "Coffee", emoji: "·", sortOrder: 1 },
];

const rows: MembershipRow[] = [
  { slug: "cafe", familyKeys: ["coffee", "breakfast"] },
  { slug: "pizza_restaurant", familyKeys: ["pizza"] },
  { slug: "gas_station", familyKeys: [] },
];

describe("guestFamilyColumns", () => {
  it("drops undefined and follows sort order", () => {
    expect(guestFamilyColumns(families).map((family) => family.slug)).toEqual([
      "coffee",
      "breakfast",
    ]);
  });
});

describe("cellOn", () => {
  it("is on for every family a category sits in", () => {
    const cafe = rows[0];
    expect(cellOn(cafe, "coffee")).toBe(true);
    expect(cellOn(cafe, "breakfast")).toBe(true);
    expect(cellOn(cafe, "pizza")).toBe(false);
    expect(cellOn(rows[1], "pizza")).toBe(true);
    expect(cellOn(rows[2], "coffee")).toBe(false);
  });
});

describe("googleCategoryLabel", () => {
  it("reads as a name, with the slug's words capitalized", () => {
    expect(googleCategoryLabel("pizza_restaurant")).toBe("Pizza Restaurant");
    expect(googleCategoryLabel("acai_shop")).toBe("Acai Shop");
  });
});

describe("filterMembershipRows", () => {
  it("matches the spaced label and the slug", () => {
    expect(filterMembershipRows(rows, "ice").map((row) => row.slug)).toEqual([]);
    expect(filterMembershipRows(rows, "pizza restaurant").map((row) => row.slug)).toEqual([
      "pizza_restaurant",
    ]);
    expect(filterMembershipRows(rows, "gas_station").map((row) => row.slug)).toEqual([
      "gas_station",
    ]);
  });
});

describe("inNoFamily", () => {
  it("is on only when a category sits in no guest family", () => {
    expect(inNoFamily(rows[0])).toBe(false);
    expect(inNoFamily(rows[2])).toBe(true);
    expect(inNoFamily({ slug: "car_repair", familyKeys: ["undefined"] })).toBe(true);
  });
});
