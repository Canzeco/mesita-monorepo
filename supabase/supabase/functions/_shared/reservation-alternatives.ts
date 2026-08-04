// The alternatives a venue offers when it can't take the requested slot.
//
// WHY THIS EXISTS: they used to be stored as `string[]` of speakable prose
// ("afuera a las 10"). That reads fine to a human and is useless to code —
// nothing could tell whether the guest's answer was one of the venue's OWN
// offers or a brand-new idea. So both were treated the same: re-call the
// venue, then call the guest back. A guest who simply accepted 21:30 —
// a slot the venue had itself just volunteered — got TWO calls and the venue
// got a second call asking for something it had already offered. Four calls
// for one booking.
//
// Structured entries make the distinction decidable, which is what lets
// eleven-a2-confirm-reservation confirm on the spot (see matchesOffer).
//
// Legacy rows hold plain strings. Everything here accepts both shapes.

/** One option the venue volunteered. `date` omitted = same day as the ticket. */
export type VenueAlternative = {
  /** Venue-local 24h "HH:mm". */
  time: string;
  /** Venue-local "YYYY-MM-DD". Absent means the ticket's existing date. */
  date?: string;
  /** Anything else the venue said about it: "en la terraza", "sin ventana". */
  note?: string;
};

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "9:30" → "09:30" so string comparison is safe. */
function padTime(t: string): string | null {
  const m = HHMM.exec(t.trim());
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

/**
 * Coerce whatever is stored (or whatever the agent sent) into structured
 * entries. Unparseable items survive as a `note` with no time — they still
 * read back to the guest, they just can't be matched against.
 */
export function normalizeAlternatives(raw: unknown): VenueAlternative[] {
  if (!Array.isArray(raw)) return [];
  const out: VenueAlternative[] = [];
  for (const item of raw.slice(0, 8)) {
    if (typeof item === "string") {
      // Legacy prose. Pull a time out of it when there is one so old rows
      // still benefit from matching; otherwise keep it as a spoken note.
      const t = /\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(item);
      out.push(
        t
          ? { time: `${t[1].padStart(2, "0")}:${t[2]}`, note: item.trim().slice(0, 120) }
          : { time: "", note: item.trim().slice(0, 120) },
      );
      continue;
    }
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      const time = typeof o.time === "string" ? padTime(o.time) : null;
      const date = typeof o.date === "string" && ISO_DATE.test(o.date.trim())
        ? o.date.trim()
        : undefined;
      const note = typeof o.note === "string" ? o.note.trim().slice(0, 120) : undefined;
      if (time || note) out.push({ time: time ?? "", ...(date ? { date } : {}), ...(note ? { note } : {}) });
    }
  }
  return out;
}

/** One speakable line for the a2 leg's `venue_alternatives` variable. */
export function alternativesToSpeech(alts: VenueAlternative[]): string {
  return alts
    .map((a) => {
      const when = [a.date, a.time].filter(Boolean).join(" ");
      return [when, a.note].filter(Boolean).join(" — ");
    })
    .filter(Boolean)
    .join(" · ");
}

/**
 * Did the guest pick one of the venue's OWN offers?
 *
 * That is the whole question. If yes, the venue has already said that slot is
 * available, so Mesita does not need to phone it again to ask — and does not
 * need to phone the guest back to report an answer they just gave. If no (a
 * genuinely new proposal), the venue has never agreed and must be asked.
 *
 * `ticketDate` supplies the day for entries that only carried a time.
 */
export function matchesOffer(
  alts: VenueAlternative[],
  wantDate: string,
  wantTime: string,
  ticketDate: string,
): boolean {
  const t = padTime(wantTime);
  if (!t) return false;
  return alts.some((a) => {
    if (!a.time) return false; // prose-only entry — never auto-confirm on it
    return a.time === t && (a.date ?? ticketDate) === wantDate;
  });
}
