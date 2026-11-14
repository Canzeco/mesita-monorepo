// MESITA-3954: a malformed feed is a silent failure — Google drops the whole
// calendar without telling the guest — so the two rules a calendar parser
// enforces are pinned: escaped text and folded lines.

import { assert, assertEquals } from "jsr:@std/assert@1";
import { buildCalendar, foldLine, icsText } from "./ics.ts";

Deno.test("icsText escapes the separators a parser splits on", () => {
  assertEquals(
    icsText("Calle 5, Roma; CDMX\nmesa\\2"),
    "Calle 5\\, Roma\\; CDMX\\nmesa\\\\2",
  );
});

Deno.test("foldLine keeps every line within 75 octets, multibyte intact", () => {
  const long = "SUMMARY:" + "Mesa en Café Ñandú ".repeat(10);
  const folded = foldLine(long);
  const enc = new TextEncoder();
  for (const part of folded.split("\r\n")) {
    assert(enc.encode(part).length <= 75);
  }
  assertEquals(folded.split("\r\n ").join(""), long);
});

Deno.test("buildCalendar writes one VEVENT per table, UTC, CRLF", () => {
  const ics = buildCalendar("Mesita", [
    {
      uid: "r1@mesita.ai",
      start: new Date("2026-11-20T02:00:00Z"),
      minutes: 120,
      title: "Table for 2 · Pujol",
      location: "Tennyson 133, Polanco",
      tentative: true,
    },
  ], new Date("2026-11-14T00:00:00Z"));
  assert(ics.startsWith("BEGIN:VCALENDAR\r\n"));
  assert(ics.endsWith("END:VCALENDAR\r\n"));
  assert(ics.includes("DTSTART:20261120T020000Z"));
  assert(ics.includes("DTEND:20261120T040000Z"));
  assert(ics.includes("LOCATION:Tennyson 133\\, Polanco"));
  assert(ics.includes("STATUS:TENTATIVE"));
  assertEquals(ics.match(/BEGIN:VEVENT/g)?.length, 1);
});
