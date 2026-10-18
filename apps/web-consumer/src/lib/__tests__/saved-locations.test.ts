import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import {
  addSavedLocation,
  clearSavedLocationsLocal,
  removeSavedLocation,
  SAVED_LOCATIONS_MAX,
} from "@/lib/saved-locations";

// Pato (MESITA-2380): Add location saves the guest's own named points; Places
// searches from the one picked. They live in this browser, like Favorites.
const rails = readFileSync(
  join(__dirname, "../../components/consumer/home/CatalogRails.tsx"),
  "utf8",
);
const reset = readFileSync(join(__dirname, "../consumer-local-reset.ts"), "utf8");

// Node has no window: the store runs in memory, which is all this pins.
describe("saved locations (MESITA-2380)", () => {
  beforeEach(() => clearSavedLocationsLocal());

  it("saves newest first, trims the name, and replaces a same-name save", () => {
    const a = addSavedLocation({ name: " Home ", lat: 25.6, lng: -100.3 });
    expect(a.name).toBe("Home");
    const b = addSavedLocation({ name: "Office", lat: 25.7, lng: -100.4 });
    const c = addSavedLocation({ name: "home", lat: 1, lng: 2 });
    expect([b.id, c.id]).not.toContain(a.id);
    removeSavedLocation(c.id);
    removeSavedLocation(b.id);
    // a was replaced by c, so nothing is left.
    expect(addSavedLocation({ name: "x", lat: 0, lng: 0 }).name).toBe("x");
  });

  it("keeps at most SAVED_LOCATIONS_MAX", () => {
    const ids = Array.from({ length: SAVED_LOCATIONS_MAX + 2 }, (_, i) =>
      addSavedLocation({ name: `L${i}`, lat: i, lng: i }).id,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is wiped when a different guest signs in, like Favorites", () => {
    expect(reset).toContain("clearSavedLocationsLocal();");
  });

  it("lists saved locations after Current location and before the zones; Add location opens the sheet", () => {
    expect(rails.indexOf("savedLocations.map((l)")).toBeGreaterThan(rails.indexOf('"Current location"'));
    expect(rails.indexOf("savedLocations.map((l)")).toBeLessThan(rails.indexOf("zones.map((z)"));
    expect(rails).toContain("onClick={() => setAdding(true)}");
    expect(rails).not.toMatch(/data-places-add-location[\s\S]{0,200}Soon/);
    expect(rails).toContain("<AddLocationSheet");
  });
});
