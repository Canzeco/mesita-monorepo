// Near and Popular (MESITA-2425; MESITA-2426 made them the two chips and
// rows that replaced All): sent to both Edge Functions; a family ranks Near.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  turnOnLocationCopy,
  chipPrefer,
  isEveryFamily,
  NEAR_CHIP,
  POPULAR_CHIP,
} from "@/components/consumer/home/CatalogRails";
import { locationErrorFromCode } from "@/lib/use-user-location";

const src = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");

describe("Near and Popular", () => {
  it("rides both requests", () => {
    expect(src("lib/api/places.ts").match(/^\s+prefer,$/gm)?.length).toBe(2);
    expect(src("components/consumer/search/SearchClient.tsx")).toContain(
      "[filters.familyKeys, prefer, supabase]",
    );
  });

  it("are every family; a family row asks the Family mode (MESITA-2428)", () => {
    expect(isEveryFamily(NEAR_CHIP)).toBe(true);
    expect(isEveryFamily(POPULAR_CHIP)).toBe(true);
    expect(isEveryFamily("coffee")).toBe(false);
    expect(chipPrefer(POPULAR_CHIP)).toBe("popular");
    expect(chipPrefer(NEAR_CHIP)).toBe("near");
    expect(chipPrefer("coffee")).toBe("family");
    expect(src("components/consumer/search/SearchClient.tsx")).toContain(
      'filters.familyKeys.length > 0 ? "family" : storedPrefer',
    );
    // Social and Saved read no pool, so they never change the request.
    expect(src("components/consumer/home/CatalogRails.tsx")).toMatch(
      /if \(c\.key !== SOCIAL_CHIP && c\.key !== SAVED_CHIP\)\s+setPrefer\(chipPrefer\(c\.key\)\);/,
    );
  });

  it("Home keys its pool cache on the prefer", () => {
    expect(src("components/consumer/home/CatalogRails.tsx")).toContain(
      "|${prefer}`",
    );
  });

  // MESITA-2436: with no fix and no saved location the server has no
  // Proximity, so a Nearby pool would be Popularity alone. Nearby asks for a
  // location instead, spends no request, and waits for the browser's first
  // answer before saying so (no flash of "Turn on location" on load).
  it("Nearby with no location asks for one and spends no request", () => {
    const rails = src("components/consumer/home/CatalogRails.tsx");
    expect(rails).toContain(
      'const nearbyNeedsLocation = prefer === "near" && from === null;',
    );
    const effect = rails.slice(rails.indexOf("useEffect(() => {\n    if (nearbyNeedsLocation) return;"));
    expect(effect.length).toBeGreaterThan(0);
    expect(effect.indexOf("if (nearbyNeedsLocation) return;")).toBeLessThan(
      effect.indexOf("apiListAreaPool("),
    );
    const branch = rails.slice(
      rails.indexOf("if (chip === NEAR_CHIP && nearbyNeedsLocation)"),
      rails.indexOf("if (fetchError)"),
    );
    expect(branch).toContain("locationSettled ?");
    expect(branch).toContain("turnOnLocation");
    expect(rails.indexOf("if (chip === NEAR_CHIP && nearbyNeedsLocation)")).toBeLessThan(
      rails.indexOf("if (pool === null)"),
    );
    // Popular still answers without a location (Popularity by design).
    expect(rails).not.toMatch(/prefer === "popular" && from === null/);
    const hook = src("lib/use-user-location.ts");
    expect(hook).toContain("export function useUserLocationSettled()");
    // No geolocation at all still settles: `asked` is set before the check.
    expect(hook.indexOf("asked = true;")).toBeLessThan(
      hook.indexOf("!navigator.geolocation"),
    );
  });

  // MESITA-2437: "fix use my location". A refused or failed ask used to be
  // dropped, so the button looked dead; now the state says why.
  it("a failed ask says why, and the button becomes Try again", () => {
    expect(locationErrorFromCode(1)).toBe("denied");
    expect(locationErrorFromCode(2)).toBe("unavailable");
    expect(locationErrorFromCode(3)).toBe("timeout");
    expect(turnOnLocationCopy(null)).toMatchObject({
      title: "Turn on location",
      action: "Use my location",
    });
    expect(turnOnLocationCopy("denied").title).toBe("Location is blocked");
    expect(turnOnLocationCopy("denied").description).toContain("site settings");
    expect(turnOnLocationCopy("unavailable").description).toContain("Location Services");
    for (const e of ["denied", "unavailable", "timeout", "unsupported"] as const)
      expect(turnOnLocationCopy(e).action).toBe("Try again");
    const hook = src("lib/use-user-location.ts");
    expect(hook).toContain("errorState = locationErrorFromCode(err.code);");
    expect(src("components/consumer/home/CatalogRails.tsx")).toContain(
      "turnOnLocationCopy(locationError)",
    );
  });
});
