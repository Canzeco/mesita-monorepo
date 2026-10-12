import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "..");
const EF = join(
  SRC,
  "..",
  "..",
  "..",
  "supabase",
  "supabase",
  "functions",
  "consumer-web-recommend-swipe",
  "index.ts",
);

function read(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

describe("Swipe admits listed Mesita Map types only", () => {
  it("the deck EF cuts with the Map allowlist, never Google fill", () => {
    const src = readFileSync(EF, "utf8");
    expect(src).toContain("admitSwipeCatalog");
    expect(src).toContain("cfg.map");
    expect(src).not.toContain("google: true");
    expect(src).not.toContain("googleFill");
    const mapEngine = readFileSync(
      join(SRC, "..", "..", "..", "supabase", "supabase", "functions", "_shared", "map-engine.ts"),
      "utf8",
    );
    expect(mapEngine).toContain("listedMapFilters");
    expect(mapEngine).toContain("admitSwipeCatalog");
  });

  it("the Home deck drops Google-only stubs before they reach Swipe", () => {
    const boundary = read("components/consumer/home/HomeDeckBoundary.tsx");
    expect(boundary).toContain("!p.googleOnly && !p.from_google");
    const deck = read("components/consumer/home/swipe/SwipeDeck.tsx");
    expect(deck).toContain("!place.googleOnly && !place.from_google");
  });
});
