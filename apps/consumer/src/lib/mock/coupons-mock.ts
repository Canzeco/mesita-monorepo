// Coupon entity, independent of reservations and of the legacy ticket
// model. A coupon is a discount instrument: it lives in the wallet, gets
// redeemed on a visit, and has its own per-kind lifecycle.
//
// Two kinds, with different birth/verification paths:
//
//   normal     — auto-issued when the user saves a partner venue
//                (see the saved_venues → coupons trigger in mesita-
//                supabase migration 0031). Lifecycle:
//
//                   active ─▶ redeemed | expired | cancelled
//
//   instagram  — earned by posting a story tagging the venue +
//                Mesita. Goes through verification before the
//                discount unlocks. Lifecycle:
//
//                   pending_story ─▶ under_review ─▶ verified
//                       │                  │
//                       │                  ╰▶ rejected ─▶ pending_story
//                       │
//                       ╰▶ expired   (no story before TTL)
//
//                   verified ─▶ redeemed | expired
//
// Card surface only shows the *current* status — the full history is
// implicit. Instagram coupons get a slightly different visual treatment
// so the verification ask is unmistakable.

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

export type CouponItem =
  | (CouponBase & { kind: "normal"; status: NormalCouponStatus })
  | (CouponBase & {
      kind: "instagram";
      status: InstagramCouponStatus;
      /** Reject reason, surfaced on the card when status === "rejected". */
      rejectReason?: string;
    });

type CouponBase = {
  id: string;
  venueId: string;
  venueName: string;
  venuePhoto: string | null;
  /** Discount percent (10/20/50/70). */
  percent: number;
  /** "Mesita Gold", "Mesita Diamond", etc. */
  tierLabel: string;
  /** "MX$500 / visit", "no cap", etc. — display-ready. */
  capLabel: string;
  /** ISO date or null. Drives the "expires in X days" hint when present. */
  expiresAt: string | null;
};

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
