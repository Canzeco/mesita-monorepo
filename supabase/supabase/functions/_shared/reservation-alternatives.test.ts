import { assertEquals } from "jsr:@std/assert@1";
import {
  alternativesToSpeech,
  matchesOffer,
  normalizeAlternatives,
} from "./reservation-alternatives.ts";

const TICKET_DATE = "2026-08-10";

Deno.test("normalize: structured entries survive, time is zero-padded", () => {
  const out = normalizeAlternatives([
    { time: "9:30", note: "en la terraza" },
    { time: "22:00", date: "2026-08-11" },
  ]);
  assertEquals(out, [
    { time: "09:30", note: "en la terraza" },
    { time: "22:00", date: "2026-08-11" },
  ]);
});

Deno.test("normalize: legacy prose keeps a time when it has one", () => {
  const out = normalizeAlternatives(["afuera a las 21:30", "solo barra"]);
  assertEquals(out[0].time, "21:30");
  assertEquals(out[1].time, ""); // no time to extract — spoken only
});

Deno.test("normalize: junk is dropped, list is capped", () => {
  assertEquals(normalizeAlternatives(null), []);
  assertEquals(normalizeAlternatives("nope"), []);
  assertEquals(normalizeAlternatives([{}, 7, true]).length, 0);
  assertEquals(normalizeAlternatives(Array(20).fill({ time: "20:00" })).length, 8);
});

Deno.test("normalize: a bad time is rejected, not coerced", () => {
  assertEquals(normalizeAlternatives([{ time: "25:00" }]).length, 0);
  assertEquals(normalizeAlternatives([{ time: "abc" }]).length, 0);
});

Deno.test("match: the place's own offer, same day", () => {
  const alts = normalizeAlternatives([{ time: "21:30" }]);
  assertEquals(matchesOffer(alts, TICKET_DATE, "21:30", TICKET_DATE), true);
  // Zero-padding only — "9:30" is 09:30, NOT half past nine at night. Guessing
  // that a bare "9:30" meant the 21:30 on offer would confirm a table twelve
  // hours from the one the guest agreed to, so it must NOT match. Converting
  // "nueve y media de la noche" into 21:30 is a2's job before it calls the
  // tool; the prompt demands 24-hour time for exactly this reason.
  assertEquals(matchesOffer(alts, TICKET_DATE, "9:30", TICKET_DATE), false);
  assertEquals(normalizeAlternatives([{ time: "9:30" }])[0].time, "09:30");
});

Deno.test("match: a brand-new proposal is NOT an offer", () => {
  const alts = normalizeAlternatives([{ time: "21:30" }]);
  // right time, wrong day
  assertEquals(matchesOffer(alts, "2026-08-11", "21:30", TICKET_DATE), false);
  // time the place never offered
  assertEquals(matchesOffer(alts, TICKET_DATE, "19:00", TICKET_DATE), false);
});

Deno.test("match: an offer for another day matches only on that day", () => {
  const alts = normalizeAlternatives([{ time: "20:00", date: "2026-08-11" }]);
  assertEquals(matchesOffer(alts, "2026-08-11", "20:00", TICKET_DATE), true);
  assertEquals(matchesOffer(alts, TICKET_DATE, "20:00", TICKET_DATE), false);
});

Deno.test("match: prose-only entries never auto-confirm", () => {
  // "solo barra" has no time — we must not skip the place call on a guess.
  const alts = normalizeAlternatives(["solo barra"]);
  assertEquals(matchesOffer(alts, TICKET_DATE, "21:30", TICKET_DATE), false);
});

Deno.test("match: no offers at all never confirms", () => {
  assertEquals(matchesOffer([], TICKET_DATE, "21:30", TICKET_DATE), false);
});

Deno.test("speech: reads back time, date and note", () => {
  const alts = normalizeAlternatives([
    { time: "21:30", note: "en la terraza" },
    { time: "20:00", date: "2026-08-11" },
  ]);
  assertEquals(
    alternativesToSpeech(alts),
    "21:30 — en la terraza · 2026-08-11 20:00",
  );
});
