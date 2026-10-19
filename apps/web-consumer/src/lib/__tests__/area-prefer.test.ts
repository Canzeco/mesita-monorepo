// The Near/Popular toggle (MESITA-2425): one shared choice, on both screens,
// sent to both Edge Functions, and part of Home's pool cache key.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");

describe("Near/Popular", () => {
  it("draws on the Search chip row and in Home's tile pane", () => {
    expect(src("components/consumer/search/SearchHeader.tsx")).toContain(
      "<AreaPreferChip />",
    );
    expect(src("components/consumer/home/CatalogRails.tsx")).toContain(
      "<AreaPreferChip />",
    );
  });

  it("rides both requests, and Home keys its pool cache on it", () => {
    const api = src("lib/api/places.ts");
    expect(api.match(/^\s+prefer,$/gm)?.length).toBe(2);
    expect(src("components/consumer/search/SearchClient.tsx")).toContain(
      "[filters.familyKeys, prefer, supabase]",
    );
    expect(src("components/consumer/home/CatalogRails.tsx")).toContain(
      "|${prefer}`",
    );
  });

  it("Home shows it only for a point location", () => {
    expect(src("components/consumer/home/CatalogRails.tsx")).toContain(
      'pool.kind === "point"',
    );
  });
});
