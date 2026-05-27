// Reservation entity. Booking metadata only — no money fields. When a
// reservation has a coupon riding along with it (the auto-issued one
// from saving the venue, or one specifically linked at booking time),
// the embedded `linkedCoupon` summary travels with the reservation so
// the card can render a "tied coupon" stub without a cross-lookup.

export type ReservationStatus = "booking" | "booked" | "cancelled";

/** Compact coupon summary shown as a stub below a reservation card. */
export type LinkedCouponSummary = {
  id: string;
  percent: number;
  tierLabel: string;
  kind: "normal" | "instagram";
  /** Lifecycle hint — surfaced as a small pill. Subset of the full status. */
  state: "active" | "pending";
};

export type ReservationItem = {
  id: string;
  venueId: string;
  venueName: string;
  venuePhoto: string | null;
  when: string;
  partySize: number;
  status: ReservationStatus;
  statusNote?: string;
  linkedCoupon?: LinkedCouponSummary;
};

export const MOCK_RESERVATIONS: ReservationItem[] = [
  {
    id: "res-mar-verde",
    venueId: "mar-verde",
    venueName: "Mar Verde",
    venuePhoto:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
    when: "Wed May 28 · 8:00 PM",
    partySize: 2,
    status: "booked",
    linkedCoupon: {
      id: "cp-mar-verde",
      percent: 20,
      tierLabel: "Mesita Gold",
      kind: "normal",
      state: "active",
    },
  },
  {
    id: "res-neon-bar",
    venueId: "neon-bar",
    venueName: "Neón Bar",
    venuePhoto:
      "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&q=80",
    when: "Sat May 31 · 9:00 PM",
    partySize: 6,
    status: "booking",
    statusNote: "AI calling venue · expect a call in ~3 min to confirm",
    linkedCoupon: {
      id: "cp-neon-bar",
      percent: 20,
      tierLabel: "Mesita Gold",
      kind: "normal",
      state: "active",
    },
  },
  {
    id: "res-casa-luminar",
    venueId: "casa-luminar",
    venueName: "Casa Luminar",
    venuePhoto:
      "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80",
    when: "Fri Jun 6 · 8:30 PM",
    partySize: 4,
    status: "booked",
    linkedCoupon: {
      id: "cp-casa-luminar",
      percent: 10,
      tierLabel: "Mesita Gold",
      kind: "normal",
      state: "active",
    },
  },
  {
    id: "res-atelier",
    venueId: "atelier-nueve",
    venueName: "Atelier Nueve",
    venuePhoto:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",
    when: "Sun Jun 8 · 7:00 PM",
    partySize: 2,
    status: "booking",
    statusNote: "Booking via OpenTable · usually under a minute",
    // No linkedCoupon — this venue isn't a Mesita partner.
  },
];
