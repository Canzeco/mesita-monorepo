import { describe, expect, it } from "vitest";

import {
  applyRegionToAll,
  CHANNELS,
  channelsShareRegion,
  DEFAULT_CONFIG,
  DEFAULT_REGION,
  matchRegionCity,
  regionsEqual,
} from "./catalog";

describe("shared Where", () => {
  it("matches the CDMX pin", () => {
    expect(matchRegionCity(DEFAULT_REGION)).toBe("cdmx");
  });

  it("copies one region onto every channel", () => {
    const next = applyRegionToAll(DEFAULT_CONFIG, {
      ...DEFAULT_REGION,
      country: "MX",
      radiusKm: 40,
      restrict: true,
    });
    expect(channelsShareRegion(next)).toBe(true);
    expect(CHANNELS.every((ch) => next[ch.key].region.radiusKm === 40)).toBe(
      true,
    );
    expect(regionsEqual(next.admin_search.region, next.memo_search.region)).toBe(
      true,
    );
  });
});
