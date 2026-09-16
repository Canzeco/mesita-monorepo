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

export type MockVisit = {
  id: string;
  placeId: string;
  guest: string;
  at: string;
  /** Centavos. Money is an integer everywhere in this app, as it is in the
   *  real one — a float total is how a peso goes missing. */
  totalCents: number;
  rewardCents: number;
  method: "card" | "cash" | "credits";
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

/** Socioeconomic class, on AMAI's levels — the axis a promotion in Mexico is
 *  actually bought against, and the reason a place would want this column at
 *  all. Stored as the LABEL because there is nothing to translate: "C+" is
 *  what the segment is called in every language this console speaks. */
export type MockClass = "A/B" | "C+" | "C" | "C-" | "D+";

export type MockSex = "f" | "m";

export const SEX_LABEL: Record<MockSex, string> = {
  f: "Woman",
  m: "Man",
};

/** A guest of ONE place.
 *
 *  AGE, CLASS AND SEX ARE NOT THINGS THE PLACE COLLECTED. They come off the
 *  guest's own Mesita profile, which is why every guest has them rather than
 *  only the ones who filled in a card at the till — and why this console shows
 *  them and never offers to edit them.
 *
 *  The WhatsApp number is the exception: it is the one fact here the place
 *  has to BUY, one guest at a time, and buying it is what makes sending that
 *  guest a promotion possible. So the field is always present and
 *  `whatsappBought` decides whether the screen may print it. */
export type MockCustomer = {
  id: string;
  placeId: string;
  name: string;
  /** Years, from the birthday on the guest's profile. */
  age: number;
  class: MockClass;
  sex: MockSex;
  visits: number;
  /** Invented, like every number in fixtures.ts — and never printed unless
   *  `whatsappBought`. */
  whatsapp: string;
  whatsappBought: boolean;
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
