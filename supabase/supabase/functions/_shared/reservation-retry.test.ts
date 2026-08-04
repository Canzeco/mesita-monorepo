import { assert, assertEquals } from "jsr:@std/assert@1";
import { nextAttemptAt } from "./reservation-retry.ts";

// CDMX (UTC−6, no DST). Weekday helpers pin known dates: 2026-08-10 is a Monday.
const LNG = -99.13;
const cdmx = (h: number, m = 0) => new Date(Date.UTC(2026, 7, 10, h + 6, m));
const MON_HOURS = { monday: [{ open: "13:00", close: "22:00" }] };
const min = (n: number) => n * 60_000;

Deno.test("open now → +5 min", () => {
  const now = cdmx(14); // Monday 14:00, inside 13–22
  const r = nextAttemptAt(MON_HOURS, LNG, now);
  assertEquals(r.at.getTime(), now.getTime() + min(5));
  assert(r.reason.includes("open now"));
});

Deno.test("unknown hours behave like open — never park a guest on missing data", () => {
  for (const hours of [null, {}, { monday: [] }, "junk"]) {
    const r = nextAttemptAt(hours, LNG, cdmx(3));
    assertEquals(r.at.getTime(), cdmx(3).getTime() + min(5), JSON.stringify(hours));
  }
});

Deno.test("closed today, opens later today → 30 min after opening", () => {
  const now = cdmx(9); // Monday 09:00, opens 13:00
  const r = nextAttemptAt(MON_HOURS, LNG, now);
  // 4 h until opening + 30 min courtesy.
  assertEquals(r.at.getTime(), now.getTime() + min(4 * 60 + 30));
  assert(r.reason.includes("after it opens"));
});

Deno.test("today's opening already passed → next week's slot, not a past one", () => {
  const now = cdmx(23); // Monday 23:00, closed; only Monday has hours
  const r = nextAttemptAt(MON_HOURS, LNG, now);
  // 1 h to midnight + 6 full days + 13 h to opening = 158 h, +30 min.
  assertEquals(r.at.getTime(), now.getTime() + min(158 * 60 + 30));
});

Deno.test("multi-day week: picks the NEAREST opening across days", () => {
  const hours = {
    monday: [{ open: "13:00", close: "22:00" }],
    wednesday: [{ open: "09:00", close: "17:00" }],
  };
  const now = cdmx(23); // Monday night → Wednesday 09:00 is nearest
  const r = nextAttemptAt(hours, LNG, now);
  // 1 h to midnight + 24 h Tuesday + 9 h into Wednesday = 34 h, +30 min.
  assertEquals(r.at.getTime(), now.getTime() + min(34 * 60 + 30));
});

Deno.test("two ranges in one day: the later one counts once the first passed", () => {
  const hours = {
    monday: [{ open: "08:00", close: "11:00" }, { open: "18:00", close: "23:00" }],
  };
  const now = cdmx(12); // between services
  const r = nextAttemptAt(hours, LNG, now);
  assertEquals(r.at.getTime(), now.getTime() + min(6 * 60 + 30));
});

Deno.test("garbage ranges inside real hours are skipped, not fatal", () => {
  const hours = {
    monday: [{ open: "nope" }, { open: "18:00", close: "23:00" }],
  };
  const now = cdmx(12);
  const r = nextAttemptAt(hours, LNG, now);
  assertEquals(r.at.getTime(), now.getTime() + min(6 * 60 + 30));
});
