// Reservation entity. Booking metadata only — no money fields, and no
// discount surface: a reward is earned by SHOWING UP, so the rates live on
// the visit ticket that snapshots them, never on the booking.

export type ReservationStatus = "booking" | "booked" | "cancelled";

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
  /**
   * Raw ISO instant. `when` is a formatted display string, so anything that
   * needs to ORDER or COMPARE reservations (the one-feed sort) has to read
   * this. Mirrors the web ReservationItem field of the same name.
   */
  reservedAt?: string;
  partySize: number;
  status: ReservationStatus;
  statusNote?: string;
  /** MESITA-787 */
  guestNotify?: "call" | "app";
  guestConfirmedAt?: string | null;
  alternatives?: ReservationAlternative[];
  /** Raw DB status — needed for counter-offer accept gating. */
  dbStatus?: "pending" | "confirmed" | "declined" | "no_show" | "cancelled" | "unreachable" | "unresolved";
};
