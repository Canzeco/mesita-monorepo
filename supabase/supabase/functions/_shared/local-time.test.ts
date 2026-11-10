// Unit tests for the local-time helpers and the pure open/closed check
// isOpenAt. No network, no DB, no wall clock.
//   deno test supabase/functions/_shared/local-time.test.ts

import { assertEquals } from "jsr:@std/assert@1";
import {
  isOpenAt,
  mexicoZone,
  placeZone,
  type WeeklyHours,
  zonedInstant,
  zoneMonthStart,
  zoneOffsetMinutes,
} from "./local-time.ts";

// Fri 6pm–2am (overnight), plus a same-day lunch shift on Saturday.
const HOURS: WeeklyHours = {
  friday: [{ open: "18:00", close: "02:00" }],
  saturday: [{ open: "13:00", close: "16:00" }],
};

Deno.test("isOpenAt: same-day range is a half-open interval", () => {
  // Saturday 13:00–16:00
  assertEquals(isOpenAt(HOURS, "saturday", 12 * 60 + 59), false); // 12:59 before open
  assertEquals(isOpenAt(HOURS, "saturday", 13 * 60), true); // 13:00 open edge
  assertEquals(isOpenAt(HOURS, "saturday", 15 * 60 + 30), true); // mid
  assertEquals(isOpenAt(HOURS, "saturday", 16 * 60), false); // 16:00 close edge (exclusive)
});

Deno.test("isOpenAt: overnight range spills into the next day", () => {
  // Friday 18:00 → Saturday 02:00
  assertEquals(isOpenAt(HOURS, "friday", 17 * 60 + 59), false); // Fri 17:59 before open
  assertEquals(isOpenAt(HOURS, "friday", 18 * 60), true); // Fri 18:00 open
  assertEquals(isOpenAt(HOURS, "friday", 23 * 60 + 59), true); // Fri 23:59 still open
  assertEquals(isOpenAt(HOURS, "saturday", 1 * 60), true); // Sat 01:00 spillover from Fri
  assertEquals(isOpenAt(HOURS, "saturday", 2 * 60), false); // Sat 02:00 close edge
  assertEquals(isOpenAt(HOURS, "saturday", 2 * 60 + 30), false); // Sat 02:30 after overnight close, before lunch
});

Deno.test("isOpenAt: closed day (key omitted) reads as closed, not unknown", () => {
  // Monday has no key and no overnight spillover from Sunday → false (data
  // exists, this place just isn't open Mondays).
  assertEquals(isOpenAt(HOURS, "monday", 12 * 60), false);
});

Deno.test("isOpenAt: no/blank hours data is unknown (null), never penalised", () => {
  assertEquals(isOpenAt(null, "friday", 720), null);
  assertEquals(isOpenAt({}, "friday", 720), null);
  assertEquals(isOpenAt({ friday: [] }, "friday", 720), null); // no real day keys with ranges
});

Deno.test("isOpenAt: malformed range times are skipped, not crashed", () => {
  const bad: WeeklyHours = {
    // Valid saturday range coexists with a garbage one so the array still
    // registers as "has hours data" (not null).
    saturday: [
      { open: "oops", close: "nope" },
      { open: "13:00", close: "16:00" },
    ],
  };
  assertEquals(isOpenAt(bad, "saturday", 14 * 60), true); // matched the valid range
  assertEquals(isOpenAt(bad, "saturday", 20 * 60), false); // valid range closed, bad one ignored
});

Deno.test("mexicoZone: longitude bands", () => {
  assertEquals(mexicoZone(null), "America/Mexico_City");
  assertEquals(mexicoZone(-116), "America/Tijuana"); // Baja
  assertEquals(mexicoZone(-99), "America/Mexico_City"); // CDMX
  assertEquals(mexicoZone(-86), "America/Cancun"); // Quintana Roo
});

// ── One zone per place (MESITA-3626) ──────────────────────────────────────

Deno.test("placeZone: the stamped zone wins; else the longitude guess; else Mexico City", () => {
  assertEquals(placeZone({ timezone: "America/Cancun", lng: -99 }), "America/Cancun");
  assertEquals(placeZone({ timezone: "America/Hermosillo", lng: -111 }), "America/Hermosillo");
  assertEquals(placeZone({ timezone: null, lng: -116 }), "America/Tijuana");
  assertEquals(placeZone({ timezone: "Not/AZone", lng: -86 }), "America/Cancun");
  assertEquals(placeZone(null), "America/Mexico_City");
});

Deno.test("zonedInstant: a place-local slot is the right instant in Cancún (UTC-5, no DST)", () => {
  assertEquals(zonedInstant("2026-11-20", "21:00", "America/Cancun")?.toISOString(), "2026-11-21T02:00:00.000Z");
  assertEquals(zonedInstant("2026-07-10", "21:00", "America/Cancun")?.toISOString(), "2026-07-11T02:00:00.000Z");
});

Deno.test("zonedInstant: Tijuana's offset follows its DST", () => {
  // Summer UTC-7, winter UTC-8.
  assertEquals(zonedInstant("2026-07-10", "20:00", "America/Tijuana")?.toISOString(), "2026-07-11T03:00:00.000Z");
  assertEquals(zonedInstant("2026-12-11", "20:00", "America/Tijuana")?.toISOString(), "2026-12-12T04:00:00.000Z");
  assertEquals(zoneOffsetMinutes("America/Tijuana", new Date("2026-07-11T03:00:00Z")), -420);
  assertEquals(zoneOffsetMinutes("America/Tijuana", new Date("2026-12-12T04:00:00Z")), -480);
});

Deno.test("zonedInstant: Mexico City is UTC-6; a malformed pair is null", () => {
  assertEquals(zonedInstant("2026-08-09", "19:00", "America/Mexico_City")?.toISOString(), "2026-08-10T01:00:00.000Z");
  assertEquals(zonedInstant("12/08", "19:00", "America/Mexico_City"), null);
  assertEquals(zonedInstant("2026-08-09", "7pm", "America/Mexico_City"), null);
});

Deno.test("zoneMonthStart: the guest's month is Mexico City's", () => {
  // 03:00Z on Dec 1 is still Nov 30 in Mexico City.
  assertEquals(
    zoneMonthStart(new Date("2026-12-01T03:00:00Z"), "America/Mexico_City").toISOString(),
    "2026-11-01T06:00:00.000Z",
  );
  assertEquals(
    zoneMonthStart(new Date("2026-12-01T07:00:00Z"), "America/Mexico_City").toISOString(),
    "2026-12-01T06:00:00.000Z",
  );
});
