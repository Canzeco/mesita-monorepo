// Coupon entity, independent of reservations and of the legacy ticket
// model. A coupon is a discount instrument: it lives in the wallet, gets
// redeemed on a visit, and has its own per-kind lifecycle.
//
// When the coupon is being used (or planned-to-be-used) at a known
// reservation, the embedded `linkedReservation` summary travels with
// the coupon so the card can render a "tied reservation" stub without
// a cross-lookup.

export type CouponKind = "normal" | "instagram";

export type NormalCouponStatus =
  | "active"
  | "redeemed"
  | "expired"
  | "cancelled";

export type InstagramCouponStatus =
  | "pending_story"
  | "under_review"
  | "verified"
  | "rejected"
  | "redeemed"
  | "expired";

/** Compact reservation summary shown as a stub below a coupon card. */
export type LinkedReservationSummary = {
  id: string;
  when: string;
  partySize: number;
  /** Subset of the full reservation status — only the states a coupon stub cares about. */
  state: "booking" | "booked";
};

type CouponBase = {
  id: string;
  venueId: string;
  venueName: string;
  venuePhoto: string | null;
  percent: number;
  tierLabel: string;
  capLabel: string;
  expiresAt: string | null;
  linkedReservation?: LinkedReservationSummary;
};

export type CouponItem =
  | (CouponBase & { kind: "normal"; status: NormalCouponStatus })
  | (CouponBase & {
      kind: "instagram";
      status: InstagramCouponStatus;
      rejectReason?: string;
    });

export const MOCK_COUPONS: CouponItem[] = [
  {
    id: "cp-mar-verde",
    venueId: "mar-verde",
    venueName: "Mar Verde",
    venuePhoto:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
    kind: "normal",
    status: "active",
    percent: 20,
    tierLabel: "Mesita Gold",
    capLabel: "Capped MX$500 / visit",
    expiresAt: null,
    linkedReservation: {
      id: "res-mar-verde",
      when: "Wed May 28 · 8:00 PM",
      partySize: 2,
      state: "booked",
    },
  },
  {
    id: "cp-neon-bar",
    venueId: "neon-bar",
    venueName: "Neón Bar",
    venuePhoto:
      "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&q=80",
    kind: "normal",
    status: "active",
    percent: 20,
    tierLabel: "Mesita Gold",
    capLabel: "Capped MX$500 / visit",
    expiresAt: null,
    linkedReservation: {
      id: "res-neon-bar",
      when: "Sat May 31 · 9:00 PM",
      partySize: 6,
      state: "booking",
    },
  },
  {
    id: "cp-casa-luminar",
    venueId: "casa-luminar",
    venueName: "Casa Luminar",
    venuePhoto:
      "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80",
    kind: "normal",
    status: "active",
    percent: 10,
    tierLabel: "Mesita Gold",
    capLabel: "Capped MX$300 / visit",
    expiresAt: null,
    linkedReservation: {
      id: "res-casa-luminar",
      when: "Fri Jun 6 · 8:30 PM",
      partySize: 4,
      state: "booked",
    },
  },
  {
    id: "cp-ig-ferment",
    venueId: "ferment-co",
    venueName: "Ferment & Co",
    venuePhoto:
      "https://images.unsplash.com/photo-1485921325833-c519f76c4927?w=800&q=80",
    kind: "instagram",
    status: "verified",
    percent: 50,
    tierLabel: "Mesita Diamond",
    capLabel: "Welcome bonus · one-time",
    expiresAt: "2026-06-10",
  },
  {
    id: "cp-ig-rooftop",
    venueId: "rooftop-lex",
    venueName: "Rooftop Lex",
    venuePhoto:
      "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=800&q=80",
    kind: "instagram",
    status: "under_review",
    percent: 70,
    tierLabel: "Mesita Diamond",
    capLabel: "Welcome bonus · one-time",
    expiresAt: "2026-06-04",
  },
  {
    id: "cp-ig-azul",
    venueId: "azul-bistro",
    venueName: "Azul Bistro",
    venuePhoto:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
    kind: "instagram",
    status: "pending_story",
    percent: 50,
    tierLabel: "Mesita Diamond",
    capLabel: "Welcome bonus · one-time",
    expiresAt: "2026-06-08",
  },
];
