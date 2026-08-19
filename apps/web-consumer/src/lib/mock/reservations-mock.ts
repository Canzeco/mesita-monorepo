// Reservation entity. Booking metadata only — no money fields, and no
// reward surface: a discount is earned by SHOWING UP and lives on the visit
// ticket, which snapshots its own rates. Nothing is discounted for a table
// that might no-show.

// The ticket lifecycle the app renders. Derived from the DB row in
// lib/reservations-adapter.ts (reservationPhase) — never stored as-is:
//   created → booking → confirmed → passed, with cancelled / failed as exits.
export type ReservationStatus =
  | "created"
  | "booking"
  | "confirmed"
  | "passed"
  | "cancelled"
  | "failed";

export type ReservationAlternative = {
  time: string;
  date?: string;
  note?: string;
};

export type ReservationItem = {
  id: string;
  projectId: string;
  placeName: string;
  placePhoto: string | null;
  when: string;
  partySize: number;
  status: ReservationStatus;
  statusNote?: string;
  /** The 8-digit code the Reservationist speaks on calls (live rows only). */
  referenceCode?: string;
  /** Raw ISO instant — the reschedule sheet seeds its pickers from it. */
  reservedAt?: string;
  notes?: string;
  /** Live + still ahead of us → the guest can still call it off / move it. */
  canCancel?: boolean;
  canReschedule?: boolean;
  /** MESITA-787 */
  guestNotify?: "call" | "app";
  guestConfirmedAt?: string | null;
  /** Place counter-offers the guest can accept in-app. */
  alternatives?: ReservationAlternative[];
};
