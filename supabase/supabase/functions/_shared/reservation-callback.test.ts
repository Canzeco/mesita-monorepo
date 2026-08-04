import { assert, assertEquals } from "jsr:@std/assert@1";
import { GUEST_CALL_MAX_ATTEMPTS, nextGuestCallAt } from "./reservation-callback.ts";

// CDMX longitude → America/Mexico_City (UTC−6, no DST since 2022).
const LNG = -99.13;
/** A UTC instant whose CDMX wall clock is the given hour. */
const cdmx = (h: number, m = 0) => new Date(Date.UTC(2026, 7, 10, h + 6, m));

Deno.test("ladder: +10 min after attempt 1, +1 h after attempt 2", () => {
  const now = cdmx(14); // 14:00 local — deep inside the window
  const slot = cdmx(20);
  const r1 = nextGuestCallAt(1, LNG, slot, now);
  assertEquals(r1?.at.getTime(), now.getTime() + 10 * 60_000);
  const r2 = nextGuestCallAt(2, LNG, slot, now);
  assertEquals(r2?.at.getTime(), now.getTime() + 60 * 60_000);
});

Deno.test("cap: the guest is never rung a fourth time", () => {
  assertEquals(GUEST_CALL_MAX_ATTEMPTS, 3);
  assertEquals(nextGuestCallAt(3, LNG, cdmx(20), cdmx(14)), null);
  assertEquals(nextGuestCallAt(7, LNG, null, cdmx(14)), null);
});

Deno.test("cutoff: nothing lands within 30 min of the slot, or after it", () => {
  // 19:45 local, slot 20:00 → +10 min = 19:55 > 19:30 cutoff.
  assertEquals(nextGuestCallAt(1, LNG, cdmx(20), cdmx(19, 45)), null);
  // Slot already behind us — no call resurrects a passed reservation.
  assertEquals(nextGuestCallAt(1, LNG, cdmx(10), cdmx(14)), null);
});

Deno.test("quiet hours: a 23:00 retry holds for 09:00 local", () => {
  const now = cdmx(23); // 23:00 local — outside the window
  const slot = new Date(now.getTime() + 20 * 3600_000); // tomorrow, not urgent
  const r = nextGuestCallAt(1, LNG, slot, now);
  assert(r !== null);
  // Held to the window open — landed at 09:xx local, ≥ 9h after 23:00 + 10min.
  const localHour = (r.at.getTime() / 3600_000 - 6) % 24;
  assert(localHour >= 9 && localHour < 10, `landed at local ${localHour}`);
  assert(r.reason.includes("held"));
});

Deno.test("urgent: quiet hours are waived when the slot is < 6 h away", () => {
  const now = cdmx(23); // 23:00 local
  const slot = new Date(now.getTime() + 2 * 3600_000); // 01:00 — tonight
  const r = nextGuestCallAt(1, LNG, slot, now);
  assert(r !== null);
  assertEquals(r.at.getTime(), now.getTime() + 10 * 60_000); // fires at 23:10
  assert(r.reason.includes("urgent"));
});

Deno.test("no slot on file: ladder still paces, quiet hours still hold", () => {
  const r = nextGuestCallAt(1, LNG, null, cdmx(14));
  assertEquals(r?.at.getTime(), cdmx(14).getTime() + 10 * 60_000);
  const held = nextGuestCallAt(1, LNG, null, cdmx(23));
  assert(held !== null && held.reason.includes("held"));
});
