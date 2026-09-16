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

/** What the Membership subscription is DOING, which is not the same question
 *  as whether the place is a partner.
 *
 *  `partnered` is the GATE — what `lib/products.ts` reads to decide whether a
 *  card is Locked. This is the SUBSCRIPTION behind it, and the two come apart
 *  in both directions:
 *
 *  LAPSE IS NOT DROP. `past_due` still entitles — Stripe is retrying the card
 *  and the partnership is intact — so a place can be `partnered` with a
 *  failing payment. Revoking there would null four rate columns that nothing
 *  puts back.
 *
 *  `none` IS NOT "NOT A PARTNER". It is a partner with no subscription row:
 *  the place an operator switched on by hand. It has no date, and it must not
 *  be shown one. A billing read that failed lands here too, for the same
 *  reason — neither may be told when it renews. */
export type MembershipState = "active" | "past_due" | "cancelling" | "none";

export const MEMBERSHIP_STATE_LABEL: Record<MembershipState, string> = {
  active: "Active",
  past_due: "Payment due",
  cancelling: "Ending",
  none: "No subscription",
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
   *  buying reach). `partner` is the one that gates products.
   *
   *  ONLY TWO OF THEM WEAR A BADGE (MESITA-1925). `promoting` left the place
   *  heading — it is computed per request and can flip with no operator write,
   *  so beside two badges that move only when somebody acts it read as a third
   *  of the same kind. It is still a fact, and still a column in the `/places`
   *  states matrix and a row in AdminView. */
  verified: boolean;
  partnered: boolean;
  promoting: boolean;
  /** The subscription behind `partnered` — see `MembershipState`. Held
   *  alongside the gate rather than folded into it because the products read
   *  the gate and only the Membership strip reads this. */
  membership: MembershipState;
  /** When it renews, ends, or is paid through, depending on `membership`.
   *  NULL at `none`, and that null is load-bearing: a place partnered by the
   *  operator switch has no subscription to date. Derived from the fixed
   *  `MOCK_NOW`, never the wall clock. */
  renewsAt: string | null;
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

/** THE GUEST'S MESITA CLASS — Mesita's own ladder, not a census bracket.
 *
 *  This column shipped once as an AMAI socioeconomic level (A/B, C+, C…) and
 *  that was simply wrong: "class" already means something exact in this
 *  product. The consumer ladder is Bronze < Silver < Gold < Diamond
 *  (`classes.rank` in the DB still carries the legacy keys standard <
 *  influencer < premium < aura), and a business reading "Class" on a guest
 *  will read the ladder its own guests can see on their phones.
 *
 *  Stored as the GUEST-FACING label, because that is the word both sides of
 *  the product use. The legacy key belongs in the DB, not on a mock screen. */
export type MockClass = "Bronze" | "Silver" | "Gold" | "Diamond";

/** THE GUEST'S SUBSCRIPTION, which is not their class — the consumer app says
 *  so in as many words on its own Plan screen: "A subscription, not a class."
 *
 *  The two are coupled but not the same, and the coupling is why the column
 *  earns its place: paying gets you Gold, so Bronze and Silver are always
 *  Free and Gold is always Premium — but Diamond is invite-only and outranks
 *  Gold, so a Diamond guest may or may not be paying Mesita, and Class alone
 *  cannot tell you which. That case is the whole reason to print Plan. */
export type MockPlan = "Free" | "Premium";

export type MockSex = "f" | "m";

export const SEX_LABEL: Record<MockSex, string> = {
  f: "Woman",
  m: "Man",
};

/** A guest of ONE place.
 *
 *  AGE, CLASS, SEX AND PLAN ARE NOT THINGS THE PLACE COLLECTED. They come off
 *  the guest's own Mesita profile, which is why every guest has them rather
 *  than only the ones who filled in a card at the till — and why this console
 *  shows them and never offers to edit them.
 *
 *  THE CONTACT is the exception — the handle and the phone number together.
 *  It is the one thing here the place has to BUY, one guest at a time, and
 *  having it is what makes reaching that guest with a promotion possible. Both
 *  fields are always present and `contactUnlocked` decides whether the screen
 *  may print either.
 *
 *  It is a PHONE, not a WhatsApp. WhatsApp is one channel you could reach the
 *  number on, and naming it after that channel promises an integration nobody
 *  has decided on — and collides with `whatsapp_url`, the PLACE's own WhatsApp
 *  on Profile, which is a different thing entirely. */
export type MockCustomer = {
  id: string;
  placeId: string;
  name: string;
  /** Years, from the birthday on the guest's profile. */
  age: number;
  class: MockClass;
  sex: MockSex;
  plan: MockPlan;
  /** The handle WITHOUT the @, or null when the guest never connected one.
   *  Locked behind the same purchase as the phone — see `contactUnlocked`. A
   *  Silver guest always has one: Silver IS the class Instagram earns. */
  instagram: string | null;
  visits: number;
  /** Centavos, across every visit. Integer money, as everywhere else here. */
  spendCents: number;
  /** Invented, like every number in fixtures.ts — and never printed unless
   *  `contactUnlocked`. */
  phone: string;
  /** ONE purchase, BOTH ways to reach the guest.
   *
   *  The handle and the number are not sold separately, because they are not
   *  two products — they are the answer to one question, "how do I reach this
   *  guest", and splitting them would put two verbs in one row and make the
   *  reviewer price each half. A guest with no handle unlocks to a number and
   *  an em dash: unlocking reveals what exists, it does not invent a handle. */
  contactUnlocked: boolean;
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
  /** THE MENUS THEMSELVES, not a count (MESITA-1917). Menus is a card on
   *  Profile again, so the form edits this array and the save writes it back;
   *  `MockPlace.menuCount` is derived from its length rather than stored. */
  menus: MockProfileMenu[];

  // ── What the world says back ────────────────────────────────────────────
  //
  // Every number below is enrichment- or guest-written, which is why the
  // Reviews card is read-only and wears one `auto` pill for the whole card.
  // Stars are null rather than 0 where nothing has been scored: an unreviewed
  // place must never render a fabricated 5.0, and "—" is the only honest
  // rendering of a number nobody has produced.
  google_stars_overall: number | null;
  google_review_count: number | null;
  mesita_stars_overall: number | null;
  mesita_review_count: number | null;
  /** Mesita's breakdown, and Mesita's alone — Google publishes no sub-scores,
   *  which is why these four only appear once Mesita itself has been reviewed. */
  mesita_stars_food: number | null;
  mesita_stars_service: number | null;
  mesita_stars_ambience: number | null;
  mesita_stars_value: number | null;
  /** Reach, not score. Null is "not linked", which is a different fact from
   *  a linked account with no followers. */
  instagram_followers_count: number | null;
  facebook_followers: number | null;
};

/** One menu on a place. `source` is how it got here: a file the operator
 *  uploaded, or a Drive/Docs link they pasted. The real editor stores both as
 *  a URL and tells them apart the same way. */
export type MockProfileMenu = {
  key: string;
  name: string;
  url: string;
  source: "upload" | "drive";
};

/** The real editor's cap, and the reason the Menus card can refuse an add. */
export const MENU_MAX_COUNT = 20;

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
