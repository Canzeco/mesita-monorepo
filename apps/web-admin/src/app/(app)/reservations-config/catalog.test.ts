import { describe, expect, it } from "vitest";
import { coerceConfig, DEFAULT_CONFIG } from "./catalog";

describe("coerceConfig", () => {
  it("drops the retired keys a stored row may still carry", () => {
    const cfg = coerceConfig({
      priority: ["phone"],
      disabled: ["phone"],
      attempts: 7,
      testCall: { enabled: false, number: "+525555555555", consumerNumber: "+520000000000" },
    }) as Record<string, unknown>;
    expect(cfg).not.toHaveProperty("priority");
    expect(cfg).not.toHaveProperty("disabled");
    expect(cfg).not.toHaveProperty("attempts");
    expect(cfg.testCall).toEqual({ enabled: false, number: "+525555555555" });
  });

  it("falls back to the seed for a limit of 0, -1 or NaN", () => {
    for (const bad of [0, -1, Number.NaN]) {
      const { limits } = coerceConfig({
        limits: { reschedulesPerTicketPerDay: bad, placeCallsPerPlacePerDay: bad },
      });
      expect(limits.reschedulesPerTicketPerDay).toBe(
        DEFAULT_CONFIG.limits.reschedulesPerTicketPerDay,
      );
      expect(limits.placeCallsPerPlacePerDay).toBe(
        DEFAULT_CONFIG.limits.placeCallsPerPlacePerDay,
      );
    }
  });

  it("truncates a fractional limit", () => {
    const { limits } = coerceConfig({
      limits: { reschedulesPerTicketPerDay: 2.7, placeCallsPerPlacePerDay: 2.7 },
    });
    expect(limits.reschedulesPerTicketPerDay).toBe(2);
    expect(limits.placeCallsPerPlacePerDay).toBe(2);
  });

  it("returns the default config for a non-object input", () => {
    for (const raw of [null, undefined, "x", 42, ["phone"]]) {
      expect(coerceConfig(raw)).toBe(DEFAULT_CONFIG);
    }
  });
});
