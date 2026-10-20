import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import {
  addSavedLocation,
  clearSavedLocationsLocal,
  isLocationBounds,
  removeSavedLocation,
  SAVED_LOCATIONS_MAX,
} from "@/lib/saved-locations";
import { isRegionPick } from "@/lib/location-pick";

// Pato (MESITA-2380): Add location saves the guest's own named points; Places
// searches from the one picked. They live in this browser, like Favorites.
const reset = readFileSync(join(__dirname, "../consumer-local-reset.ts"), "utf8");
const pickSrc = readFileSync(join(__dirname, "../location-pick.ts"), "utf8");

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

  it("reads an entry stored before kinds as a point; valid bounds make an area", () => {
    const point = addSavedLocation({ name: "Home", lat: 25.6, lng: -100.3 });
    expect(point.kind).toBe("point");
    expect(point.bounds).toBeUndefined();
    const area = addSavedLocation({
      name: "San Pedro",
      lat: 25.66,
      lng: -100.4,
      bounds: { low: { lat: 25.6, lng: -100.45 }, high: { lat: 25.7, lng: -100.35 } },
    });
    expect(area.kind).toBe("area");
    expect(area.bounds?.high.lat).toBe(25.7);
    // An inverted rectangle is no area.
    const bad = addSavedLocation({
      name: "Bad",
      lat: 1,
      lng: 1,
      bounds: { low: { lat: 2, lng: 2 }, high: { lat: 1, lng: 1 } },
    });
    expect(bad.kind).toBe("point");
    expect(isLocationBounds({ low: { lat: 0, lng: 0 } })).toBe(false);
  });

  it("saves a region pick as an area, anything else as a point (MESITA-2383)", () => {
    expect(isRegionPick({ kind: "location", locationType: "locality" })).toBe(true);
    expect(isRegionPick({ kind: "location", locationType: "sublocality_level_1" })).toBe(true);
    expect(isRegionPick({ kind: "location", locationType: "neighborhood" })).toBe(true);
    expect(isRegionPick({ kind: "location", locationType: "postal_code" })).toBe(true);
    // A street address comes back as a Location row too; it is a point.
    expect(isRegionPick({ kind: "location", locationType: "street_address" })).toBe(false);
    expect(isRegionPick({ kind: "location", locationType: "route" })).toBe(false);
    expect(isRegionPick({ kind: "place", locationType: "locality" })).toBe(false);
    expect(pickSrc).toContain("bounds: isRegionPick(row) ? anchor.viewport : null");
  });

  // MESITA-2464: the search lives in the location sheet itself; a pick is
  // resolved, saved under its Google name and made active in one tap. The
  // separate Add location sheet and its naming step are gone.
  it("searches locations right in the sheet; a pick is saved and chosen at once", () => {
    const picker = readFileSync(
      join(__dirname, "../../components/consumer/home/LocationPicker.tsx"),
      "utf8",
    );
    expect(picker).toContain("savedLocations.map((l)");
    expect(picker).toContain("data-places-location-search");
    expect(picker).toContain(
      "const loc = addSavedLocation(await resolveLocationPick(supabase, r));",
    );
    expect(picker).toContain("setActiveLocation(activeFrom(loc));");
    expect(picker.indexOf("data-places-location-search")).toBeLessThan(
      picker.indexOf("savedLocations.map((l)"),
    );
    expect(picker).not.toContain("AddLocationSheet");
    expect(picker).not.toContain("data-places-add-location");
    expect(
      existsSync(join(__dirname, "../../components/consumer/home/AddLocationSheet.tsx")),
    ).toBe(false);
  });
});
