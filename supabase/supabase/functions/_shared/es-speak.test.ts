import { assertEquals } from "jsr:@std/assert";
import { esDate, esTime } from "./es-speak.ts";

// What the Reservationist agents SAY: es-MX, in the PLACE's zone
// (MESITA-3626), so the place, the guest and every tool read one slot the
// same way.
const CDMX = "America/Mexico_City";

Deno.test("esDate: reads a slot as a spoken Mexico City date", () => {
  // 2026-08-02T02:30:00Z is 20:30 on Aug 1 in Mexico City (UTC-6) — the point
  // of pinning the zone: the UTC date and the spoken date are different days.
  assertEquals(esDate("2026-08-02T02:30:00Z", CDMX), "sábado, 1 de agosto");
});

Deno.test("esTime: reads a slot as a spoken Mexico City time", () => {
  assertEquals(esTime("2026-08-02T02:30:00Z", CDMX), "8:30 p.m.");
});

Deno.test("both stay on Mexico City across the UTC day boundary", () => {
  assertEquals(esDate("2026-08-02T05:59:00Z", CDMX), "sábado, 1 de agosto");
  assertEquals(esDate("2026-08-02T06:00:00Z", CDMX), "domingo, 2 de agosto");
});

Deno.test("Cancún hears its own clock: one hour ahead of Mexico City, all year", () => {
  // 21:00 in Cancún (UTC-5, no DST) is 02:00Z the next day.
  assertEquals(esTime("2026-11-21T02:00:00Z", "America/Cancun"), "9:00 p.m.");
  assertEquals(esDate("2026-11-21T02:00:00Z", "America/Cancun"), "viernes, 20 de noviembre");
  assertEquals(esTime("2026-11-21T02:00:00Z", CDMX), "8:00 p.m.");
});

Deno.test("Tijuana hears its own clock, DST included", () => {
  // Summer: Tijuana is UTC-7 → 20:00 local is 03:00Z.
  assertEquals(esTime("2026-07-11T03:00:00Z", "America/Tijuana"), "8:00 p.m.");
  // Winter: UTC-8 → 20:00 local is 04:00Z.
  assertEquals(esTime("2026-12-12T04:00:00Z", "America/Tijuana"), "8:00 p.m.");
  assertEquals(esDate("2026-12-12T04:00:00Z", "America/Tijuana"), "viernes, 11 de diciembre");
});

Deno.test("a bad zone falls back to Mexico City, never throws", () => {
  assertEquals(esTime("2026-08-02T02:30:00Z", "Not/AZone"), "8:30 p.m.");
});

Deno.test("an unparseable timestamp comes back untouched, never throws", () => {
  // A malformed value must not take a live call down: the agent reads something
  // odd, which is recoverable in a way a mid-call 500 is not.
  assertEquals(esDate("not-a-date", CDMX), "not-a-date");
  assertEquals(esTime("not-a-date", CDMX), "not-a-date");
  assertEquals(esDate("", CDMX), "");
});
