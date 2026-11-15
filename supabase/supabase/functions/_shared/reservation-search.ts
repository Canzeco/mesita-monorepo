// Forgiving search over ONE place's reservations (MESITA-3956).
//
// Pato, 2026-11-14: "when the restaurant returns the call and says a
// reservation to this name at this date for this user ... the bot must be
// able to ... find the ticket ... among all the reservations tickets".
//
// decision: a ranked match over the place's own structured tickets, not a
// document-search (RAG) system — reservations are records, the place is known
// from its number, and the book of one place is small.
//
// The caller gives whatever they have — a name heard over the phone, a day,
// an hour, a party size — and every clue only RAISES or LOWERS a ticket's
// score; none is a hard filter, so a misheard name or a wrong hour still
// finds the table when the other clues agree. The agent reads the best match
// back to confirm before acting on it. Pure: no database, no clock of its own.

import { zoneDay, zoneTime } from "./local-time.ts";
import { ticketGuestName, type TicketNameParts } from "./reservation-guest-name.ts";

export type SearchClues = {
  name?: string;
  /** Place-local day: YYYY-MM-DD, "hoy", "mañana", "pasado mañana" or a weekday. */
  date?: string;
  /** Place-local hour: "20:30", "8", "8:30 pm" — "a las 8" means 8 or 20. */
  time?: string;
  party_size?: number;
};

export type SearchableTicket = TicketNameParts & { reserved_at: string; party_size: number; state: string };

// ── Names ────────────────────────────────────────────────────────────────────

/** Lowercase, accents off, letters and spaces only. */
export function plainName(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ").trim();
}

/**
 * How a Spanish name SOUNDS, so a phone mishearing collapses to the same key:
 * b/v, ll/y, s/z/c(e,i), qu/k/c(a,o,u), silent h, doubled letters.
 */
export function soundKey(word: string): string {
  return plainName(word)
    .replace(/ch/g, "1") // keep ch apart from c/h
    .replace(/qu/g, "k")
    .replace(/c([ei])/g, "s$1")
    .replace(/c/g, "k")
    .replace(/z/g, "s")
    .replace(/v/g, "b")
    .replace(/ll/g, "y")
    .replace(/h/g, "")
    .replace(/(.)\1+/g, "$1");
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

/** 0..1: how well one spoken word fits one word of the booked name. */
function wordFit(spoken: string, booked: string): number {
  if (!spoken || !booked) return 0;
  if (spoken === booked) return 1;
  if (soundKey(spoken) === soundKey(booked)) return 0.95;
  if (spoken.length >= 3 && booked.startsWith(spoken)) return 0.9;
  const a = soundKey(spoken);
  const b = soundKey(booked);
  const sim = 1 - editDistance(a, b) / Math.max(a.length, b.length);
  return sim >= 0.6 ? sim * 0.9 : 0;
}

/**
 * The words of a name without how people address it (MESITA-4075): "a nombre
 * de", señor/señora/señorita (sr, sra, srta), don/doña, familia, joven, and an
 * article right before one of them ("la señora López" → "lopez"). A lone "de"
 * stays: it is part of surnames like "de la Cruz".
 */
export function nameWords(s: string): string[] {
  return plainName(s)
    .replace(/(^|\s)a nombre de(?=\s|$)/g, " ")
    .replace(/(^|\s)(?:(?:el|la|los|las)\s+)?(?:senor|senora|senorita|sr|sra|srta|don|dona|familia|joven)(?=\s|$)/g, " ")
    .split(" ")
    .filter(Boolean);
}

/** Each spoken word's fit to its best word of the booked name. */
function wordFits(spoken: string, booked: string): number[] {
  const said = nameWords(spoken);
  const words = nameWords(booked);
  if (said.length === 0 || words.length === 0) return [];
  return said.map((s) => Math.max(...words.map((w) => wordFit(s, w))));
}

/** 0..1: every spoken word against its best word of the booked name, averaged. */
export function nameFit(spoken: string, booked: string): number {
  const fits = wordFits(spoken, booked);
  return fits.length ? fits.reduce((a, b) => a + b, 0) / fits.length : 0;
}

/**
 * Below this best single-word fit the spoken name is someone else's, and the
 * ticket is never offered, however well the day, hour and party agree
 * (MESITA-4075: "Roberto Méndez" must not find Ana López's table).
 */
export const NAME_GATE = 0.5;

// ── Day and hour ─────────────────────────────────────────────────────────────

const WEEKDAYS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const WEEKDAYS_EN = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = [
  ["enero", "january"],
  ["febrero", "february"],
  ["marzo", "march"],
  ["abril", "april"],
  ["mayo", "may"],
  ["junio", "june"],
  ["julio", "july"],
  ["agosto", "august"],
  ["septiembre", "september", "setiembre"],
  ["octubre", "october"],
  ["noviembre", "november"],
  ["diciembre", "december"],
];

/** Lowercase and accents off, digits and punctuation kept. */
function plainText(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** A real calendar day, or null (31 de febrero is not one). */
function isoDay(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return dt.getUTCMonth() === m - 1 ? dt.toISOString().slice(0, 10) : null;
}

/** Day d of month m, this year or, when that has passed, the next. */
function nextDayOfMonth(today: string, m: number, d: number): string | null {
  const y = Number(today.slice(0, 4));
  const thisYear = isoDay(y, m, d);
  if (thisYear && thisYear >= today) return thisYear;
  return isoDay(y + 1, m, d);
}

/**
 * The spoken day → place-local YYYY-MM-DD, or null when it can't be read.
 * Reads YYYY-MM-DD, d/m, "21 de noviembre", a bare "el 21" (the next 21st on
 * or after today), hoy / mañana / pasado mañana and a weekday, in Spanish or
 * English. A number beats a weekday: "el sábado 21" is the 21st.
 */
export function resolveDay(raw: string, now: Date, zone: string): string | null {
  const s = plainText(raw);
  const iso = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return iso[0];
  const today = zoneDay(now, zone);

  const dm = s.match(/(?:^|\D)(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?(?:\D|$)/);
  if (dm) {
    const d = Number(dm[1]);
    const m = Number(dm[2]);
    if (dm[3]) return isoDay(Number(dm[3].length === 2 ? `20${dm[3]}` : dm[3]), m, d);
    return nextDayOfMonth(today, m, d);
  }
  const monthIdx = MONTHS.findIndex((names) => names.some((n) => new RegExp(`\\b${n}\\b`).test(s)));
  const num = s.match(/(?:^|\D)(\d{1,2})(?:\D|$)/);
  if (monthIdx >= 0 && num) return nextDayOfMonth(today, monthIdx + 1, Number(num[1]));
  if (num && monthIdx < 0) {
    // A bare day of the month: the next one on or after today.
    const d = Number(num[1]);
    let [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
    for (let i = 0; i < 12; i++) {
      const day = isoDay(y, m, d);
      if (day && day >= today) return day;
      [y, m] = m === 12 ? [y + 1, 1] : [y, m + 1];
    }
    return null;
  }

  if (s === "hoy" || s === "today") return today;
  if (/\bpasado manana\b/.test(s)) return addDays(today, 2);
  if (s === "manana" || s === "tomorrow") return addDays(today, 1);
  let wd = WEEKDAYS.findIndex((w) => s.includes(w));
  if (wd < 0) wd = WEEKDAYS_EN.findIndex((w) => s.includes(w));
  if (wd >= 0) {
    const todayWd = new Date(`${today}T12:00:00Z`).getUTCDay();
    return addDays(today, (wd - todayWd + 7) % 7);
  }
  return null;
}

const HOUR_WORDS = ["una", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce"];

/**
 * The spoken hour → candidate minutes of the day. Reads digits ("20:30",
 * "8:30 pm") and words ("a las ocho", "ocho y media", "nueve y cuarto",
 * "nueve menos cuarto"). "de la tarde" / "de la noche" are p.m., "de la
 * mañana" a.m.; with none, 1–12 is either ("8" is 8:00 or 20:00, "12:30" is
 * 12:30 or 00:30).
 */
export function resolveMinutes(raw: string): number[] {
  const s = plainText(raw);
  let h: number;
  let min = 0;
  const digits = s.match(/(?:^|\D)(\d{1,2})(?:[:.h](\d{2}))?/);
  if (digits) {
    h = Number(digits[1]);
    min = digits[2] ? Number(digits[2]) : 0;
  } else {
    const word = HOUR_WORDS.findIndex((w) => new RegExp(`\\b${w}\\b`).test(s));
    if (word < 0 && !/\buno\b/.test(s)) return [];
    h = word < 0 ? 1 : word + 1;
  }
  if (h > 23 || min > 59) return [];
  if (!digits?.[2]) {
    if (/\by media\b/.test(s)) min = 30;
    else if (/\by cuarto\b/.test(s)) min = 15;
    else if (/\bmenos cuarto\b/.test(s)) {
      h = h - 1 || 12;
      min = 45;
    }
  }

  const night = /\bde la noche\b/.test(s);
  const pm = night || /\bde la tarde\b/.test(s) || /(?:^|[\s\d])p\.?\s?m\b/.test(s);
  const am = /\bde la manana\b/.test(s) || /(?:^|[\s\d])a\.?\s?m\b/.test(s);
  if (pm && h <= 12) return [h === 12 ? (night ? 0 : 12 * 60) + min : (h + 12) * 60 + min];
  if (am && h <= 12) return [(h % 12) * 60 + min];
  if (h >= 1 && h <= 11) return [h * 60 + min, (h + 12) * 60 + min];
  if (h === 12) return [12 * 60 + min, min];
  return [h * 60 + min];
}

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// ── Ranking ──────────────────────────────────────────────────────────────────

const W = { name: 3, date: 2, time: 1.5, party: 1 };
/** Below this share of the possible score a ticket is not offered at all. */
export const MATCH_FLOOR = 0.55;

export type RankedTicket<T> = { ticket: T; score: number };

/** A word fit at or above this is the same name (spelled or heard alike). */
const SAME_WORD = 0.95;

/**
 * The place's tickets that fit the clues, best first, at most `limit`. Each
 * given clue weighs in; a clue not given weighs nothing. A cancelled ticket
 * stays findable but ranks just below a live one that fits as well.
 */
export function rankTickets<T extends SearchableTicket>(
  tickets: T[],
  clues: SearchClues,
  zone: string,
  now: Date,
  limit = 3,
): RankedTicket<T>[] {
  // A name of only "la señora" is no name.
  const name = nameWords(clues.name ?? "").length ? clues.name!.trim() : "";
  const day = clues.date ? resolveDay(clues.date, now, zone) : null;
  const mins = clues.time ? resolveMinutes(clues.time) : [];
  const party = Number.isInteger(clues.party_size) && clues.party_size! > 0 ? clues.party_size! : null;

  let possible = 0;
  if (name) possible += W.name;
  if (day) possible += W.date;
  if (mins.length) possible += W.time;
  if (party) possible += W.party;
  if (possible === 0) return [];

  const ranked = tickets.flatMap((t) => {
    let got = 0;
    let exactName = false;
    if (name) {
      const fits = wordFits(name, ticketGuestName(t, ""));
      // A name was given and no word of it fits: someone else's table.
      if (!fits.length || Math.max(...fits) < NAME_GATE) return [];
      got += W.name * fits.reduce((a, b) => a + b, 0) / fits.length;
      exactName = fits.every((f) => f >= SAME_WORD);
    }
    const at = new Date(t.reserved_at);
    if (day) {
      const gap = Math.abs(Date.parse(`${zoneDay(at, zone)}T12:00:00Z`) - Date.parse(`${day}T12:00:00Z`)) / 86_400_000;
      got += W.date * (gap === 0 ? 1 : gap === 1 ? 0.35 : 0);
    }
    if (mins.length) {
      const booked = minutesOf(zoneTime(at, zone));
      const off = Math.min(...mins.map((m) => Math.abs(m - booked)));
      got += W.time * (off === 0 ? 1 : off <= 30 ? 0.7 : off <= 90 ? 0.35 : 0);
    }
    if (party) {
      const off = Math.abs(t.party_size - party);
      got += W.party * (off === 0 ? 1 : off === 1 ? 0.5 : 0);
    }
    const score = got / possible - (t.state === "cancelled" ? 0.01 : 0);
    return [{ ticket: t, score: Math.round(score * 1000) / 1000, exactName }];
  });

  // A ticket whose name is the one said ranks above one whose name only looks
  // like it (Ana before Juana), however the other clues fall; both still come
  // back, so a "no" moves on to the next (MESITA-4075).
  return ranked
    .filter((r) => r.score >= MATCH_FLOOR)
    .sort((a, b) =>
      Number(b.exactName) - Number(a.exactName) || b.score - a.score ||
      a.ticket.reserved_at.localeCompare(b.ticket.reserved_at)
    )
    .slice(0, limit)
    .map(({ ticket, score }) => ({ ticket, score }));
}
