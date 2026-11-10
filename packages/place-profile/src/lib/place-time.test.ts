import { describe, expect, it } from "vitest";
import { isSlotPast, placeDateTime, placeInstantIso, placeTz } from "./place-time";

// The reserved_at a guest's tap sends is the PLACE's wall clock in ITS zone
// (MESITA-3626) — a fixed -06:00 booked Cancún an hour late.
describe("placeInstantIso", () => {
  it("stamps Cancún's -05:00, all year", () => {
    expect(placeInstantIso("2026-11-20", "21:00", "America/Cancun")).toBe("2026-11-20T21:00:00-05:00");
    expect(placeInstantIso("2026-07-10", "21:00", "America/Cancun")).toBe("2026-07-10T21:00:00-05:00");
  });

  it("stamps Tijuana's offset in force at the slot (DST)", () => {
    expect(placeInstantIso("2026-07-10", "20:00", "America/Tijuana")).toBe("2026-07-10T20:00:00-07:00");
    expect(placeInstantIso("2026-12-11", "20:00", "America/Tijuana")).toBe("2026-12-11T20:00:00-08:00");
  });

  it("reads a missing or unknown zone as Mexico City", () => {
    expect(placeInstantIso("2026-11-20", "21:00", "")).toBe("2026-11-20T21:00:00-06:00");
    expect(placeInstantIso("2026-11-20", "21:00", "Not/AZone")).toBe("2026-11-20T21:00:00-06:00");
    expect(placeTz(null)).toBe("America/Mexico_City");
  });
});

describe("the place's clock", () => {
  it("splits an instant back into the place's date and time", () => {
    expect(placeDateTime("2026-11-21T02:00:00Z", "America/Cancun")).toEqual({ date: "2026-11-20", time: "21:00" });
    expect(placeDateTime("2026-11-21T02:00:00Z", "America/Mexico_City")).toEqual({ date: "2026-11-20", time: "20:00" });
  });

  it("judges a past slot on the place's clock, not the device's", () => {
    const at = Date.parse("2026-11-21T01:30:00Z"); // 20:30 Cancún, 19:30 CDMX
    expect(isSlotPast("2026-11-20", "20:00", "America/Cancun", at)).toBe(true);
    expect(isSlotPast("2026-11-20", "20:00", "America/Mexico_City", at)).toBe(false);
  });
});
