import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

// Catalog is live rails (Pato, 2026-08-26). Re-parking is a redirect + soon;
// swapping back to the swipe-deck grid is a product decision, not a default.
describe("Home Catalog is live rails", () => {
  it("renders CatalogRails and does not redirect to swipe", () => {
    const page = read("app/(shell)/home/catalog/page.tsx");
    expect(page).toContain("CatalogRails");
    expect(page).not.toContain("CatalogGrid");
    expect(page).not.toContain("useHomeDeck");
    expect(page).not.toMatch(/\bredirect\(/);
  });

  it("calls consumer-web-list-catalog, not the swipe recommender", () => {
    const api = read("lib/api/places.ts");
    expect(api).toContain("consumer-web-list-catalog");
    const rails = read("components/consumer/home/CatalogRails.tsx");
    expect(rails).toContain("apiListCatalog");
  });

  it("the Catalog pill is a Link, not a coming-soon control", () => {
    const nav = read("components/consumer/home/HomeModeNav.tsx");
    const catalogBlock = nav.slice(
      nav.indexOf("homeTabs.catalog"),
      nav.indexOf("homeTabs.chat"),
    );
    expect(catalogBlock.length).toBeGreaterThan(0);
    expect(catalogBlock).not.toContain("soon: true");
  });

  // Same defect class as inbox/layout.tsx: a block overflow-hidden parent
  // makes flex-1 overflow-y-auto inert, so later rails clip under the tab bar.
  it("home children slot and Catalog leaf are flex columns so rails can scroll", () => {
    const layout = read("app/(shell)/home/layout.tsx");
    expect(layout).toContain("flex min-h-0 flex-1 flex-col overflow-hidden");
    const page = read("app/(shell)/home/catalog/page.tsx");
    expect(page).toContain("flex min-h-0 flex-1 flex-col overflow-hidden");
    expect(page).not.toMatch(/className="min-h-0 flex-1 overflow-hidden"/);
    const rails = read("components/consumer/home/CatalogRails.tsx");
    expect(rails).toContain("overflow-y-auto");
    expect(rails).toContain("overflow-x-auto");
    expect(rails).toContain("flex-nowrap");
  });
});
