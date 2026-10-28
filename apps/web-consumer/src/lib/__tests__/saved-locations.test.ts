import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  addSavedLocation,
  clearSavedLocationsLocal,
  confirmedPatch,
  displayName,
  evictionFor,
  getSavedLocations,
  patchSavedLocationInPlace,
  readStoredLocations,
  removeSavedLocation,
  SAVED_LOCATION_FALLBACK,
  SAVED_LOCATIONS_MAX,
  updateSavedLocation,
  type SavedLocationInput,
} from "@/lib/saved-locations";
import { resolveActiveLocation, savedLocationKey } from "@/lib/active-location";

// Pato (MESITA-2380): the guest's own named points, in this browser, like
// Favorites. Since MESITA-2501 every one is a pin the guest confirmed on a
// map, named from that pin.
const reset = readFileSync(join(__dirname, "../consumer-local-reset.ts"), "utf8");

const pin = (over: Partial<SavedLocationInput> = {}): SavedLocationInput => ({
  lat: 25.6514,
  lng: -100.2895,
  suggestedName: "Tecnológico",
  customName: null,
  formattedAddress: "Avenida Eugenio Garza Sada 2501",
  nameEdited: false,
  needsName: false,
  ...over,
});

// Node has no window: the store runs in memory, which is all most cases pin.
describe("saved locations are confirmed pins (MESITA-2501)", () => {
  beforeEach(() => clearSavedLocationsLocal());

  it("shows the guest's name, else Google's, else Saved location", () => {
    expect(displayName({ customName: "Casa", suggestedName: "Tecnológico" })).toBe("Casa");
    expect(displayName({ customName: null, suggestedName: "Tecnológico" })).toBe("Tecnológico");
    expect(displayName({ customName: null, suggestedName: null })).toBe(SAVED_LOCATION_FALLBACK);
  });

  it("saves newest first; two pins with the same name are both kept", () => {
    const a = addSavedLocation(pin({ customName: "Oficina", nameEdited: true }), null, 1000);
    const b = addSavedLocation(pin({ lat: 25.7, customName: "Oficina", nameEdited: true }), null, 2000);
    expect(a?.kept).toBe(true);
    const list = getSavedLocations();
    expect(list.map((l) => l.id)).toEqual([b!.location.id, a!.location.id]);
    expect(list.every((l) => l.name === "Oficina")).toBe(true);
    // Named from the pin when it is saved; a pin saved before Google
    // answered waits for the backfill.
    expect(a!.location.namedAt).toBe(1000);
    expect(addSavedLocation(pin({ needsName: true }))!.location.namedAt).toBeNull();
  });

  it("a ninth save drops the oldest pin without a custom name, never the active one", () => {
    const ids: string[] = [];
    for (let i = 0; i < SAVED_LOCATIONS_MAX; i++) ids.push(addSavedLocation(pin({ lat: i }))!.location.id);
    const oldest = ids[0];
    const second = ids[1];
    // The oldest is active: the next-oldest makes room.
    addSavedLocation(pin({ lat: 99 }), oldest);
    const after = getSavedLocations().map((l) => l.id);
    expect(after).toHaveLength(SAVED_LOCATIONS_MAX);
    expect(after).toContain(oldest);
    expect(after).not.toContain(second);
  });

  it("eight named pins leave no room: the save waits until one is removed", () => {
    for (let i = 0; i < SAVED_LOCATIONS_MAX; i++) addSavedLocation(pin({ lat: i, customName: `P${i}`, nameEdited: true }));
    expect(evictionFor(getSavedLocations(), null)).toBeUndefined();
    expect(addSavedLocation(pin())).toBeNull();
    removeSavedLocation(getSavedLocations()[0].id);
    expect(evictionFor(getSavedLocations(), null)).toBeNull();
  });

  it("an edit keeps the id and moves to the front; a backfill keeps the order", () => {
    const a = addSavedLocation(pin({ lat: 1 }))!.location;
    const b = addSavedLocation(pin({ lat: 2 }))!.location;
    const edited = updateSavedLocation(a.id, { customName: "Casa", nameEdited: true });
    expect(edited?.location.id).toBe(a.id);
    expect(edited?.location.name).toBe("Casa");
    expect(getSavedLocations().map((l) => l.id)).toEqual([a.id, b.id]);
    patchSavedLocationInPlace(b.id, { suggestedName: "Roma" });
    expect(getSavedLocations().map((l) => l.id)).toEqual([a.id, b.id]);
    expect(getSavedLocations()[1].name).toBe("Roma");
  });

  it("confirming a pin clears the legacy flags and stamps when Google named it", () => {
    const patch = confirmedPatch(pin(), 5000);
    expect(patch).toMatchObject({ unconfirmed: false, legacyName: null, namedAt: 5000, needsName: false });
    expect(confirmedPatch(pin({ needsName: true }), 5000).namedAt).toBeNull();
  });

  it("is wiped when a different guest signs in, like Favorites", () => {
    expect(reset).toContain("clearSavedLocationsLocal();");
  });
});

describe("entries stored before confirmed pins", () => {
  it("an old area reads as an UNCONFIRMED point at its own lat/lng, its name kept for 'Was:'", () => {
    const [old] = readStoredLocations([
      {
        id: "a1",
        name: "San Pedro",
        lat: 25.65,
        lng: -101.12,
        kind: "area",
        bounds: { low: { lat: 25.6, lng: -101.2 }, high: { lat: 25.7, lng: -101.0 } },
      },
    ]);
    expect(old).toMatchObject({
      id: "a1",
      lat: 25.65,
      lng: -101.12,
      kind: "point",
      suggestedName: "San Pedro",
      customName: null,
      legacyName: "San Pedro",
      needsName: true,
      unconfirmed: true,
      nameEdited: false,
    });
    expect(old).not.toHaveProperty("bounds");
  });

  it("a new entry round-trips; anything without a pin is dropped", () => {
    const stored = readStoredLocations([
      { id: "n1", lat: 1, lng: 2, suggestedName: "Roma", customName: "Casa", formattedAddress: null, nameEdited: true, namedAt: 9, needsName: false, unconfirmed: false, legacyName: null },
      { id: "x", name: "No pin" },
      "junk",
    ]);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ name: "Casa", namedAt: 9, unconfirmed: false });
  });

  it("an unconfirmed entry never drives Home: the active key falls back to current location", () => {
    const [old] = readStoredLocations([{ id: "a1", name: "San Pedro", lat: 1, lng: 2, kind: "point" }]);
    expect(resolveActiveLocation(savedLocationKey("a1"), [old])).toBeNull();
    const confirmed = { ...old, unconfirmed: false };
    expect(resolveActiveLocation(savedLocationKey("a1"), [confirmed])).toEqual({
      key: "saved:a1",
      name: "San Pedro",
      lat: 1,
      lng: 2,
    });
    expect(resolveActiveLocation("saved:gone", [confirmed])).toBeNull();
    expect(resolveActiveLocation(null, [confirmed])).toBeNull();
  });
});

describe("a browser that refuses to keep the list", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearSavedLocationsLocal();
  });

  it("reports the save as not kept, and a second save of the same pin updates it", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => null,
        removeItem: () => {},
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    clearSavedLocationsLocal();
    const first = addSavedLocation(pin());
    expect(first?.kept).toBe(false);
    // The picker keeps the id and updates instead of adding a duplicate.
    updateSavedLocation(first!.location.id, confirmedPatch(pin({ customName: "Casa", nameEdited: true })));
    expect(getSavedLocations()).toHaveLength(1);
    expect(getSavedLocations()[0].name).toBe("Casa");
  });
});

describe("a saved pin has no radius (MESITA-2914)", () => {
  beforeEach(() => clearSavedLocationsLocal());

  it("a radius stored before MESITA-2914 is dropped on read", () => {
    addSavedLocation(pin());
    const stored = { ...JSON.parse(JSON.stringify(getSavedLocations()))[0], radiusKm: 5 };
    expect("radiusKm" in readStoredLocations([stored])[0]).toBe(false);
  });
});
