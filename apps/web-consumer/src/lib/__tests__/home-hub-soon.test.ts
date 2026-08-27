import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

// Home MVP is Swipe · Chat · Favorites (Pato, 2026-08-27). Catalog and Social
// stay Soon. Un-park those two with soon:false + restore bodies.
describe("Home hub MVP", () => {
  it("only Catalog and Social pills are coming-soon controls", () => {
    const nav = read("components/consumer/home/HomeModeNav.tsx");
    expect(nav.match(/soon: true/g)?.length).toBe(2);
    expect(nav).toContain('label: "Catalog"');
    expect(nav).toContain('label: "Social"');
    expect(nav).not.toContain("A photo-first deck of places near you");
    expect(nav).not.toContain("Talk to Don Memo about where to go");
  });

  it("Catalog and Social redirect to swipe", () => {
    for (const leaf of ["catalog", "social"] as const) {
      const page = read(`app/(shell)/home/${leaf}/page.tsx`);
      expect(page, leaf).toMatch(/\bredirect\(/);
      expect(page, leaf).toContain("CONSUMER_ROUTES.homeDefault");
    }
  });

  it("Chat and Favorites do not redirect", () => {
    for (const leaf of ["chat", "favorites"] as const) {
      const page = read(`app/(shell)/home/${leaf}/page.tsx`);
      expect(page, leaf).not.toMatch(/\bredirect\(/);
    }
  });

  it("swipe mounts the deck", () => {
    const page = read("app/(shell)/home/swipe/page.tsx");
    expect(page).toContain("SwipeDeck");
    expect(page).toContain("useHomeDeck");
    expect(page).not.toContain('title="Soon"');
  });

  it("chat mounts AskAiTab", () => {
    const page = read("app/(shell)/home/chat/page.tsx");
    expect(page).toContain("AskAiTab");
    expect(page).toContain("useHomeDeck");
  });

  it("favorites mounts FavoritesList", () => {
    const page = read("app/(shell)/home/favorites/page.tsx");
    expect(page).toContain("FavoritesList");
    expect(page).toContain("useHomeDeck");
  });

  it("shared layout fetches the Home deck once", () => {
    const layout = read("app/(shell)/home/layout.tsx");
    expect(layout).toContain("HomeDeckBoundary");
    expect(layout).toContain("flex min-h-0 flex-1 flex-col overflow-hidden");
  });

  it("CatalogRails still exists as parked code", () => {
    const rails = read("components/consumer/home/CatalogRails.tsx");
    expect(rails).toContain("apiListCatalog");
    expect(rails).toContain("overflow-y-auto");
  });
});
