// MVP test rule (MESITA-2600): only the EF contract guard stays; UI pins were removed (MESITA-2601).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { hereKey } from "@/lib/use-here-name";

const read = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");

// MESITA-2466: the sheet's Current location row names the neighbourhood,
// from consumer-web-reverse-geocode; the header oval does not.
describe("Current location names the neighbourhood", () => {
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
    expect(picker).toContain("title: locationLabel(null, coords !== null, locating),");
    expect(picker).toContain("sub: coords !== null ? hereName");
    expect(picker).toContain(
      "const { label, off } = headerLocation(active, coords !== null, locating, settled);",
    );
    const hook = read("lib/use-here-name.ts");
    expect(hook).toContain("if (!enabled || !coords || !key || readAnswer(key)) return;");
    expect(read("lib/api/place-search.ts")).toContain('"consumer-web-reverse-geocode"');
  });
});
