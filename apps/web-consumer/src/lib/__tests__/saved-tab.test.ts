import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { SAVED_TABS, savedTabFrom } from "@/lib/saved-tabs";

// The bar's Saved tab (Pato, MESITA-2521: "rename the bookings page to saved
// and then saved is divided into two things favorites, reservations").

const SRC = join(__dirname, "..", "..");
const PAGE = readFileSync(
  join(SRC, "components", "consumer", "saved", "SavedPage.tsx"),
  "utf8",
);

describe("Saved: Favorites | Reservations", () => {
  it("is two tabs, Favorites first", () => {
    expect(SAVED_TABS.map((t) => t.label)).toEqual([
      "Favorites",
      "Reservations",
    ]);
  });

  it("opens Reservations only when the address asks", () => {
    expect(savedTabFrom("reservations")).toBe("reservations");
    expect(savedTabFrom(undefined)).toBe("favorites");
    expect(savedTabFrom("favorites")).toBe("favorites");
    expect(savedTabFrom(["reservations"])).toBe("favorites");
    expect(savedTabFrom("junk")).toBe("favorites");
  });

  it("Favorites is the hearted places in Home's tiles; Reservations is the list", () => {
    expect(PAGE).toContain(
      "savedPlaceList(savedIds, readSavedPlacePreviews<Place>())",
    );
    expect(PAGE).toContain("<CatalogTile");
    expect(PAGE).toContain('title="No favorites yet"');
    expect(PAGE).toContain("<ReservationsList");
    expect(PAGE).toContain('title="No reservations yet"');
  });

  // MESITA-2523: the server page called savedTabFrom out of the "use client"
  // SavedPage module and every /saved load 500'd. A server page may RENDER a
  // client component, never CALL one of its exports.
  it("the server page calls nothing from a client module", () => {
    const page = readFileSync(
      join(SRC, "app", "(shell)", "saved", "page.tsx"),
      "utf8",
    );
    expect(page).not.toMatch(/^["']use client["']/);
    expect(page).toContain('import { savedTabFrom } from "@/lib/saved-tabs";');
    expect(page).toMatch(
      /import \{ SavedPage \} from "@\/components\/consumer\/saved\/SavedPage";/,
    );
    const tabs = readFileSync(join(SRC, "lib", "saved-tabs.ts"), "utf8");
    expect(tabs).not.toMatch(/^["']use client["']/m);
  });

  it("the header says Saved and the Bookings page is gone", () => {
    expect(PAGE).toMatch(/<h1[^>]*>\s*Saved\s*<\/h1>/);
    expect(existsSync(join(SRC, "app", "(shell)", "bookings"))).toBe(false);
    expect(existsSync(join(SRC, "app", "(shell)", "saved", "page.tsx"))).toBe(
      true,
    );
  });
});
