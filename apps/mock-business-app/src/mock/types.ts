// What the mock console knows about the world.
//
// This is the whole data model. There is no client, no Edge Function and no
// row anywhere behind it: `fixtures.ts` is the database and `scenario.ts` is
// the query planner. Every field here exists because some screen reads it.
import type { PlaceRole } from "@/lib/place-tabs";

export type { PlaceRole };

/** Online Payments is a Stripe Connect account, and its ladder is the only
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
  /** GOOGLE IS ANSWERING FOR IT (MESITA-1977). The second rung of the general
   *  ladder: the place is alive out there — hours, reviews and a listing that
   *  responds — whether or not Mesita has checked it or anybody holds it. It
   *  is the one rung Mesita does not control, which is why it is a fact on the
   *  place rather than a switch on a product. */
  pulsing: boolean;
  /** TURNED OFF. Not a rung: a place can be disabled at any height on the
   *  ladder, so it is read apart from it — a disabled Partner is a different
   *  problem from a disabled row nobody ever claimed. */
  disabled: boolean;
  /** The subscription behind `partnered` — see `MembershipState`. Held
   *  alongside the gate rather than folded into it because the products read
   *  the gate and only the Membership strip reads this. */
  membership: MembershipState;
  /** When it renews, ends, or is paid through, depending on `membership`.
   *  NULL at `none`, and that null is load-bearing: a place partnered by the
   *  operator switch has no subscription to date. Derived from the fixed
   *  `MOCK_NOW`, never the wall clock. */
  renewsAt: string | null;
  /** THE CUSTOMERS SUBSCRIPTION (MESITA-1941). Customer Catalog is customer
   *  INTELLIGENCE and it is RENTED, not bought: while it runs, the place reads
   *  who its guests are and what they did this month; when it stops, the
   *  catalog closes and the place keeps nothing. It is its own subscription,
   *  not part of the Membership — a place can be a partner and not subscribe,
   *  and the reverse.
   *
   *  It replaced a PER-GUEST purchase (`MockCustomer.contactUnlocked`), which
   *  sold a contact forever. Pato, 2026-09-16: *"you don't buy the data
   *  forever, you subscribe to a catalog of customers and you can track their
   *  activity"* — a forever sale of a row that keeps changing is a worse deal
   *  for both sides, because the place pays once for a phone number that
   *  stops meaning anything and Mesita is paid once for keeping it true. */
  customerIntel: boolean;
  /** WHEN THAT SUBSCRIPTION FIRST STARTED, or null if it never has.
   *
   *  NEVER SUBSCRIBED AND STOPPED ARE DIFFERENT FACTS, and one boolean cannot
   *  hold both — the same trap `PayLadder` exists to avoid, where a fresh
   *  Stripe account and a shut-down one report identically. `customerIntel`
   *  false with a date behind it is a catalog that CLOSED, and the
   *  Subscriptions log says so; false with null never opened, and that log is
   *  empty. A place switched on by the panel with no date started today. */
  customerIntelSince: string | null;
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
 *  spelling; the noun an operator reads is "Online Payments". */
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

/** One review, on either platform.
 *
 *  `source` is which platform wrote it, and it is what keeps the two lists on
 *  Profile apart. It is NOT a filter over one pile: `REVIEWS` and
 *  `GOOGLE_REVIEWS` are separate arrays for a reason — Home counts unanswered
 *  reviews, and a Google row in that count would be a blocker the operator
 *  cannot clear from inside Mesita.
 *
 *  `reply` is always null on a Google row for the same reason: Google's own
 *  owner replies are written on Google, not here, and rendering an empty
 *  Reply affordance over a row Mesita cannot write to is a lie about what the
 *  console can do. */
export type MockReview = {
  id: string;
  placeId: string;
  source: "google" | "mesita";
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

/** A guest LOOKING at this place — the only thing in this console that happens
 *  without anybody deciding to do business.
 *
 *  It is the top of the funnel and the one log with NO PRODUCT behind it:
 *  there is nothing called Mesita Views to switch on, and a place with every
 *  other product off still collects these. `surface` is Discovery's own
 *  vocabulary, so a console reading "swipe" is reading the word the engine
 *  uses rather than a synonym invented for a screen.
 *
 *  A VIEW NEVER WRITES ANYWHERE ELSE, and that is why it leads the book. Eight
 *  logs where every one feeds another would teach that the fan-out is the
 *  rule; it is not, and this is the control. */
export type MockPlaceView = {
  id: string;
  placeId: string;
  at: string;
  surface: "search" | "map" | "swipe" | "link" | "qr";
  /** NULL WHEN THE VIEWER WAS SIGNED OUT, and most of them are. A log that
   *  invented a name for every view would make the place look far better known
   *  than it is, and would put a stranger's name on a row nobody can act on. */
  guest: string | null;
  outcome: "viewed" | "saved" | "directions" | "called" | "shared";
};

/** MONEY LEAVING FOR THE BANK.
 *
 *  It is the one record in this file with no product page to live on — no
 *  screen in the console lists payouts — so it exists only as rows in the
 *  Payments log, and it is the only source there whose direction is OUT. */
export type MockPayout = {
  id: string;
  placeId: string;
  at: string;
  /** The account's last four. One bank per place, so two places must not print
   *  the same four digits. */
  last4: string;
  amountCents: number;
  state: "paid" | "in_transit";
};

/** A GUEST BUYING CREDITS, which is the cleanest fan-out this product has: one
 *  purchase is money IN (Payments) and credit MINTED (Credits), and neither
 *  log on its own is the event.
 *
 *  It is not `MockCreditBalance`. That is a standing balance — where the money
 *  IS — and this is a movement — how it got there. A balance cannot be a log
 *  row and a log row cannot be summed into a balance, which is exactly the
 *  confusion that would put a grand total back on the Credits screen. */
export type MockCreditPurchase = {
  id: string;
  placeId: string;
  at: string;
  guest: string;
  amountCents: number;
  /** Bought FOR SOMEBODY ELSE. Gifting is why this product exists on the
   *  consumer side, so the log has to be able to say it. */
  gift: boolean;
};

/** SOMEBODY CHANGED SOMETHING — the only log written by the console itself
 *  rather than by a guest, which is the whole reason it carries a `who`.
 *
 *  `from` is null when there was nothing there before: a photo added, a
 *  teammate invited, a description written for the first time. Printing "—"
 *  for that is honest; printing "None" would invent a prior value. */
export type MockSettingChange = {
  id: string;
  placeId: string;
  at: string;
  who: string;
  /** WHERE TO GO AND CHANGE IT BACK. A change log whose rows cannot be traced
   *  to a screen is a list of regrets. */
  area:
    | "profile"
    | "hours"
    | "menus"
    | "team"
    | "orders"
    | "reservations"
    | "rewards"
    | "credits";
  what: string;
  from: string | null;
  to: string;
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
 *  THE CONTACT is the handle and the phone number together. Both fields are
 *  always present, and `MockPlace.customerIntel` — the subscription — decides
 *  whether the screen may print either. It is not sold a guest at a time any
 *  more: reaching a guest is what the catalog is FOR, so it comes with the
 *  catalog rather than being metered out of it.
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
  /** Invented, like every number in fixtures.ts — and never printed while the
   *  catalog is closed. */
  phone: string;
  /** THE LAST 30 DAYS, which is the half of this row that MOVES.
   *
   *  `visits` and `spendCents` above are lifetime at this place: they only
   *  grow, so a place reading them alone cannot tell a regular from somebody
   *  who came eleven times two years ago and never again. These two are what
   *  a subscription is for — they are worth reading again next month, and the
   *  lifetime pair is not.
   *
   *  ARITHMETIC THAT HOLDS: a quiet guest is 0 and 0 together, never 0 visits
   *  with money against them, and the month can never exceed the lifetime.
   *  The loop under `CUSTOMERS` in fixtures.ts throws if either breaks. */
  visitsPerMonth: number;
  spendPerMonthCents: number;
  /** When they were last here. The one column that says "quiet" out loud —
   *  0 visits this month reads as a missing number, and a date reads as a
   *  fact. */
  lastVisitAt: string;
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
  /** The pool carries the same two general states as a held place
   *  (MESITA-1977). A pool row is Created and may be Pulsing; what it is NOT
   *  is Owned, and that is the whole difference between these two tables. */
  pulsing: boolean;
  disabled: boolean;
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
