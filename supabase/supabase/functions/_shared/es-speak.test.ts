import { assertEquals } from "jsr:@std/assert";
import { esDate, esTime } from "./es-speak.ts";

// What the Reservationist agents SAY. Fixed to es-MX / America/Mexico_City so
// the two legs of one call read a slot back the same way.

Deno.test("esDate: reads a slot as a spoken Mexico City date", () => {
  // 2026-08-02T02:30:00Z is 20:30 on Aug 1 in Mexico City (UTC-6) — the point
  // of pinning the zone: the UTC date and the spoken date are different days.
  assertEquals(esDate("2026-08-02T02:30:00Z"), "sábado, 1 de agosto");
});

Deno.test("esTime: reads a slot as a spoken Mexico City time", () => {
  assertEquals(esTime("2026-08-02T02:30:00Z"), "8:30 p.m.");
});

Deno.test("both stay on Mexico City across the UTC day boundary", () => {
  assertEquals(esDate("2026-08-02T05:59:00Z"), "sábado, 1 de agosto");
  assertEquals(esDate("2026-08-02T06:00:00Z"), "domingo, 2 de agosto");
});

Deno.test("an unparseable timestamp comes back untouched, never throws", () => {
  // A malformed value must not take a live call down: the agent reads something
  // odd, which is recoverable in a way a mid-call 500 is not.
  assertEquals(esDate("not-a-date"), "not-a-date");
  assertEquals(esTime("not-a-date"), "not-a-date");
  assertEquals(esDate(""), "");
});
