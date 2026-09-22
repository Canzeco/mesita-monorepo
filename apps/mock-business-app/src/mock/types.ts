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

/** THE LADDER — what this place BOUGHT (MESITA-1997).
 *
 *  Pato, 2026-09-19: *"Is not partner / Is pro and ultra"* — there is no
 *  separate thing called a Membership to buy: you buy a PLAN, and what a rung
 *  carries is everything this file and `lib/products.ts` say it does.
 *
 *  THREE RUNGS, NOT FOUR (MESITA-2019). Pato, 2026-09-20: *"How can i pack
 *  these products in 3 subscriptions, first one is free"*, then *"i want one
 *  for $200MX per month. super cheap."* `start` is gone — MESITA-2009 added
 *  it and MESITA-2014 repriced it, and a day later the ladder it belonged to
 *  stopped existing. What is left is the shape `places.plan` has carried in
 *  the real schema all along: `free | pro | ultra`.
 *
 *  THE BADGE IS THE TOP RUNG'S ALONE. Pato: *"Partner is just for the ultra"*
 *  and, on why no rung may be NAMED Partner, *"you can pay that subscription
 *  but not being a partner still."* So paying and being a partner come apart
 *  at both ends: a place on Mesita Pro has a subscription, an invoice and a
 *  renewal date and no badge, and a place on Ultra that sets its reward rate
 *  to nothing does not wear one either — `deriveListingType` has always
 *  required a non-zero rate on top of the rung, and that half is untouched.
 *  Every screen that used `partnered` to mean "this place pays Mesita" had to
 *  stop, or a paying place loses its billing door the day it is on Pro.
 *
 *  NOT `MockPlan`, WHICH IS TAKEN. That is the GUEST's Free/Premium on
 *  `MockCustomer`, a different axis on a different subject — and the exact
 *  collision that makes "plan" a word this codebase has to qualify every time.
 *
 *  THE BACKEND STILL OWES THIS SCREEN TWO THINGS, and they are one issue, not
 *  this one: `deriveListingType` grants the badge on `plan !== 'free'`, which
 *  is two rungs too low now; and `places.partnered` is the ENTITLEMENT its own
 *  migration comment says it is, gating `business-web-set-partnership` with a
 *  409. Moving both to Ultra as one flag would 409 a Mesita Pro place on its
 *  first reward rate. The badge follows the rung; the entitlement follows each
 *  product's own `minPlan`. Nothing here reaches a database. */
export type PlanTier = "free" | "pro" | "ultra";

export const PLAN_LABEL: Record<PlanTier, string> = {
  free: "Free",
  pro: "Mesita Pro",
  ultra: "Mesita Ultra",
};

/** One line on what each rung is FOR. The comparison leads with these, because
 *  a column headed by a price and then a list of product names is three
 *  inventories side by side — and an operator picking a rung is picking a way
 *  to run the place, not counting features.
 *
 *  EACH STEP BUYS A DIFFERENT KIND OF THING. Free is the listing: your page,
 *  what the world says back, and the menu. Pro is where that listing starts
 *  SELLING — a site of your own, bookings, and orders that actually charge.
 *  Ultra is what brings a guest back a second time, which is the only one of
 *  the three that needs Mesita to keep working after the sale.
 *
 *  THE MENU MOVED DOWN A RUNG (MESITA-2025) AND BOTH PITCHES HAD TO MOVE WITH
 *  IT. Pro's line opened with "A menu" while the menu had become Free's — the
 *  kind of sentence that keeps rendering, keeps reading well, and sells the
 *  wrong rung. Pro's list is derived from `SPECS`; its PITCH is not, so nothing
 *  would have caught it. */
export const PLAN_PITCH: Record<PlanTier, string> = {
  free: "Be found. Your page, your menu, and what the world says back.",
  pro: "Sell online. A site of your own, bookings and orders that charge.",
  ultra: "Bring them back. The badge, the rewards and the machine that answers.",
};

/** Rung order. `>=` on these numbers is the whole entitlement check — a
 *  product names the lowest rung that carries it and every rung above
 *  inherits it, so Ultra never has to re-list what Pro already bought. */
export const PLAN_RANK: Record<PlanTier, number> = {
  free: 0,
  pro: 1,
  ultra: 2,
};

/** The ladder in order, lowest first. Derived from `PLAN_RANK` so a rung
 *  cannot be in one list and not the other — the comparison renders this, and
 *  adding a fourth rung is one entry in `PLAN_RANK` and nothing else. */
export const PLAN_LADDER: readonly PlanTier[] = (
  Object.keys(PLAN_RANK) as PlanTier[]
).sort((a, b) => PLAN_RANK[a] - PLAN_RANK[b]);

/** MX$ a month, + IVA, as integers of pesos — the mock prints money and never
 *  charges it, so there is no reason to carry centavos here. Free is 0 and
 *  still has a row: a rung with no price line is a rung an operator cannot
 *  compare against the two beside it.
 *
 *  MX$200 IS DELIBERATELY UNDER WHAT THE RUNG IS WORTH (MESITA-2019). Pato:
 *  *"super cheap."* The subscription is not where Mesita earns on a Pro place
 *  — the volume moving through Online Payments is — so the rung is priced to
 *  be said yes to on a phone call, and the 10× step to Ultra is carried by the
 *  badge and the rewards rather than by a longer list. */
export const PLAN_PRICE_MXN: Record<PlanTier, number> = {
  free: 0,
  pro: 200,
  ultra: 2000,
};

/** THE LOWEST RUNG THAT CARRIES THE PARTNER BADGE (MESITA-2019: Ultra).
 *
 *  It is a constant and not a literal because three different kinds of reader
 *  want it — the product's own `minPlan`, the card's note, and every screen
 *  that asks whether this place wears the badge — and the last time this fact
 *  was spelled out in more than one place the copy and the gate disagreed.
 *
 *  IT IS NOT "PAYS". `plan !== "free"` is the question a billing door asks;
 *  this is the question a badge asks, and they have been different questions
 *  since the badge stopped sitting on the cheapest paid rung. Reading the
 *  wrong one either hands a paying place a buy button it does not need or
 *  prints a badge it did not buy. */
export const PARTNER_MIN_PLAN: PlanTier = "ultra";

/** Does this rung wear the Partner badge? The one arithmetic, so no screen
 *  re-derives it and none of them can drift apart. */
export function isPartner(plan: PlanTier): boolean {
  return planAtLeast(plan, PARTNER_MIN_PLAN);
}

export function planAtLeast(plan: PlanTier, min: PlanTier): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[min];
}

/** What the subscription is DOING, which is not the same question as which
 *  rung the place is on.
 *
 *  `plan` is what was BOUGHT and `partnered` is the badge derived from it
 *  (`isPartner`, which is Ultra alone). This is the BILLING state underneath,
 *  and it comes apart from both — including from a place that pays and is not
 *  a partner, which is every place on Mesita Pro:
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

/** What an operator sets on Online Orders, and nothing they merely observe.
 *
 *  `paused` IS THE ODD ONE OUT ON PURPOSE. Everything else here is a setting
 *  somebody changes once a season; pause is pressed at 8pm on a Friday when
 *  the kitchen is under, and undone at 11. It lives with the settings because
 *  it is a STATE of the product rather than an event in its log — but it is
 *  rendered in the Switch band at the top of the pane, not among the numbers,
 *  because the two are reached for at completely different moments. */
export type MockOrdersConfig = {
  paused: boolean;
  /** Quoted to the guest when they place an order. */
  prepMinutes: number;
  /** NULL means the product follows the place's opening hours, which is the
   *  right default and the one an operator should almost never override — a
   *  second set of hours is a second thing to forget on a holiday. A string
   *  here is that override, stated in the operator's own words. */
  windowNote: string | null;
  /** Delivery only, so NULL whenever the place does not deliver. A radius on
   *  a pickup-only place is a number that governs nothing, and a console that
   *  shows one is inviting somebody to tune it. */
  radiusKm: number | null;
  deliveryFeeCents: number | null;
  minimumCents: number;
};

// ── THE STATES THE VOICE SESSION NAMED (MESITA-2017) ───────────────────────
//
// Every one of these is a FIXTURE of a state the console must be able to
// show, not a model of the product. The real product will store most of them
// on the tables they belong to; here they hang off the place because the
// screen that draws them reads the place.

/** Where an order can come from. Marketplaces collect their own money; the
 *  three direct channels pay Mesita through Stripe. */
export type OrderChannel = "ubereats" | "rappi" | "didi" | "app" | "web" | "whatsapp";
export const ORDER_CHANNELS: readonly OrderChannel[] = [
  "app",
  "web",
  "whatsapp",
  "ubereats",
  "rappi",
  "didi",
];
export const ORDER_CHANNEL_LABEL: Record<OrderChannel, string> = {
  app: "Mesita app",
  web: "Your website",
  whatsapp: "WhatsApp",
  ubereats: "Uber Eats",
  rappi: "Rappi",
  didi: "DiDi Food",
};
/** `catalog_conflict` is reachable only once Mesita-owned menu sync exists;
 *  v1 connections are platform-owned, so no fixture holds it yet. */
export type OrderChannelState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "token_expired"
  | "catalog_conflict";

export type ReviewSource = "google" | "mesita" | "instagram" | "facebook";
export const REVIEW_SOURCES: readonly ReviewSource[] = ["google", "mesita", "instagram", "facebook"];
export const REVIEW_SOURCE_LABEL: Record<ReviewSource, string> = {
  google: "Google",
  mesita: "Mesita",
  instagram: "Instagram",
  facebook: "Facebook",
};
export type ReviewSourceState = { connected: boolean; lastSyncedAt: string | null };

/** One Twilio line per place, provisioned on activation. Voice comes up
 *  first; WhatsApp after the number is registered. */
export type LineState = "off" | "activating" | "voice" | "full";

export type WebsiteState = "none" | "picked" | "preview" | "published";
export type WebsiteTemplate = "elegant" | "casual" | "night" | "cafe";
export const WEBSITE_TEMPLATES: readonly WebsiteTemplate[] = ["elegant", "casual", "night", "cafe"];
export const WEBSITE_TEMPLATE_LABEL: Record<WebsiteTemplate, string> = {
  elegant: "Elegant",
  casual: "Casual",
  night: "Night",
  cafe: "Café",
};

export type CampaignState =
  | "draft"
  | "scheduled"
  | "selling"
  | "sold_out"
  | "closed"
  | "redeeming"
  | "expired";
export type MockCreditCampaign = {
  id: string;
  placeId: string;
  name: string;
  /** "Pay $800" */
  payCents: number;
  /** "get $1,000" */
  getCents: number;
  /** The most cash this campaign may raise. */
  capCents: number;
  soldCents: number;
  perGuestCents: number;
  startsAt: string;
  endsAt: string;
  redeemUntil: string;
  state: CampaignState;
};

/** What a place sets on Member Visits, minus `on` — that is `visitRewards`,
 *  which every other screen already reads.
 *
 *  THREE FIELDS NOW (MESITA-2038). `cap` went with the per-place cap: the
 *  rewardable base is fixed at the first MX$200 for every place, so there is
 *  nothing to choose and the peso ceiling follows from the plan. `mesita` went
 *  with the Mesita review lever, which is not in Pato's four-lever table.
 *
 *  Base and Diamond are absent on purpose: base is `visitRewards` itself, and
 *  Diamond is Mesita's invitation list, which a place does not switch. */
export type MockRewardsSetup = {
  mode: "discount" | "cashback";
  welcome: boolean;
  story: boolean;
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
  /** DERIVED FROM `plan`, never set beside it (MESITA-1997): `isPartner`,
   *  which is Mesita Ultra alone since MESITA-2019. It stays a field because a
   *  dozen readers want the fact and not the arithmetic — `scenario.ts` is the
   *  one place that computes it, exactly as `deriveListingType` is the one
   *  place the real lane computes its own.
   *
   *  IT IS THE BADGE, NOT THE BILL. A place on Mesita Pro is `false` here and
   *  still has a subscription to manage, so a screen asking "does this place
   *  pay Mesita" wants `plan !== "free"` and not this field. */
  partnered: boolean;
  /** WHICH RUNG. Free is a real rung, not the absence of one: it carries
   *  Mesita Profile, Online Reputation and Digital Menu — the whole listing
   *  every place gets for showing up. The menu came BACK to it in MESITA-2025,
   *  having left with the Developers Platform in MESITA-2019. */
  plan: PlanTier;
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
  /** The billing state under the rung — see `MembershipState`. Held apart
   *  from `plan` because the products read the rung and only the plan strip
   *  reads this: a `past_due` Pro place is still Pro. */
  membership: MembershipState;
  /** When it renews, ends, or is paid through, depending on `membership`.
   *  NULL at `none`, and that null is load-bearing: a place partnered by the
   *  operator switch has no subscription to date. Derived from the fixed
   *  `MOCK_NOW`, never the wall clock. */
  renewsAt: string | null;
  /** THE CUSTOMERS SUBSCRIPTION (MESITA-1941). Customer Intelligence is customer
   *  INTELLIGENCE and it is RENTED, not bought: while it runs, the place reads
   *  who its guests are and what they did this month; when it stops, the
   *  catalog closes and the place keeps nothing.
   *
   *  IT IS NO LONGER ITS OWN SUBSCRIPTION (MESITA-1997). It was — a place
   *  could be a partner and not rent it, and the reverse — and the ladder
   *  puts it inside **Mesita Ultra**, so this is now DERIVED: `plan ===
   *  "ultra"`. The renting is still real and the closed form of the table is
   *  still reachable; what changed is that the rung buys it rather than a
   *  second invoice. If it should go back to being sold on its own, this line
   *  is the one that reverses.
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
  /** ONLINE ORDERS' OWN SETTINGS (MESITA-2002), and the shape every product's
   *  settings take from here on: ONE nested object per product, never a
   *  handful of flat fields beside the capability switch. Seven flat keys for
   *  Orders would be sixty across the ten, on a type a person still has to
   *  read.
   *
   *  NULL IS A REAL STATE — orders have never been configured here — and it
   *  is not the same as `pickupOrders && deliveryOrders` both false. One says
   *  nobody has set this up; the other says it is set up and switched off.
   *
   *  THE CHANNELS ARE NOT IN HERE. `pickupOrders` and `deliveryOrders` stay
   *  above: `lib/products.ts` reads them for the card's state and the
   *  `/places` matrix prints them. Copying them in would make two readers of
   *  one fact, which is the bug MESITA-2000 deleted from Settings. */
  orders: MockOrdersConfig | null;
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
  // ── MESITA-2017 ─────────────────────────────────────────────────────────
  /** Null until the operator pressed Publish on Digital Menu. Orders, the
   *  Agent and the Website all door to Menu while this is null. */
  menuPublishedAt: string | null;
  /** The operator asked Mesita to verify the place; `verified` is Mesita's
   *  answer. Request-only on this side: nobody here can set `verified`. */
  verificationRequested: boolean;
  /** Rows 2–4 of the Partner checklist have all been green at some point, so
   *  a failing row reads "at risk" instead of "not yet". */
  partnerHeld: boolean;
  /** When the badge was last removed (plan lapse or Verified revoked). */
  partnerLapsedAt: string | null;
  /** Where new orders and bookings are announced. One per place, editable
   *  inside whichever of Orders or Reservations is on. */
  notificationsNumber: string | null;
  rewards: MockRewardsSetup;
  /** Cashback was on and Credits went off or below the rung: what guests
   *  hold stays redeemable, new visits fall back to discount. */
  cashbackPaused: boolean;
  orderChannels: Record<OrderChannel, OrderChannelState>;
  reviewSources: Record<ReviewSource, ReviewSourceState>;
  lineState: LineState;
  /** Answers the agent escalated that are waiting for a human to confirm. */
  lineFactsPending: number;
  /** What the outside world calls the line. Editable; never "Mesita". */
  lineLabel: string;
  websiteState: WebsiteState;
  websiteTemplate: WebsiteTemplate | null;
  /** Null means the included `<slug>.mesita.co`. */
  websiteDomain: string | null;
  /** Sister places whose credits this one honours. Same organisation only. */
  acceptedIssuers: string[];
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

/** THE GUEST'S SUBSCRIPTION — a separate fact from Diamond.
 *
 *  THERE IS NO LADDER (MESITA-2044). Pato: "either you are diamond or you are
 *  not." A guest is Diamond or not (MESITA-2046 dropped "List"), and the
 *  only way in is an invitation; paying never makes anyone Diamond, so the
 *  plan and Diamond are independent and neither can be read off the other. The
 *  metals this row once carried (Bronze < Silver < Gold < Diamond) are gone
 *  from every screen; a stored `bronze`/`silver`/`gold` key means "not on
 *  the list". */
export type MockPlan = "Free" | "Premium";

export type MockSex = "f" | "m";

export const SEX_LABEL: Record<MockSex, string> = {
  f: "Woman",
  m: "Man",
};

/** A guest of ONE place.
 *
 *  AGE, DIAMOND, SEX AND PLAN ARE NOT THINGS THE PLACE COLLECTED. They come off
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
  /** Diamond or not — nothing in between (MESITA-2044). */
  diamond: boolean;
  sex: MockSex;
  plan: MockPlan;
  /** The handle WITHOUT the @, or null when the guest never connected one.
   *  Locked behind the same purchase as the phone — see `contactUnlocked`.
   *  Instagram is its own fact: it makes nobody Diamond. */
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
  /** Cached Google Places displayName. Enricher-only write, so: read-only. */
  google_name: string | null;
  category: string | null;
  category_label: string | null;
  /** Families the Enricher INFERRED. Membership derives live from `category`. */
  family_keys: string[] | null;
  /** Canonical Presentation — English. The column is `description`; the FIELD
   *  is Presentation (Pato, 2026-08-23). */
  description: string | null;
  price_level: number | null;
  currency: string | null;
  tags: string[];
  photos: string[];
  hours: Partial<Record<MockDay, { open: string; close: string }[]>> | null;
  /** Native — Google Places seed + Enricher synthesis. The update EF rejects
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
  /** Enricher pipeline state. `generating`/`queued` puts the quiet footnote
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

/** A DISH, AND THREE PRICES (MESITA-1984).
 *
 *  Main §4: *"Every dish carries a price per channel: one at the table, another
 *  for pickup, another for delivery."* Three columns rather than one price and
 *  two modifiers, because a place sets them independently — delivery carries a
 *  courier the table does not, and pickup is often the cheapest thing on the
 *  menu on purpose.
 *
 *  A null price means THIS DISH IS NOT SOLD ON THAT CHANNEL, which is a real
 *  answer and not a zero: a dish the kitchen will not send out arrives as a
 *  dash, never as free. */
export type MockDish = {
  id: string;
  name: string;
  /** What is in it, in the place's own words. The menu answers a guest from
   *  this and never from invention (Main §4). */
  blurb: string;
  /** Generated dish photography — the shot the place never took. A data URI
   *  like every other image in this app. */
  photoUrl: string | null;
  table: number | null;
  pickup: number | null;
  delivery: number | null;
};

export type MockMenuSection = {
  id: string;
  name: string;
  dishes: MockDish[];
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
