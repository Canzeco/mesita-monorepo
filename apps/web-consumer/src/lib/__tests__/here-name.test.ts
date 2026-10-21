import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { aroundYouRows, locationLabel } from "@/components/consumer/home/LocationPicker";
import { hereKey } from "@/lib/use-here-name";
import type { NearbyArea } from "@/lib/api/place-search";

const read = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");

// MESITA-2466: the sheet's Current location row names the neighbourhood,
// from consumer-web-reverse-geocode; the header oval does not.
describe("Current location names the neighbourhood", () => {
  it("adds the name to the row only with a fix and no saved location", () => {
    expect(locationLabel(null, true, false, "Distrito Tec")).toBe(
      "Current location · Distrito Tec",
    );
    expect(locationLabel(null, true, false)).toBe("Current location");
    expect(locationLabel(null, true, false, null)).toBe("Current location");
    expect(locationLabel({ name: "Home" }, true, false, "Distrito Tec")).toBe("Home");
    expect(locationLabel(null, false, true, "Distrito Tec")).toBe("Locating…");
    expect(locationLabel(null, false, false, "Distrito Tec")).toBe("Use my location");
  });

  it("keeps one name per ~110 m cell, the server's own snap", () => {
    expect(hereKey({ lat: 25.651234, lng: -100.289876 })).toBe("25.651,-100.290");
    expect(hereKey({ lat: 25.6514, lng: -100.2902 })).toBe(
      hereKey({ lat: 25.651234, lng: -100.289876 }),
    );
  });

  it("asks only while the sheet is open, and the header keeps Current location", () => {
    const picker = read("components/consumer/home/LocationPicker.tsx");
    expect(picker).toContain("const here = useHere(coords, picking);");
    expect(picker).toContain("const hereName = here.name;");
    expect(picker).toContain("label: locationLabel(null, coords !== null, locating, hereName),");
    expect(picker).toContain(
      "const { label, off } = headerLocation(active, coords !== null, locating, settled);",
    );
    const hook = read("lib/use-here-name.ts");
    expect(hook).toContain("if (!enabled || !coords || !key || readAnswer(key)) return;");
    expect(read("lib/api/place-search.ts")).toContain('"consumer-web-reverse-geocode"');
  });
});

// MESITA-2471 ("the instagram location"): before typing, the sheet lists the
// areas around the guest. Since MESITA-2501 a tap opens the pin picker on
// the area; nothing is saved until the guest confirms a pin.
describe("Around you", () => {
  const area = (name: string): NearbyArea => ({
    name,
    level: "city",
    lat: 25.67,
    lng: -100.31,
    bounds: { low: { lat: 25.55, lng: -100.45 }, high: { lat: 25.8, lng: -100.15 } },
  });

  it("lists the areas, minus any already saved under the same display name", () => {
    const rows = aroundYouRows(
      [area("Distrito Tec"), area("Monterrey"), area("Casa")],
      [
        { customName: null, suggestedName: " monterrey " },
        { customName: "casa", suggestedName: "Roma" },
      ],
    );
    expect(rows.map((a) => a.name)).toEqual(["Distrito Tec"]);
    expect(aroundYouRows([], [])).toEqual([]);
  });

  it("a tap opens the pin picker on the area, under Current location", () => {
    const picker = read("components/consumer/home/LocationPicker.tsx");
    expect(picker).toContain("const aroundYou = aroundYouRows(here.areas, savedLocations);");
    expect(picker).toContain('setPicker({ mode: "new", camera: aroundYouCamera(a), entry: null })');
    expect(picker.indexOf('key: "here"')).toBeLessThan(picker.indexOf("data-places-around-you"));
    expect(picker.indexOf("data-places-around-you")).toBeLessThan(picker.indexOf("savedLocations.map((l)"));
  });
});
