import { describe, expect, it } from "vitest";
import {
  callMode,
  coerceConfig,
  DEFAULT_CONFIG,
  testNumberInvalid,
  withCallMode,
} from "./catalog";

describe("coerceConfig", () => {
  it("drops the retired keys a stored row may still carry", () => {
    const cfg = coerceConfig({
      priority: ["phone"],
      disabled: ["phone"],
      attempts: 7,
      testCall: {
        enabled: false,
        number: "+525555555555",
        consumerNumber: "+520000000000",
      },
    }) as Record<string, unknown>;
    expect(cfg).not.toHaveProperty("priority");
    expect(cfg).not.toHaveProperty("disabled");
    expect(cfg).not.toHaveProperty("attempts");
    expect(cfg.testCall).toEqual({
      enabled: false,
      number: "+525555555555",
      target: "number",
    });
  });

  it("falls back to the seed for a limit of 0, -1 or NaN", () => {
    for (const bad of [0, -1, Number.NaN]) {
      const { limits } = coerceConfig({
        limits: {
          reschedulesPerTicketPerDay: bad,
          placeCallsPerPlacePerDay: bad,
        },
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
      limits: {
        reschedulesPerTicketPerDay: 2.7,
        placeCallsPerPlacePerDay: 2.7,
      },
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

// MESITA-4149: the three call modes ride on testCall. Picking one must never
// lose the typed test number, and only the test-line mode needs it valid —
// otherwise switching to the guest's phone could block the save.
describe("call modes", () => {
  const t = {
    enabled: true,
    number: "+524445499597",
    target: "number" as const,
  };

  it("maps testCall to one of three modes and back", () => {
    expect(callMode(t)).toBe("number");
    expect(callMode(withCallMode(t, "guest"))).toBe("guest");
    expect(callMode(withCallMode(t, "production"))).toBe("production");
    expect(withCallMode(withCallMode(t, "guest"), "number")).toEqual(t);
    expect(withCallMode(t, "production").number).toBe(t.number);
  });

  it("needs a valid test number only in test-number mode", () => {
    const blank = { ...t, number: "" };
    expect(testNumberInvalid(blank)).toBe(true);
    expect(testNumberInvalid(withCallMode(blank, "guest"))).toBe(false);
    expect(testNumberInvalid(withCallMode(blank, "production"))).toBe(false);
  });

  it("reads a stored guest target; anything else is the test line", () => {
    expect(
      coerceConfig({ testCall: { enabled: true, number: "", target: "guest" } })
        .testCall.target,
    ).toBe("guest");
    expect(
      coerceConfig({ testCall: { enabled: true, number: "", target: "x" } })
        .testCall.target,
    ).toBe("number");
  });
});
