// What the mock console knows about the world.
//
// This is the whole data model. There is no client, no Edge Function and no
// row anywhere behind it: `fixtures.ts` is the database and `scenario.ts` is
// the query planner. Every field here exists because some screen reads it.
import type { PlaceRole } from "@/lib/place-tabs";

export type { PlaceRole };

/** Mesita Payments is a Stripe Connect account, and its ladder is the only
 *  place in this console where "off" and "never started" are different facts.
 *
 *  Stripe sets `disabled_reason` on day zero, so a FRESH account and a
 *  REJECTED one look identical to a naive reader — the real console learned
 *  this the hard way. The mock keeps them apart as separate rungs so the two
 *  screens can be compared side by side. */
export type PayLadder =
  | "never" // no Connect account exists for this place
  | "started" // onboarding begun, requirements outstanding
  | "pending" // everything submitted, Stripe is reviewing
  | "enabled" // charges and payouts on
  | "restricted"; // Stripe disabled it after the fact

export const PAY_LADDER_LABEL: Record<PayLadder, string> = {
  never: "Not set up",
  started: "Setup unfinished",
  pending: "In review",
  enabled: "On",
  restricted: "Restricted",
};

export type MockPlace = {
  id: string;
  name: string;
  /** A data URI. NEVER a real photo of a real venue — see fixtures.ts. */
  photoUrl: string | null;
  category: string;
  street: string;
  city: string;
  phone: string;
  website: string;
  myRole: PlaceRole;
  /** THE THREE FACTS a place carries, and they are three, not one:
   *  verified (Mesita checked it is real), partner (it pays), promoting (it is
   *  buying reach). `partner` is the one that gates products. */
  verified: boolean;
  partnered: boolean;
  promoting: boolean;
  /** Per-place capability switches — what `lib/products.ts` reads to decide
   *  whether a card says "On here" or "Not on here yet". */
  pickupOrders: boolean;
  deliveryOrders: boolean;
  reservations: boolean;
  visitRewards: boolean;
  credits: boolean;
  pay: PayLadder;
  rating: number;
  reviewCount: number;
  /** Photos on the public profile — the count the Profile view prints. */
  photoCount: number;
  menuCount: number;
};

/** What actually TOOK money, mirroring `visit_ticket_payments.method`
 *  (MESITA-1910). Three, not four: Credits is a bill REDUCTION and never a
 *  tender, and `at_place` is not one either — it existed only because a scalar
 *  column could not tell cash from card. `mesita_pay` keeps the persisted
 *  spelling; the noun an operator reads is "Mesita Payments". */
export type MockTender = {
  method: "cash" | "card" | "mesita_pay";
  amountCents: number;
};

export type MockVisit = {
  id: string;
  placeId: string;
  guest: string;
  at: string;
  /** Centavos. Money is an integer everywhere in this app, as it is in the
   *  real one — a float total is how a peso goes missing. */
  totalCents: number;
  rewardCents: number;
  /** The OTHER reduction. Credits come off the bill beside the reward, never
   *  out of the tenders — `20260831121954_credits_rename.sql` freezes it:
   *  "Credits settle as a bill REDUCTION never a payment method". */
  creditsCents: number;
  /** ONE ROW PER TENDER, because a visit can be paid with several amounts at
   *  once (Pato, 2026-09-16). This was a single `method` chip, which had to
   *  drop every tender but one — and painted cash and card as different when
   *  the database stored both as `at_place`.
   *
   *  THE ROWS SUM TO `totalCents - creditsCents`, which is the real
   *  `approved_amount_due_cents - credits_applied_cents`. Zero rows is legal
   *  and means Credits covered the whole bill; `assertVisitArithmetic` in
   *  fixtures.ts holds the sum. */
  tenders: MockTender[];
  state: "open" | "settled" | "voided";
};

export type MockOrder = {
  id: string;
  placeId: string;
  guest: string;
  at: string;
  channel: "pickup" | "delivery";
  items: number;
  totalCents: number;
  state: "placed" | "preparing" | "ready" | "collected" | "canceled";
};

export type MockReservation = {
  id: string;
  placeId: string;
  guest: string;
  at: string;
  party: number;
  state: "requested" | "confirmed" | "seated" | "no_show" | "canceled";
  note: string | null;
};

export type MockReview = {
  id: string;
  placeId: string;
  guest: string;
  at: string;
  stars: number;
  body: string;
  reply: string | null;
};

export type MockMenu = {
  id: string;
  placeId: string;
  name: string;
  kind: "pdf" | "link";
  updatedAt: string;
  pages: number;
};

/** A guest's credit balance AT ONE PLACE.
 *
 *  THERE IS NO GRAND TOTAL, and the absence is load-bearing: the real Edge
 *  Function returns none and its list is PAGINATED, so any `reduce()` over the
 *  page on screen would print a number that is confidently wrong. The mock
 *  paginates too, for exactly that reason — a harness that quietly returns
 *  everything at once would let the bug back in. */
export type MockCreditBalance = {
  id: string;
  placeId: string;
  guest: string;
  balanceCents: number;
  lastMoveAt: string;
};

export type MockActivityEvent = {
  id: string;
  placeId: string;
  at: string;
  kind:
    | "visit"
    | "order"
    | "reservation"
    | "review"
    | "payout"
    | "credit"
    | "member"
    | "profile";
  title: string;
  detail: string;
  amountCents: number | null;
};

export type MockMember = {
  id: string;
  placeId: string;
  name: string;
  email: string;
  role: PlaceRole;
  state: "active" | "invited";
};

export type MockCustomer = {
  id: string;
  placeId: string;
  name: string;
  visits: number;
  lastSeen: string;
  spendCents: number;
};

/** A place in the POOL: real to Mesita, held by nobody. The catalogue lists
 *  these beside the caller's own, and Claim is the verb. */
export type MockPoolPlace = {
  id: string;
  name: string;
  category: string;
  city: string;
  verified: boolean;
  claimable: boolean;
};
