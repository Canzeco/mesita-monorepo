// Pins the on-the-spot confirm both doors write (reservation state is a
// data-loss class): eleven-a2-confirm-reservation on the phone, and
// consumer-web-confirm-reservation in the app. The literals below are the
// patches each door wrote before the shared builder (MESITA-2981).

import { assertEquals } from "jsr:@std/assert@1";
import { onTheSpotConfirmPatch, resolveRequestedSlot } from "./reservation-confirm.ts";

const LNG = -99.13;
// 2026-08-10 12:00 CDMX (UTC-6).
const NOW = new Date(Date.UTC(2026, 7, 10, 18, 0));
// The guest takes 20:00 that night; the reminder parks 3 h before.
const NEXT = new Date(Date.UTC(2026, 7, 11, 2, 0));

Deno.test("on-the-spot confirm: the a2 phone door's patch (notify call)", () => {
  const { date, time, next } = resolveRequestedSlot(
    "2026-08-10T01:00:00.000Z",
    "2026-08-10",
    " 20:00 ",
    { trim: false },
  );
  assertEquals(next?.toISOString(), NEXT.toISOString());
  assertEquals(
    onTheSpotConfirmPatch({
      next: next!,
      lng: LNG,
      notify: "call",
      lastCallState: `guest took the place's own ${date} ${time} offer — confirmed on the spot`,
      now: NOW,
    }),
    {
      reserved_at: "2026-08-11T02:00:00.000Z",
      state: "confirmed",
      reported_verdict: "confirmed",
      confirmed_at: NOW.toISOString(),
      consumer_confirmed_at: NOW.toISOString(),
      next_attempt_at: null,
      attempts_state: "answered",
      callback_state: "skipped",
      callback_next_attempt_at: null,
      reminder_state: "scheduled",
      reminder_at: "2026-08-10T23:00:00.000Z",
      // a2 never trimmed — the raw time rides into the note.
      last_call_state: "guest took the place's own 2026-08-10  20:00  offer — confirmed on the spot",
    },
  );
});

Deno.test("on-the-spot confirm: the app door's patch (notify app skips the reminder)", () => {
  const { date, time, next } = resolveRequestedSlot(
    "2026-08-10T01:00:00.000Z",
    " 2026-08-10 ",
    "20:00",
    { trim: true },
  );
  assertEquals(
    onTheSpotConfirmPatch({
      next: next!,
      lng: LNG,
      notify: "app",
      lastCallState:
        `guest took the place's own ${date} ${time} offer in the app — confirmed on the spot`,
      now: NOW,
    }),
    {
      reserved_at: "2026-08-11T02:00:00.000Z",
      state: "confirmed",
      reported_verdict: "confirmed",
      confirmed_at: NOW.toISOString(),
      consumer_confirmed_at: NOW.toISOString(),
      next_attempt_at: null,
      attempts_state: "answered",
      callback_state: "skipped",
      callback_next_attempt_at: null,
      reminder_state: "skipped",
      reminder_at: null,
      last_call_state: "guest took the place's own 2026-08-10 20:00 offer in the app — confirmed on the spot",
    },
  );
});

Deno.test("requested slot: a missing half defaults from the current reservation", () => {
  // 2026-08-10T01:00Z is 2026-08-09 19:00 in CDMX.
  const r = resolveRequestedSlot("2026-08-10T01:00:00.000Z", undefined, "21:30", { trim: true });
  assertEquals([r.date, r.time], ["2026-08-09", "21:30"]);
  const s = resolveRequestedSlot("2026-08-10T01:00:00.000Z", "2026-08-12", "  ", { trim: false });
  assertEquals([s.date, s.time], ["2026-08-12", "19:00"]);
  assertEquals(resolveRequestedSlot("2026-08-10T01:00:00.000Z", "12/08", "x", { trim: true }).next, null);
});
