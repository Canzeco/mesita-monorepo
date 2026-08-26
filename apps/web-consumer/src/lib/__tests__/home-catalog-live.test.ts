import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

// Catalog is live (Pato, 2026-08-26). Re-parking is a redirect + soon: true;
// this pin goes red if either comes back without an explicit product decision.
describe("Home Catalog is live", () => {
  it("renders CatalogGrid and does not redirect to swipe", () => {
    const page = read("app/(shell)/home/catalog/page.tsx");
    expect(page).toContain("CatalogGrid");
    expect(page).not.toMatch(/\bredirect\(/);
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
});
