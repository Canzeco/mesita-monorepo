import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  classifyFailedConversation,
  classifyPlacementFailure,
  noticeNextAt,
  OUTAGE_MAX_RETRIES,
  outageRetryAt,
  PLACE_NOTICE_ATTEMPTS,
  placeCallDay,
} from "./reservation-run.ts";

Deno.test("placement: auth/quota/rate/5xx/network are OURS, validation is not", () => {
  for (const s of [401, 402, 403, 429, 500, 503, null, 0]) {
    assertEquals(classifyPlacementFailure(s), "platform", `status ${s}`);
  }
  for (const s of [400, 404, 422]) {
    assertEquals(classifyPlacementFailure(s), "target", `status ${s}`);
  }
});

Deno.test("failed conversation: 1002 is platform, unknown codes default to target", () => {
  assertEquals(classifyFailedConversation(1002), "platform");
  assertEquals(classifyFailedConversation(9999), "target");
  assertEquals(classifyFailedConversation(null), "target"); // plain no-answer
});

Deno.test("outage backoff: doubles from 15 min, jitters, caps at 8", () => {
  const now = new Date("2026-08-10T12:00:00Z");
  const mid = () => 0.5; // jitter factor exactly 1.0
  assertEquals(outageRetryAt(0, now, mid)!.at.getTime(), now.getTime() + 15 * 60_000);
  assertEquals(outageRetryAt(2, now, mid)!.at.getTime(), now.getTime() + 60 * 60_000);
  // Ceiling: 2^6 would be 960 min — clamped to 240.
  assertEquals(outageRetryAt(6, now, mid)!.at.getTime(), now.getTime() + 240 * 60_000);
  assertEquals(outageRetryAt(OUTAGE_MAX_RETRIES, now, mid), null);
  // Jitter bounds: ±20% of base.
  const lo = outageRetryAt(0, now, () => 0)!.at.getTime();
  const hi = outageRetryAt(0, now, () => 1)!.at.getTime();
  assertEquals(lo, now.getTime() + 12 * 60_000);
  assertEquals(hi, now.getTime() + 18 * 60_000);
  assert(outageRetryAt(0, now, mid)!.reason.includes("NOT charged"));
});

Deno.test("notice cap: place side stops at 2, guest side rides the ladder", () => {
  const now = new Date(Date.UTC(2026, 7, 10, 20)); // 14:00 CDMX
  const slot = new Date(now.getTime() + 24 * 3600_000);
  assert(noticeNextAt("place_cancel", 1, null, "America/Mexico_City", slot, now) !== null);
  assertEquals(noticeNextAt("place_cancel", PLACE_NOTICE_ATTEMPTS, null, "America/Mexico_City", slot, now), null);
  assert(noticeNextAt("guest_cancel", 1, null, "America/Mexico_City", slot, now) !== null);
  assertEquals(noticeNextAt("guest_cancel", 3, null, "America/Mexico_City", slot, now), null);
});

Deno.test("placeCallDay: the call meter counts the PLACE's day, not UTC's (MESITA-3626)", () => {
  // 01:30Z on Nov 21 is still Nov 20 in Mexico City (19:30) and Cancún (20:30)…
  const at = new Date("2026-11-21T01:30:00Z");
  assertEquals(placeCallDay("America/Mexico_City", at), "2026-11-20");
  assertEquals(placeCallDay("America/Cancun", at), "2026-11-20");
  // …and in Tijuana (17:30, UTC-8 in winter).
  assertEquals(placeCallDay("America/Tijuana", at), "2026-11-20");
  // 05:30Z: past midnight in Cancún (00:30) but not in Mexico City (23:30).
  const late = new Date("2026-11-21T05:30:00Z");
  assertEquals(placeCallDay("America/Cancun", late), "2026-11-21");
  assertEquals(placeCallDay("America/Mexico_City", late), "2026-11-20");
});
