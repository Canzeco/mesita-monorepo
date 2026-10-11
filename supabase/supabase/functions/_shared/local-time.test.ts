// Unit tests for the local-time / open-now helpers. Pure, no
// network/DB. isOpenNow reads the wall clock through localClock and delegates
// to the pure isOpenAt, which is what we pin down here.
//   deno test supabase/functions/_shared/local-time.test.ts

import { assertEquals } from "jsr:@std/assert@1";
import { mexicoZone, type WeeklyHours } from "./local-time.ts";
import { isOpenAt } from "./local-time-open.ts";

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
