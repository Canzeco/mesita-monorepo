import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

// Home hub is Soon (Pato, 2026-08-26). Un-park is soon:false + restore bodies.
describe("Home hub is Soon", () => {
  it("every Home pill is a coming-soon control", () => {
    const nav = read("components/consumer/home/HomeModeNav.tsx");
    expect(nav.match(/soon: true/g)?.length).toBe(5);
  });

  it("Catalog, Chat, Social and Favorites redirect to swipe", () => {
    for (const leaf of ["catalog", "chat", "social", "favorites"] as const) {
      const page = read(`app/(shell)/home/${leaf}/page.tsx`);
      expect(page, leaf).toMatch(/\bredirect\(/);
      expect(page, leaf).toContain("CONSUMER_ROUTES.homeDefault");
    }
  });

  it("swipe is the Soon empty state, not the deck", () => {
    const page = read("app/(shell)/home/swipe/page.tsx");
    expect(page).toContain("EmptyState");
    expect(page).toContain('title="Soon"');
    expect(page).not.toContain("SwipeDeck");
    expect(page).not.toContain("useHomeDeck");
  });

  it("swipe is a client page so EmptyState can take a Lucide icon", () => {
    const page = read("app/(shell)/home/swipe/page.tsx");
    expect(page.startsWith('"use client"')).toBe(true);
  });

  it("does not fetch the shared Home deck while parked", () => {
    const layout = read("app/(shell)/home/layout.tsx");
    expect(layout).not.toContain("HomeDeckBoundary");
    expect(layout).toContain("flex min-h-0 flex-1 flex-col overflow-hidden");
  });

  it("CatalogRails still exists as parked code", () => {
    const rails = read("components/consumer/home/CatalogRails.tsx");
    expect(rails).toContain("apiListCatalog");
    expect(rails).toContain("overflow-y-auto");
  });
});
