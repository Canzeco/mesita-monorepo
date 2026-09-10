// _shared/es-speak.ts — the date and time an agent SAYS OUT LOUD, in es-MX.
//
// Every Reservationist surface reads a slot back to a human: the Booker tells
// the place when the table is for, the Confirmer reads it to the guest, and
// the lookup tools hand the agent `date_es` / `time_es` to speak. That string
// is a spoken word, not a rendered one — "sábado 2 de agosto", "8:30 p.m." —
// so it is fixed to es-MX and America/Mexico_City rather than derived from the
// place's longitude: the agents speak Mexico City time because the market is
// Mexico City, and one wording keeps a slot from being read back two ways
// across the two legs of the same call.
//
// A leaf on purpose. These lived in _shared/agent-tools.ts (which pulls in a
// Supabase client, the reservation write door and the ticket shapes), so the
// two EFs that only needed the formatting carried private copies instead.
//
// Both are total: an unparseable ISO string comes back unchanged rather than
// throwing, because a malformed timestamp must never take a live call down —
// the agent reads the raw value and the human hears something odd, which is
// recoverable in a way a 500 mid-call is not.

const TZ = "America/Mexico_City";
const LOCALE = "es-MX";

/** e.g. "sábado 2 de agosto". Returns `iso` untouched when it can't parse. */
export function esDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(LOCALE, {
      timeZone: TZ,
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** e.g. "8:30 p.m.". Returns `iso` untouched when it can't parse. */
export function esTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(LOCALE, {
      timeZone: TZ,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
