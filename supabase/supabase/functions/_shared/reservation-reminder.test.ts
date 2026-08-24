import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  REMINDER_LEAD_MS,
  REMINDER_MAX_ATTEMPTS,
  reminderCallAt,
  reminderParkPatch,
} from "./reservation-reminder.ts";

const LNG = -99.13;
const cdmx = (h: number, m = 0) => new Date(Date.UTC(2026, 7, 10, h + 6, m));

Deno.test("lead: parks exactly 3 h before the slot when that instant is callable", () => {
  const slot = cdmx(20);
  const now = cdmx(12);
  const r = reminderCallAt(LNG, slot, now);
  assert(r !== null);
  assertEquals(r.at.getTime(), slot.getTime() - REMINDER_LEAD_MS);
  assert(r.reason.includes("3 h"));
});

Deno.test("cap: one attempt, never a retry ladder", () => {
  assertEquals(REMINDER_MAX_ATTEMPTS, 1);
});

Deno.test("missed lead: confirming inside the 3 h window skips", () => {
  const slot = cdmx(20);
  const now = cdmx(18); // 2 h out — the 17:00 lead is already behind us
  assertEquals(reminderCallAt(LNG, slot, now), null);
});

Deno.test("cutoff: nothing lands within 30 min of the slot", () => {
  // A 20:00 slot's 3 h lead is 17:00; if quiet hours pushed past 19:30, skip.
  // A 08:00 slot → lead 05:00 → quiet hours nudge to 09:00, which is AFTER
  // the 07:30 cutoff → skip (and never a 6 a.m. ring).
  const slot = cdmx(8);
  const now = cdmx(4);
  assertEquals(reminderCallAt(LNG, slot, now), null);
});

Deno.test("quiet hours: a 07:00 lead holds for 09:00, never waived", () => {
  const slot = cdmx(10); // lead = 07:00 local
  const now = cdmx(6);
  const r = reminderCallAt(LNG, slot, now);
  assert(r !== null);
  const localHour = (r.at.getTime() / 3600_000 - 6) % 24;
  assert(localHour >= 9 && localHour < 10, `landed at local ${localHour}`);
  assert(r.reason.includes("held"));
});

Deno.test("no urgent waiver: a slot < 6 h away still will not ring at 23:00", () => {
  // Leg 3 WOULD waive quiet hours here. Leg 7 must not.
  const now = cdmx(23);
  const slot = new Date(now.getTime() + 5 * 3600_000); // 04:00 — inside 6 h
  assertEquals(reminderCallAt(LNG, slot, now), null);
});

Deno.test("app-only notify: park is skipped, no timestamp", () => {
  const p = reminderParkPatch(LNG, cdmx(20), "app", cdmx(12));
  assertEquals(p.reminder_state, "skipped");
  assertEquals(p.reminder_at, null);
});

Deno.test("call notify: a fitting window parks scheduled", () => {
  const p = reminderParkPatch(LNG, cdmx(20), "call", cdmx(12));
  assertEquals(p.reminder_state, "scheduled");
  assertEquals(p.reminder_at, new Date(cdmx(20).getTime() - REMINDER_LEAD_MS).toISOString());
});

Deno.test("no slot: skip", () => {
  assertEquals(reminderCallAt(LNG, null, cdmx(14)), null);
});
