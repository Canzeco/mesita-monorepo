// v3c (MESITA-851) — the consumer report button: shared taxonomy + window.
//
// One home for the reason set and the "can this ticket still be reported?"
// rule, so the EF, the notification mapper and any future admin action all
// agree. The reason strings match the CHECK constraint on
// public.ticket_reports — change them together or the insert 23514s.

export const REPORT_REASONS = [
  "discount_refused",
  "closed_without_honoring",
  "qr_not_scanned",
  "other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export function isReportReason(v: unknown): v is ReportReason {
  return typeof v === "string" &&
    (REPORT_REASONS as readonly string[]).includes(v);
}

// Operator-facing one-liners. Consumer-facing copy lives in the apps (it is
// second-person and localised); these are for the admin inbox.
export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  discount_refused: "Discount refused",
  closed_without_honoring: "Closed without honoring",
  qr_not_scanned: "QR not scanned",
  other: "Other",
};

// How long after a ticket closes the guest can still report it. The issue's
// requirement is "some window after — a guest usually realizes outside the
// venue"; a week covers the walk home, the bank statement, and the next
// morning's second thought without leaving the inbox open forever.
export const REPORT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type ReportableTicket = {
  status: string;
  created_at: string;
  revealed_at?: string | null;
  cancelled_at?: string | null;
};

/**
 * A LIVE ticket is always reportable (the guest may be standing at the table
 * with a refused discount). A CLOSED one stays reportable for REPORT_WINDOW_MS
 * past whichever terminal stamp it carries, falling back to created_at when a
 * legacy row has none.
 */
export function isTicketReportable(
  ticket: ReportableTicket,
  now: number = Date.now(),
): boolean {
  const terminal = ticket.revealed_at ?? ticket.cancelled_at ?? null;
  if (!terminal) {
    // Still open (or a row that never got stamped) — reportable while the
    // window since creation holds, so an abandoned ticket doesn't stay
    // reportable forever either.
    if (ticket.status !== "revealed" && ticket.status !== "cancelled") {
      return true;
    }
    const created = Date.parse(ticket.created_at);
    return Number.isFinite(created) && now - created <= REPORT_WINDOW_MS;
  }
  const closed = Date.parse(terminal);
  if (!Number.isFinite(closed)) return true;
  return now - closed <= REPORT_WINDOW_MS;
}
