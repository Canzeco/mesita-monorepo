import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Favorites and Reservations are each their own Me page (Pato, MESITA-2565:
// "saved show reservations directly. same for favorites. the page and route
// containing both reservations and saved its gone").

const SRC = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(SRC, ...p), "utf8");
const ME = join(SRC, "app", "(shell)", "me");

describe("Me › Favorites and Me › Reservations", () => {
  it("are two pages, and the tabbed Saved page is gone", () => {
    expect(existsSync(join(ME, "favorites", "page.tsx"))).toBe(true);
    expect(existsSync(join(ME, "reservations", "page.tsx"))).toBe(true);
    expect(existsSync(join(ME, "saved"))).toBe(false);
    expect(existsSync(join(SRC, "app", "(shell)", "saved"))).toBe(false);
    expect(existsSync(join(SRC, "lib", "saved-tabs.ts"))).toBe(false);
    expect(
      existsSync(join(SRC, "components", "consumer", "saved", "SavedPage.tsx")),
    ).toBe(false);
  });

  it("Favorites is the hearted places in Home's tiles, with no tab strip", () => {
    const fav = read("components", "consumer", "saved", "FavoritesPage.tsx");
    expect(fav).toContain(
      "savedPlaceList(savedIds, readSavedPlacePreviews<Place>())",
    );
    expect(fav).toContain("<CatalogTile");
    expect(fav).toContain('title="No favorites yet"');
    expect(fav).not.toContain('role="tablist"');
    expect(fav).not.toContain("ReservationsList");
  });

  it("Reservations is the list, with no tab strip", () => {
    const res = read("components", "consumer", "saved", "ReservationsPage.tsx");
    expect(res).toContain("<ReservationsList");
    expect(res).toContain('title="No reservations yet"');
    expect(res).not.toContain('role="tablist"');
    expect(res).not.toContain("CatalogTile");
  });

  it("each wears Me's frame under its own title", () => {
    expect(read("app", "(shell)", "me", "favorites", "page.tsx")).toContain(
      '<MeScreen title="Favorites" flush>',
    );
    expect(read("app", "(shell)", "me", "reservations", "page.tsx")).toContain(
      '<MeScreen title="Reservations" flush>',
    );
  });

  // A link held from the Saved era (`/saved?tab=reservations`,
  // `/me/saved?tab=reservations`) 308s to /me/favorites with its query.
  it("Favorites forwards an old Reservations-tab link to Reservations", () => {
    const page = read("app", "(shell)", "me", "favorites", "page.tsx");
    expect(page).not.toMatch(/^["']use client["']/);
    expect(page).toContain(
      'if (tab === "reservations") redirect(CONSUMER_ROUTES.mePages.reservations);',
    );
  });
});
