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
  /** Photos on the public profile. It must AGREE with the place's
   *  `MockPlaceProfile.photos.length` — Admin prints this number while Profile
   *  renders that array, and a console where the two disagree is a console
   *  telling two stories about one gallery. */
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

// ── THE PROFILE RECORD ──────────────────────────────────────────────────────
//
// Everything above is the mock's own vocabulary. This is NOT: the field names
// below are the REAL column names, because `components/place-manage/` is a
// snapshot of the business console's Profile and reads them by name. Renaming
// them to something friendlier would mean rewriting every line of a file whose
// whole value is that it was not rewritten.
//
// It is a sibling of `MockPlace` rather than more fields on it for the same
// reason: `MockPlace` is what the RAIL, the catalogue and the eight product
// views read — a flat, invented shape — and merging thirty snake_case columns
// into it would make every one of those screens look like it reads the DB.

export type MockDay =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type MockPlaceProfile = {
  /** Operator override → places.mesita_name. Blank ⇒ the place follows Google. */
  mesita_name: string | null;
  /** Cached Google Places displayName. Intaker-only write, so: read-only. */
  google_name: string | null;
  category: string | null;
  category_label: string | null;
  /** Families the Intaker INFERRED. Membership derives live from `category`. */
  family_keys: string[] | null;
  /** Canonical Presentation — English. The column is `description`; the FIELD
   *  is Presentation (Pato, 2026-08-23). */
  description: string | null;
  price_level: number | null;
  currency: string | null;
  tags: string[];
  photos: string[];
  hours: Partial<Record<MockDay, { open: string; close: string }[]>> | null;
  /** Native — Google Places seed + Intaker synthesis. The update EF rejects
   *  manual address writes, which is why Location renders read-only. */
  address: string | null;
  zone: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  timezone: string | null;
  phone: string | null;
  website_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  whatsapp_url: string | null;
  /** Native-locked — shown read-only, never patched (MESITA-468). */
  google_maps_url: string | null;
  uber_eats_url: string | null;
  opentable_url: string | null;
  /** Intaker pipeline state. `generating`/`queued` puts the quiet footnote
   *  under the completeness meter. */
  content_state: string | null;
  /** What `isServingChannel` reads for the Reservations completeness check. */
  reservation_channel: string | null;
  /** Menus live at their own address since MESITA-1848, but completeness still
   *  counts them, so the count travels with the profile. */
  menu_count: number;
};

// ── THE ATLAS CATALOG ───────────────────────────────────────────────────────
//
// In the real console these arrive from `business-web-get-atlas-fields`, the
// same vocabulary Atlas Config edits. Here they are a fixture, and a SLICE of
// the seed rather than a mirror of it: the select and the tag picker read the
// same at forty rows as at a hundred, and a copy that matched the table row for
// row would acquire a reason to be re-synced.

export type MockTagOption = {
  slug: string;
  label_es: string;
  label_en: string;
  facet: string;
  section: string;
  sort_order: number;
};

export type MockTagFacet = {
  slug: string;
  emoji: string;
  label_es: string;
  label_en: string;
};

export type MockCategoryOption = {
  slug: string;
  label: string;
  section: string;
  sort_order: number;
  /** 1–2 place family parents (multi-parent law). */
  family_keys?: string[];
};

export type MockFamilyOption = {
  slug: string;
  label: string;
  emoji: string;
  sort_order: number;
};

export type MockFieldLimits = {
  placeNameMax: number;
  descriptionMax: number;
  tagsPerPlaceMax: number;
  photosMax: number;
};
