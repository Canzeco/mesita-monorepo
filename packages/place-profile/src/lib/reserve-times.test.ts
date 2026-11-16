import { describe, expect, it } from "vitest";

import { reserveTimes } from "./reserve-times";

// Mexico City is UTC-6 all year: 16:00 local on Monday 2026-11-16 is 22:00Z.
const MON_4PM = Date.UTC(2026, 10, 16, 22, 0);
const week = (range: string) =>
  ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => ({ day, range }));
const label = (t: { day: string; time: string }) => `${t.day} ${t.time}`;

describe("reserveTimes (MESITA-4176: every open half hour, next 24 hours)", () => {
  it("lists each half hour still open, last table an hour before closing, today then tomorrow", () => {
    const t = reserveTimes({ hours_table: week("13:00–22:00"), timezone: "America/Mexico_City" }, MON_4PM).map(label);
    expect(t[0]).toBe("Today 16:30");
    expect(t).toContain("Today 21:00");
    expect(t).not.toContain("Today 21:30");
    expect(t).toContain("Tomorrow 13:00");
    // The window ends 24 hours from now: tomorrow up to 16:00.
    expect(t[t.length - 1]).toBe("Tomorrow 16:00");
    expect(t).toHaveLength(10 + 7);
  });

  it("counts a shift running past midnight and skips a closed day", () => {
    const hours = week("13:00–03:00").map((r) => (r.day === "Tuesday" ? { ...r, range: "Closed" } : r));
    const t = reserveTimes({ hours_table: hours, timezone: "America/Mexico_City" }, MON_4PM).map(label);
    // Monday's shift runs to 03:00 Tuesday: the last table is 02:00.
    expect(t).toContain("Tomorrow 02:00");
    expect(t).not.toContain("Tomorrow 02:30");
    // Tuesday itself is closed.
    expect(t).not.toContain("Tomorrow 13:00");
  });

  it("reads unknown hours as tonight's dinner, never as closed", () => {
    const t = reserveTimes({ hours_table: [], timezone: "America/Mexico_City" }, MON_4PM);
    expect(t.map(label)).toEqual(["Today 19:30", "Today 20:00", "Today 20:30", "Today 21:00"]);
  });
});
