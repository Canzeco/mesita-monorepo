import { assert, assertEquals } from "jsr:@std/assert@1";
import { firstCallPlan, nextAttemptAt } from "./reservation-retry.ts";

// CDMX (UTC−6, no DST). 2026-08-10 is a Monday.
const ZONE = "America/Mexico_City";
const cdmx = (h: number, m = 0) => new Date(Date.UTC(2026, 7, 10, h + 6, m));
const MON_HOURS = { monday: [{ open: "13:00", close: "22:00" }] };
const min = (n: number) => n * 60_000;

Deno.test("a retry is 5 minutes later, open or closed", () => {
  const now = cdmx(9); // Monday 09:00, opens 13:00
  for (const hours of [MON_HOURS, null, {}, { monday: [] }, "junk"]) {
    const r = nextAttemptAt(hours, ZONE, now);
    assertEquals(r.at.getTime(), now.getTime() + min(5), JSON.stringify(hours));
    assert(r.reason.includes("5 min"));
  }
});

Deno.test("the first call rings now, including while the place is closed", () => {
  const closed = firstCallPlan(MON_HOURS, ZONE, cdmx(21), cdmx(3));
  assertEquals(closed.kind, "now");
  assertEquals(firstCallPlan(MON_HOURS, ZONE, cdmx(21), cdmx(14)).kind, "now");
  assertEquals(firstCallPlan(null, ZONE, cdmx(4), cdmx(3)).kind, "now");
  // A table 15 minutes after opening used to end the ticket. It rings now.
  assertEquals(firstCallPlan(MON_HOURS, ZONE, cdmx(13, 15), cdmx(3)).kind, "now");
});
