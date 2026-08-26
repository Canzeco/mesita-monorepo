import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) =>
  readFileSync(join(__dirname, "../..", rel), "utf8");

describe("Pay list is nearby plus name search, never Open", () => {
  it("loads the closest 50 listed places, not a global dump", () => {
    const src = read("components/consumer/rewards/PlacePickList.tsx");
    expect(src).toContain("apiFetchNearbyPlaces");
    expect(src).toContain("PAY_NEARBY_MAX");
    expect(src).toContain("apiSuggestPlaces");
    expect(src).not.toContain("apiFetchPublicPlaces");
    expect(src).not.toContain("hasOpen");
    expect(src).not.toContain("google: true");
  });

  it("wires Pay to device location with a Monterrey fallback", () => {
    const src = read("app/(shell)/new-visit/NewVisitClient.tsx");
    expect(src).toContain("useUserLocation");
    expect(src).toContain("MONTERREY_CENTER");
    expect(src).toContain("origin={origin}");
    expect(src).not.toContain("activePlaceIds");
  });
});
