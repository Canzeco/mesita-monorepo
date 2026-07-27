// Reservation entity. Booking metadata only — no money fields. When a
// reservation has a coupon riding along with it (the auto-issued one
// from saving the place, or one specifically linked at booking time),
// the embedded `linkedCoupon` summary travels with the reservation so
// the card can render a "tied coupon" stub without a cross-lookup.

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

/** Compact coupon summary shown as a stub below a reservation card. */
export type LinkedCouponSummary = {
  id: string;
  percent: number;
  classLabel: string;
  kind: "normal" | "instagram";
  /** Lifecycle hint — surfaced as a small pill. Subset of the full status. */
  state: "active" | "pending";
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
  linkedCoupon?: LinkedCouponSummary;
};
