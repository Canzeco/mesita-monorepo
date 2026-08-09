// Reservation entity. Booking metadata only — no money fields. When a
// reservation has a coupon riding along with it (the auto-issued one
// from saving the place, or one specifically linked at booking time),
// the embedded `linkedCoupon` summary travels with the reservation so
// the card can render a "tied coupon" stub without a cross-lookup.

export type ReservationStatus = "booking" | "booked" | "cancelled";

/** Compact coupon summary shown as a stub below a reservation card. */
export type LinkedCouponSummary = {
  id: string;
  percent: number;
  classLabel: string;
  kind: "normal" | "instagram";
  /** Lifecycle hint — surfaced as a small pill. Subset of the full status. */
  state: "active" | "pending";
};

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
  linkedCoupon?: LinkedCouponSummary;
  /** MESITA-787 */
  guestNotify?: "call" | "app";
  guestConfirmedAt?: string | null;
  alternatives?: ReservationAlternative[];
  /** Raw DB status — needed for counter-offer accept gating. */
  dbStatus?: "pending" | "confirmed" | "declined" | "no_show" | "cancelled" | "unreachable" | "unresolved";
};
