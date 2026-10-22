// No more `prefer` (MESITA-2516): Home's Nearby and Popular rows became one
// All row ranked like the Search map, which never sent one (MESITA-2499).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  chipFamilies,
  isEveryFamily,
  ALL_CHIP,
} from "@/components/consumer/home/CatalogRails";
import { locationErrorFromCode } from "@/lib/use-user-location";
import { headerLocation } from "@/components/consumer/home/LocationPicker";

const src = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");

describe("One ranking, no prefer (MESITA-2516)", () => {
  it("neither Home nor Search sends a prefer; Search sends the visible map (MESITA-2499)", () => {
    expect(src("lib/api/places.ts")).not.toMatch(/^\s+prefer[,:]/m);
    expect(src("lib/api/places.ts")).not.toContain("AreaPrefer");
    const search = src("components/consumer/search/SearchClient.tsx");
    expect(search).not.toContain("prefer");
    expect(search).toContain("[filters.familyKeys, supabase]");
    expect(search).toContain("boxBounds(box),");
  });

  it("All is every family; a family row is that family", () => {
    expect(isEveryFamily(ALL_CHIP)).toBe(true);
    expect(isEveryFamily("coffee")).toBe(false);
    // Every row asks for its own families; Social is a tab, and Favorites
    // left the column (MESITA-2522).
    const rails = src("components/consumer/home/CatalogRails.tsx");
    expect(rails).toContain("setFamilies(chipFamilies(c.key));");
    expect(rails).not.toContain("SAVED_CHIP");
    for (const gone of [
      "NEAR_CHIP",
      "POPULAR_CHIP",
      "chipPrefer",
      "setPrefer",
      "AreaPrefer",
    ]) {
      expect(rails, gone).not.toContain(gone);
    }
  });

  it("Home keys its pool cache on the place and the row's family", () => {
    const rails = src("components/consumer/home/CatalogRails.tsx");
    expect(rails).toContain(
      'families.length > 0 ? families.join(",") : ALL_CHIP',
    );
  });

  // MESITA-2438: a family row re-asks the server with its own key, so
  // Google gets that family's type battery instead of the every-family mix
  // a family row used to filter in the browser.
  it("a family row asks the server with its family; All with none", () => {
    expect(chipFamilies("coffee")).toEqual(["coffee"]);
    expect(chipFamilies(ALL_CHIP)).toEqual([]);
    expect(src("components/consumer/home/CatalogRails.tsx")).toContain(
      "apiListAreaPool(supabase, from, families)",
    );
    expect(src("lib/api/places.ts")).toContain(
      "...(familyKeys.length > 0 ? { familyKeys: [...familyKeys] } : {}),",
    );
  });

  // MESITA-2472 (Pato: the full-pane "Couldn't find you" "looks like …
  // shit"): no location is not a dead end. With no fix and no saved
  // location, once the browser has answered, every row ranks around the
  // city's centre (the Search map's fallback); before it answers, a
  // skeleton and no request. MESITA-2587: no bar says so above the tiles —
  // the header's location box reads "Monterrey" behind a crossed-out pin.
  it("no location ranks around Monterrey, named in the header box, never a dead end", () => {
    const rails = src("components/consumer/home/CatalogRails.tsx");
    expect(rails).toContain(
      "const onCityFallback = origin === null && coords === null && locationSettled;",
    );
    expect(rails).toContain(
      "const from = origin ?? coords ?? (onCityFallback ? MONTERREY_CENTER : null);",
    );
    expect(rails).toContain("const requestKey = `${areaPoolKey(from)}|${");
    const effect = rails.slice(
      rails.indexOf("useEffect(() => {\n    // Until the browser answers"),
    );
    expect(effect.indexOf("if (waitingForFix) return;")).toBeGreaterThan(-1);
    expect(effect.indexOf("if (waitingForFix) return;")).toBeLessThan(
      effect.indexOf("apiListAreaPool("),
    );
    expect(rails).not.toContain("cityBar");
    expect(rails).not.toContain("data-places-city-fallback");
    expect(rails).not.toContain("Location is off");
    expect(rails).not.toContain("turnOnLocation");
    expect(rails).not.toContain("Couldn't find you");
    expect(headerLocation(null, false, false, true)).toEqual({
      label: "No location",
      off: true,
    });
    expect(headerLocation(null, false, false, false).off).toBe(false);
    expect(headerLocation(null, false, true, true)).toEqual({
      label: "Locating…",
      off: false,
    });
    expect(headerLocation(null, true, false, true)).toEqual({
      label: "Current location",
      off: false,
    });
    expect(headerLocation({ name: "Home" }, false, false, true)).toEqual({
      label: "Home",
      off: false,
    });
    const hook = src("lib/use-user-location.ts");
    expect(hook).toContain("export function useUserLocationSettled()");
    // No geolocation at all still settles: `asked` is set before the check.
    expect(hook.indexOf("asked = true;")).toBeLessThan(
      hook.indexOf("!navigator.geolocation"),
    );
    expect(locationErrorFromCode(1)).toBe("denied");
    expect(locationErrorFromCode(2)).toBe("unavailable");
    expect(locationErrorFromCode(3)).toBe("timeout");
    // The failure is kept, never dropped (MESITA-2437; the retry since MESITA-2615).
    expect(hook).toContain("resolve({ error: locationErrorFromCode(err.code) })");
    expect(hook).toContain("errorState = answer.error;");
  });
});
