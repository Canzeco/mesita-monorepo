import { describe, expect, it } from "vitest";
import { hash32, PLAYGROUND_XX_SEED, unitDraw } from "./scores";

describe("unitDraw", () => {
  it("matches EF arity (seed, placeId, laneId) and FNV hash string", () => {
    const seed = "test:score-attach";
    const placeId = "A";
    const laneId = "organic" as const;
    const expected = hash32(`${seed}·${placeId}·${laneId}`) / 4294967296;
    expect(unitDraw(seed, placeId, laneId)).toBe(expected);
  });

  it("is stable for the playground seed and independent per lane", () => {
    const a = unitDraw(PLAYGROUND_XX_SEED, "place-1", "organic");
    const b = unitDraw(PLAYGROUND_XX_SEED, "place-1", "organic");
    const c = unitDraw(PLAYGROUND_XX_SEED, "place-1", "inorganic");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
  });

  it("does not use the legacy (placeId, laneId, roll) hash string", () => {
    const placeId = "place-1";
    const laneId = "organic" as const;
    const legacy = hash32(`${placeId}·${laneId}·1`) / 4294967296;
    expect(unitDraw(PLAYGROUND_XX_SEED, placeId, laneId)).not.toBe(legacy);
  });
});
