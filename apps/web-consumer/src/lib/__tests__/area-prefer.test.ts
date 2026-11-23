// No more `prefer` (MESITA-2516): Home's Nearby and Popular rows became one
// All row ranked like the Search map, which never sent one (MESITA-2499).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  chipFamilies,
  isEveryFamily,
  ALL_CHIP,
  NEAR_CHIP,
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
    // The clear window, not the whole canvas (MESITA-3020).
    expect(search).toContain("sightBounds(box),");
  });

  it("All is every family; a family row is that family", () => {
    expect(isEveryFamily(ALL_CHIP)).toBe(true);
    // Near is back as Top's twin (MESITA-4423): every family, no prefer.
    expect(isEveryFamily(NEAR_CHIP)).toBe(true);
    expect(isEveryFamily("coffee")).toBe(false);
    // Every row asks for its own families; Social is a tab. Saved came back
    // above Top (MESITA-3718) and reads no pool.
    const rails = src("components/consumer/home/CatalogRails.tsx");
    expect(rails).toContain("const families = useMemo(() => chipFamilies(poolChip), [poolChip]);");
    for (const gone of [
      "POPULAR_CHIP",
      "chipPrefer",
      "setPrefer",
      "AreaPrefer",
    ]) {
      expect(rails, gone).not.toContain(gone);
    }
  });

  it("Home keys its pool cache on the guest and the row's question (MESITA-4454)", () => {
    const rails = src("components/consumer/home/CatalogRails.tsx");
    expect(rails).toContain("const mode = modeKey(rankMode, families);");
    expect(rails).toContain("const requestKey = `${guest}|${mode}`;");
  });

  // MESITA-2438: a family row re-asks the server with its own key, so
  // Google gets that family's type battery instead of the every-family mix
  // a family row used to filter in the browser.
  it("a family row asks the server with its family; All with none", () => {
    expect(chipFamilies("coffee")).toEqual(["coffee"]);
    expect(chipFamilies(ALL_CHIP)).toEqual([]);
    expect(src("components/consumer/home/CatalogRails.tsx")).toContain(
      "apiListAreaPool(supabase, here, families, {",
    );
    expect(src("lib/api/places.ts")).toContain(
      "...(familyKeys.length > 0 ? { familyKeys: [...familyKeys] } : {}),",
    );
  });

  // NO LOCATION, NO RANK (Pato, 2026-11-21, MESITA-4542: "make location
  // selector mandatory"), reversing MESITA-2472's "no location still ranks
  // Popular". With no point every ranking chip shows the location chooser
  // and no request leaves; Saved never gates. The skeleton waits only for
  // the browser's FIRST answer: keying it on `settled` would swap the
  // chooser for the skeleton on a "Use my location" tap (eng review F1).
  it("no location, no rank: Home and Search ask, Places waits", () => {
    const rails = src("components/consumer/home/CatalogRails.tsx");
    expect(rails).toContain("const here = origin ?? coords ?? null;");
    expect(rails).toContain("const noPoint = here === null && chip !== SAVED_CHIP;");
    expect(rails).not.toContain("MONTERREY_CENTER");
    expect(rails).not.toContain("nearbyWithoutPoint");
    expect(rails).not.toContain("seePopular");
    expect(rails).not.toContain("waitingForFix");
    // The effect sends nothing without a point, whatever the chip.
    const effect = rails.slice(rails.indexOf("// NO POINT, NO REQUEST (MESITA-4542)"));
    expect(effect.indexOf("if (here === null) return;")).toBeGreaterThan(-1);
    expect(effect.indexOf("if (here === null) return;")).toBeLessThan(
      effect.indexOf("apiListAreaPool("),
    );
    // The body: Saved first, then no point = the skeleton under the app's
    // location gate (MESITA-4589), and no families row.
    const body = rails.slice(rails.indexOf("if (chip === SAVED_CHIP) {"));
    expect(body.indexOf("if (noPoint) return shell(waiting);")).toBeGreaterThan(-1);
    // MESITA-4758: no tab strip; the chips show on Places and Social alike.
    expect(rails).toContain("{here !== null ? strip : null}");
    // The gate covers Home and Search (only) until a point exists.
    const gateSrc = src("components/consumer/LocationGate.tsx");
    expect(gateSrc).toContain("const asking = here && answered && !hasPoint;");
    // Through the floating modal since MESITA-4628.
    expect(gateSrc).toContain("<LocationModal");
    expect(src("app/(shell)/layout.tsx")).toContain("<LocationGate />");
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
    // Kept through the network fallback (MESITA-2625; behaviour pinned in
    // user-location-stall.test.ts).
    expect(hook).toContain("deviceGaveNothing(answer.error, gen)");
  });
});
