import { assertEquals } from "jsr:@std/assert@1";
import { slotInHours } from "./reservation-hours.ts";
import { zonedInstant } from "./local-time.ts";

const ZONE = "America/Mexico_City";
// 2026-11-15 is a Sunday.
const at = (date: string, time: string) => zonedInstant(date, time, ZONE)!;

const HOURS = {
  sunday: [{ open: "14:00", close: "18:00" }],
  tuesday: [{ open: "13:00", close: "15:00" }, { open: "19:00", close: "23:00" }],
  saturday: [{ open: "23:00", close: "02:00" }],
};

Deno.test("slotInHours: inside a shift, up to one hour before closing", () => {
  assertEquals(slotInHours(HOURS, ZONE, at("2026-11-15", "14:00")), true);
  assertEquals(slotInHours(HOURS, ZONE, at("2026-11-15", "17:00")), true);
  assertEquals(slotInHours(HOURS, ZONE, at("2026-11-15", "17:30")), false);
  assertEquals(slotInHours(HOURS, ZONE, at("2026-11-15", "18:00")), false);
  assertEquals(slotInHours(HOURS, ZONE, at("2026-11-15", "13:30")), false);
});

Deno.test("slotInHours: a closed day and the gap between shifts are refused", () => {
  assertEquals(slotInHours(HOURS, ZONE, at("2026-11-16", "20:00")), false);
  assertEquals(slotInHours(HOURS, ZONE, at("2026-11-17", "14:00")), true);
  assertEquals(slotInHours(HOURS, ZONE, at("2026-11-17", "16:00")), false);
  assertEquals(slotInHours(HOURS, ZONE, at("2026-11-17", "22:00")), true);
});

Deno.test("slotInHours: an overnight shift carries to midnight; 00:00–06:00 is never booked (MESITA-4185)", () => {
  assertEquals(slotInHours(HOURS, ZONE, at("2026-11-21", "23:30")), true);
  // Saturday's shift runs to 02:00, but no table is booked after midnight.
  assertEquals(slotInHours(HOURS, ZONE, at("2026-11-22", "00:00")), false);
  assertEquals(slotInHours(HOURS, ZONE, at("2026-11-22", "01:00")), false);
  const allDay = { sunday: [{ open: "00:00", close: "23:59" }] };
  assertEquals(slotInHours(allDay, ZONE, at("2026-11-15", "05:30")), false);
  assertEquals(slotInHours(allDay, ZONE, at("2026-11-15", "06:00")), true);
});

Deno.test("slotInHours: the place's zone decides, not UTC", () => {
  // 17:00 in Cancún (UTC-5) is 16:00 in Mexico City.
  const cancun = zonedInstant("2026-11-15", "17:30", "America/Cancun")!;
  assertEquals(slotInHours(HOURS, "America/Cancun", cancun), false);
  assertEquals(slotInHours(HOURS, ZONE, cancun), true);
});

Deno.test("slotInHours: no usable hours lets a daytime time through, never 00:00–06:00", () => {
  assertEquals(slotInHours(null, ZONE, at("2026-11-15", "13:00")), null);
  assertEquals(slotInHours({}, ZONE, at("2026-11-15", "13:00")), null);
  assertEquals(slotInHours({ sunday: [] }, ZONE, at("2026-11-15", "13:00")), null);
  assertEquals(slotInHours(null, ZONE, at("2026-11-15", "03:00")), false);
});
