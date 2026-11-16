import { describe, expect, it } from "vitest";

import { reserveTimes } from "./reserve-times";

// Mexico City is UTC-6 all year: 16:00 local on Monday 2026-11-16 is 22:00Z.
const MON_4PM = Date.UTC(2026, 10, 16, 22, 0);
const week = (range: string) =>
  ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => ({ day, range }));

describe("reserveTimes (MESITA-4159)", () => {
  it("offers usual times an hour ahead, inside the hours, last table an hour before closing", () => {
    const t = reserveTimes({ hours_table: week("13:00–22:00"), timezone: "America/Mexico_City" }, MON_4PM);
    expect(t).toEqual([
      { day: "Today", time: "19:30" },
      { day: "Today", time: "20:00" },
      { day: "Today", time: "20:30" },
      { day: "Today", time: "21:00" },
    ]);
  });

  it("skips a closed day and times after closing", () => {
    const hours = week("13:00–20:00").map((r) => (r.day === "Tuesday" ? { ...r, range: "Closed" } : r));
    const t = reserveTimes({ hours_table: hours, timezone: "America/Mexico_City" }, MON_4PM);
    // Monday: 19:30 and later close too late (last table 19:00); Tuesday is closed.
    expect(t).toEqual([
      { day: "Wed", time: "14:30" },
      { day: "Thu", time: "14:30" },
      { day: "Fri", time: "14:30" },
      { day: "Sat", time: "14:30" },
    ]);
  });

  it("reads unknown hours as dinner, never as closed all week", () => {
    const t = reserveTimes({ hours_table: [], timezone: "America/Mexico_City" }, MON_4PM);
    expect(t.map((x) => x.time)).toEqual(["19:30", "20:00", "20:30", "21:00"]);
  });
});
