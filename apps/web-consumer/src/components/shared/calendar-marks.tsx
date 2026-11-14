// The three calendars a guest's reservations feed goes to (MESITA-3979,
// Pato: "add the Icons of Google Calendar and his friends, that sad icon
// looks too sad"). Simplified app marks drawn inline, one per calendar,
// used wherever the app names that calendar: Reservations' header button
// and the rows of Me › Integrations › Calendar.
//
// Third-party app marks keep their own colours: the "no colour icons on Me"
// rule (MESITA-3579) is for Mesita's own row glyphs.

export type CalendarKind = "google" | "apple" | "outlook";

function GoogleCalendarMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect x="1" y="1" width="22" height="22" rx="5" fill="#fff" />
      {/* Blue top and left, yellow right, green bottom, red corner. */}
      <path d="M6 1h12v5H6z" fill="#4285F4" />
      <path d="M1 6a5 5 0 0 1 5-5v17H1z" fill="#1967D2" />
      <path d="M18 1a5 5 0 0 1 5 5v12h-5z" fill="#FBBC04" />
      <path d="M1 18h17v5H6a5 5 0 0 1-5-5z" fill="#34A853" />
      <path d="M18 18h5l-5 5z" fill="#EA4335" />
      <rect x="6" y="6" width="12" height="12" fill="#fff" />
      <text
        x="12"
        y="15.6"
        textAnchor="middle"
        fontSize="8.5"
        fontWeight="700"
        fontFamily="Arial, Helvetica, sans-serif"
        fill="#4285F4"
      >
        31
      </text>
    </svg>
  );
}

function AppleCalendarMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect x="1" y="1" width="22" height="22" rx="5" fill="#fff" stroke="#E5E5EA" strokeWidth="0.75" />
      <rect x="7" y="4.2" width="10" height="2.4" rx="1.2" fill="#FF3B30" />
      <text
        x="12"
        y="18.6"
        textAnchor="middle"
        fontSize="11"
        fontWeight="400"
        fontFamily="-apple-system, 'Helvetica Neue', Arial, sans-serif"
        fill="#1C1C1E"
      >
        31
      </text>
    </svg>
  );
}

function OutlookMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect x="1" y="1" width="22" height="22" rx="5" fill="#fff" />
      {/* The envelope behind, then the O tile in front. */}
      <rect x="9" y="5" width="12" height="14" rx="1.5" fill="#28A8EA" />
      <path d="M9 9l6 4 6-4" fill="none" stroke="#fff" strokeWidth="1.2" />
      <rect x="3" y="6.5" width="11" height="11" rx="1.5" fill="#0F6CBD" />
      <ellipse cx="8.5" cy="12" rx="2.6" ry="3.1" fill="none" stroke="#fff" strokeWidth="1.6" />
    </svg>
  );
}

const MARKS: Record<CalendarKind, (p: { size: number }) => React.ReactElement> = {
  google: GoogleCalendarMark,
  apple: AppleCalendarMark,
  outlook: OutlookMark,
};

export function CalendarMark({ kind, size = 20 }: { kind: CalendarKind; size?: number }) {
  const Mark = MARKS[kind];
  return <Mark size={size} />;
}

/** The three side by side, Google first. Overlapped, Apple's white tile
 *  disappeared behind Google's. */
export function CalendarMarksRow({ size = 20 }: { size?: number }) {
  const order: CalendarKind[] = ["google", "apple", "outlook"];
  return (
    <span className="flex items-center gap-1.5" aria-hidden>
      {order.map((kind) => (
        <CalendarMark key={kind} kind={kind} size={size} />
      ))}
    </span>
  );
}
