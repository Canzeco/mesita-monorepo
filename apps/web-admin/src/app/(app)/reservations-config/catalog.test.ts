import { describe, expect, it } from "vitest";
import { coerceConfig, DEFAULT_CONFIG } from "./catalog";

describe("coerceConfig", () => {
  it("dedupes priority, ranks every channel once and drops legacy whatsapp", () => {
    const cfg = coerceConfig({ priority: ["phone", "phone", "whatsapp"] });
    expect(cfg.priority).toEqual(["phone"]);
  });

  it("appends a channel the row forgot to rank", () => {
    expect(coerceConfig({ priority: ["whatsapp"] }).priority).toEqual(["phone"]);
  });

  it("pins attempts to the protocol value whatever the row stores", () => {
    expect(coerceConfig({ attempts: 7 }).attempts).toBe(DEFAULT_CONFIG.attempts);
    expect(coerceConfig({ attempts: 7 }).attempts).toBe(2);
    expect(coerceConfig({}).attempts).toBe(2);
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
