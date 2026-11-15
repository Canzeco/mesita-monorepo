// MESITA-3957: a1 takes a time alone only inside the guest's window.
import { assertEquals } from "jsr:@std/assert@1";
import { judgeReportedTime, seatingEs, windowEdges } from "./reservation-legs.ts";

const Z = "America/Mexico_City"; // UTC-6, no DST
const AT = "2026-11-20T02:00:00.000Z"; // 20:00 on the 19th, place time

Deno.test("a time inside the window is a1's to take", () => {
  assertEquals(judgeReportedTime(AT, 30, "20:30", Z), { kind: "inside", iso: "2026-11-20T02:30:00.000Z" });
  assertEquals(judgeReportedTime(AT, 30, "19:30", Z), { kind: "inside", iso: "2026-11-20T01:30:00.000Z" });
});

Deno.test("a time outside the window needs the guest", () => {
  assertEquals(judgeReportedTime(AT, 30, "21:00", Z).kind, "outside");
  assertEquals(judgeReportedTime(AT, 0, "20:15", Z).kind, "outside");
  assertEquals(judgeReportedTime(AT, 60, "21:00", Z).kind, "inside");
});

Deno.test("the asked time is the same; garbage is invalid", () => {
  assertEquals(judgeReportedTime(AT, 0, "20:00", Z).kind, "same");
  assertEquals(judgeReportedTime(AT, 30, "8 pm", Z).kind, "invalid");
});

Deno.test("a window across midnight reads the nearest day", () => {
  const late = "2026-11-20T05:45:00.000Z"; // 23:45 place time
  assertEquals(judgeReportedTime(late, 30, "00:10", Z), { kind: "inside", iso: "2026-11-20T06:10:00.000Z" });
});

Deno.test("an exact time has no window; seating words", () => {
  assertEquals(windowEdges(AT, 0), null);
  assertEquals(windowEdges(AT, 30), { from: "2026-11-20T01:30:00.000Z", to: "2026-11-20T02:30:00.000Z" });
  assertEquals(seatingEs("outside"), "afuera");
  assertEquals(seatingEs("any"), "");
});
