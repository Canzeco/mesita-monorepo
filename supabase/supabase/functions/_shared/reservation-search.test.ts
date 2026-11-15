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

// ── MESITA-4075: five defects found probing the search, and more scenarios ──

Deno.test("search: an unrelated name never matches, whatever the other clues say", () => {
  // Defect 1: Ana López's table fits day, hour and party; the name fits nothing.
  const clues = { name: "Roberto Méndez", date: "jueves", time: "20:00", party_size: 4 };
  assertEquals(rankTickets(book, clues, ZONE, NOW), []);
  // A name sharing one word with the booked name is still a partial clue.
  assertEquals(rankTickets(book, { name: "Ana Méndez", date: "jueves" }, ZONE, NOW)[0].ticket.id, "ana");
});

Deno.test("search: spoken hours are read", () => {
  // Defect 2.
  assertEquals(resolveMinutes("a las ocho"), [480, 1200]);
  assertEquals(resolveMinutes("ocho y media"), [510, 1230]);
  assertEquals(resolveMinutes("las 8 y media"), [510, 1230]);
  assertEquals(resolveMinutes("nueve y cuarto"), [555, 1275]);
  assertEquals(resolveMinutes("nueve menos cuarto"), [525, 1245]);
  assertEquals(resolveMinutes("la una y media"), [90, 810]);
  assertEquals(resolveMinutes("doce"), [720, 0]);
  assertEquals(resolveMinutes("8 de la noche"), [1200]);
  assertEquals(resolveMinutes("ocho y media de la noche"), [1230]);
  assertEquals(resolveMinutes("cinco de la tarde"), [1020]);
  assertEquals(resolveMinutes("diez de la mañana"), [600]);
  assertEquals(resolveMinutes("8:30 pm"), [1230]);
  assertEquals(resolveMinutes("tarde"), []);
});

Deno.test("search: spoken dates are read", () => {
  // Defect 3. NOW is Wednesday 2026-11-18.
  assertEquals(resolveDay("21 de noviembre", NOW, ZONE), "2026-11-21");
  assertEquals(resolveDay("el sábado 21 de noviembre", NOW, ZONE), "2026-11-21");
  assertEquals(resolveDay("el 21", NOW, ZONE), "2026-11-21");
  assertEquals(resolveDay("21/11", NOW, ZONE), "2026-11-21");
  assertEquals(resolveDay("el 18", NOW, ZONE), "2026-11-18");
  assertEquals(resolveDay("el 5", NOW, ZONE), "2026-12-05");
  assertEquals(resolveDay("3 de enero", NOW, ZONE), "2027-01-03");
  assertEquals(resolveDay("Saturday", NOW, ZONE), "2026-11-21");
  assertEquals(resolveDay("cuando sea", NOW, ZONE), null);
});

Deno.test("search: honorifics are not part of the name", () => {
  // Defect 4.
  assertEquals(nameFit("la señora López", "Ana López"), 1);
  assertEquals(nameFit("a nombre de don Javier", "Javier Vázquez"), 1);
  assertEquals(nameFit("Sra. Lozano", "Ana Lozano"), 1);
  assertEquals(rankTickets(book, { name: "la señora López" }, ZONE, NOW)[0].ticket.id, "ana");
  // "de" stays: it is part of surnames.
  assertEquals(nameFit("de la Cruz", "María de la Cruz"), 1);
});

Deno.test("search: 12:30 with no a.m./p.m. also finds a 00:30 table", () => {
  // Defect 5. Sat 21, 00:30 local.
  const late = [t("late", "Luis", "Mora", "2026-11-21T06:30:00Z", 2)];
  assertEquals(rankTickets(late, { name: "Luis Mora", time: "12:30" }, ZONE, NOW)[0].score, 1);
});

const twins = [
  t("thu", "Ana", "López", "2026-11-20T02:00:00Z", 4), // Thu 19, 20:00
  t("sat", "Ana", "López", "2026-11-22T02:30:00Z", 4), // Sat 21, 20:30
  t("juana", "Juana", "Ruiz", "2026-11-22T02:30:00Z", 4), // Sat 21, 20:30
  t("anaruiz", "Ana", "Ruiz", "2026-11-22T03:30:00Z", 4), // Sat 21, 21:30
  t("javier", "Javier", "Vázquez", "2026-11-21T03:30:00Z", 2), // Fri 20, 21:30
];

Deno.test("search: the same name twice — both come back, the day picks", () => {
  const ids = rankTickets(twins, { name: "Ana López" }, ZONE, NOW).map((r) => r.ticket.id);
  assertEquals(ids.slice(0, 2), ["thu", "sat"]);
  assertEquals(rankTickets(twins, { name: "Ana López", date: "sábado" }, ZONE, NOW)[0].ticket.id, "sat");
  assertEquals(rankTickets(twins, { name: "Ana López", date: "el 21" }, ZONE, NOW)[0].ticket.id, "sat");
});

Deno.test("search: a cancelled twin ranks just below the live one", () => {
  const pair = [
    t("gone", "Ana", "López", "2026-11-20T02:00:00Z", 4, "cancelled"),
    t("live", "Ana", "López", "2026-11-20T02:00:00Z", 4),
  ];
  const r = rankTickets(pair, { name: "Ana López", date: "jueves" }, ZONE, NOW);
  assertEquals(r.map((x) => x.ticket.id), ["live", "gone"]);
  assertEquals(Math.round((r[0].score - r[1].score) * 1000), 10);
});

Deno.test("search: a wrong hour with the right name and day is still found", () => {
  const r = rankTickets(twins, { name: "Ana López", date: "jueves", time: "14:00" }, ZONE, NOW);
  assertEquals(r[0].ticket.id, "thu");
});

Deno.test("search: a surname alone finds the table", () => {
  assertEquals(rankTickets(twins, { name: "Vázquez" }, ZONE, NOW)[0].ticket.id, "javier");
});

Deno.test("search: Ana vs Juana stays partial and never outranks an exact Ana", () => {
  const fit = nameFit("Ana", "Juana Ruiz");
  assert(fit > 0 && fit < 1, `partial, got ${fit}`);
  const r = rankTickets(twins, { name: "Ana Ruiz", date: "sábado", time: "ocho y media" }, ZONE, NOW);
  assertEquals(r[0].ticket.id, "anaruiz");
  const juana = r.find((x) => x.ticket.id === "juana");
  assert(!juana || juana.score < r[0].score);
  // Same day and hour for both: the exact Ana still wins.
  const same = [twins[2], { ...twins[3], reserved_at: twins[2].reserved_at }];
  assertEquals(rankTickets(same, { name: "Ana", date: "sábado", time: "20:30" }, ZONE, NOW)[0].ticket.id, "anaruiz");
});
