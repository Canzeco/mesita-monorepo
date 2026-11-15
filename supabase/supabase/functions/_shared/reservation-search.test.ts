// _shared/reservation-search.test.ts
//
// The place's lookup feeds a cancel: the wrong best match cancels another
// guest's table (an unwanted write). Pinned: a misheard name still finds the
// right table, the typed name beats the profile name, and a day or hour
// alone can tell two tables apart.

import { assert, assertEquals } from "jsr:@std/assert@1";
import { nameFit, rankTickets, resolveDay, resolveMinutes } from "./reservation-search.ts";

const ZONE = "America/Mexico_City";
// Wednesday 2026-11-18, 12:00 in Mexico City (UTC-6).
const NOW = new Date("2026-11-18T18:00:00Z");

const t = (id: string, first: string, last: string, at: string, party: number, state = "confirmed") => ({
  id,
  guest_first_name: first,
  guest_last_name: last,
  consumer: { full_name: "Pedro Ruiz", first_name: "Pedro", last_name: "Ruiz" },
  reserved_at: at,
  party_size: party,
  state,
});

const book = [
  t("ana", "Ana", "López", "2026-11-20T02:00:00Z", 4), // Thu 19, 20:00 local
  t("javier", "Javier", "Vázquez", "2026-11-21T03:30:00Z", 2), // Fri 20, 21:30 local
  t("ana2", "Ana", "Lozano", "2026-11-21T02:00:00Z", 6), // Fri 20, 20:00 local
];

Deno.test("search: a misheard name still finds the table", () => {
  assertEquals(rankTickets(book, { name: "Habier Basques" }, ZONE, NOW)[0].ticket.id, "javier");
  assertEquals(rankTickets(book, { name: "ana lopes" }, ZONE, NOW)[0].ticket.id, "ana");
  assert(nameFit("Lopez", "Ana López") === 1);
});

Deno.test("search: the typed name wins over the profile name", () => {
  assertEquals(rankTickets(book, { name: "Pedro Ruiz" }, ZONE, NOW), []);
  const older = [{ ...book[0], guest_first_name: null, guest_last_name: null }];
  assertEquals(rankTickets(older, { name: "pedro ruiz" }, ZONE, NOW).length, 1);
});

Deno.test("search: day, hour and party tell two Anas apart", () => {
  assertEquals(rankTickets(book, { name: "Ana", date: "viernes" }, ZONE, NOW)[0].ticket.id, "ana2");
  assertEquals(rankTickets(book, { name: "Ana", date: "mañana" }, ZONE, NOW)[0].ticket.id, "ana");
  assertEquals(rankTickets(book, { name: "Ana", party_size: 6 }, ZONE, NOW)[0].ticket.id, "ana2");
  assertEquals(rankTickets(book, { date: "2026-11-20", time: "9:30" }, ZONE, NOW)[0].ticket.id, "javier");
});

Deno.test("search: nothing close is nothing, and no clue is no search", () => {
  assertEquals(rankTickets(book, { name: "Roberto Méndez" }, ZONE, NOW), []);
  assertEquals(rankTickets(book, {}, ZONE, NOW), []);
});

Deno.test("search: spoken days and hours", () => {
  assertEquals(resolveDay("hoy", NOW, ZONE), "2026-11-18");
  assertEquals(resolveDay("pasado mañana", NOW, ZONE), "2026-11-20");
  assertEquals(resolveDay("el miércoles", NOW, ZONE), "2026-11-18");
  assertEquals(resolveMinutes("8"), [480, 1200]);
  assertEquals(resolveMinutes("8:30 pm"), [1230]);
  assertEquals(resolveMinutes("20:30"), [1230]);
  assertEquals(resolveMinutes("tarde"), []);
});
