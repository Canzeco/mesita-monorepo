import { assertEquals } from "jsr:@std/assert@1";
import {
  bookingHorizonDay,
  isBeyondBookingHorizon,
  rescheduleStateAllowed,
  slotHasPassed,
} from "./reservation-bounds.ts";

Deno.test("a slot has passed the moment its time is behind now", () => {
  const now = Date.parse("2026-11-20T03:00:00Z");
  assertEquals(slotHasPassed("2026-11-20T02:59:00Z", now), true);
  assertEquals(slotHasPassed("2026-11-20T03:00:00Z", now), false);
  assertEquals(slotHasPassed("2026-11-20T04:00:00Z", now), false);
});

Deno.test("only a pending or confirmed ticket can be rescheduled", () => {
  assertEquals(rescheduleStateAllowed("pending"), true);
  assertEquals(rescheduleStateAllowed("confirmed"), true);
  for (const state of ["cancelled", "declined", "unreachable", "unresolved"]) {
    assertEquals(rescheduleStateAllowed(state), false);
  }
});

Deno.test("the horizon is one calendar month on the place clock, and that day is allowed", () => {
  // 31 Jan in Mexico City is still 31 Jan (UTC-6).
  const now = new Date("2026-01-31T18:00:00Z");
  assertEquals(bookingHorizonDay(now, "America/Mexico_City"), "2026-02-28");
  const onHorizon = new Date("2026-02-28T20:00:00-06:00");
  const pastHorizon = new Date("2026-03-01T12:00:00-06:00");
  assertEquals(isBeyondBookingHorizon(onHorizon, now, "America/Mexico_City"), false);
  assertEquals(isBeyondBookingHorizon(pastHorizon, now, "America/Mexico_City"), true);
});
