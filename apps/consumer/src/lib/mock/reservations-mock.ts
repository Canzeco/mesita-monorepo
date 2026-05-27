// Reservation entity, independent of the legacy ticket model. A
// reservation is *only* booking metadata — when, where, who, status.
// Money / discount / cashback live on the linked coupon (if any).
//
// Status machine:
//
//   booking   ───▶  booked     (venue confirmed)
//      │
//      ╰────────▶  cancelled   (by user or venue)
//
//   booked   ────▶  cancelled  (by user — terminal)
//
// "booking" covers everything in-flight: Mesita's AI calling the venue,
// human concierge negotiating, OpenTable / Resy round-trip pending, etc.
// We surface a status-specific note (e.g., "AI calling venue · expect
// a call in ~3 min") when the data has one.

export type ReservationStatus = "booking" | "booked" | "cancelled";

export type ReservationItem = {
  id: string;
  venueId: string;
  venueName: string;
  venuePhoto: string | null;
  /** Human-readable when string. e.g. "Wed May 28 · 8:00 PM". */
  when: string;
  partySize: number;
  status: ReservationStatus;
  /** Optional rich status note rendered below the meta row. */
  statusNote?: string;
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
  },
];
