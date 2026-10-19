// Near and Popular (MESITA-2425; MESITA-2426 made them the two chips and
// rows that replaced All): sent to both Edge Functions; a family ranks Near.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  chipPrefer,
  isEveryFamily,
  NEAR_CHIP,
  POPULAR_CHIP,
} from "@/components/consumer/home/CatalogRails";

const src = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");

describe("Near and Popular", () => {
  it("rides both requests", () => {
    expect(src("lib/api/places.ts").match(/^\s+prefer,$/gm)?.length).toBe(2);
    expect(src("components/consumer/search/SearchClient.tsx")).toContain(
      "[filters.familyKeys, prefer, supabase]",
    );
  });

  it("are every family; a family row asks the Family mode (MESITA-2428)", () => {
    expect(isEveryFamily(NEAR_CHIP)).toBe(true);
    expect(isEveryFamily(POPULAR_CHIP)).toBe(true);
    expect(isEveryFamily("coffee")).toBe(false);
    expect(chipPrefer(POPULAR_CHIP)).toBe("popular");
    expect(chipPrefer(NEAR_CHIP)).toBe("near");
    expect(chipPrefer("coffee")).toBe("family");
    expect(src("components/consumer/search/SearchClient.tsx")).toContain(
      'filters.familyKeys.length > 0 ? "family" : storedPrefer',
    );
    // Social and Saved read no pool, so they never change the request.
    expect(src("components/consumer/home/CatalogRails.tsx")).toMatch(
      /if \(c\.key !== SOCIAL_CHIP && c\.key !== SAVED_CHIP\)\s+setPrefer\(chipPrefer\(c\.key\)\);/,
    );
  });

  it("Home keys its pool cache on the prefer", () => {
    expect(src("components/consumer/home/CatalogRails.tsx")).toContain(
      "|${prefer}`",
    );
  });
});
