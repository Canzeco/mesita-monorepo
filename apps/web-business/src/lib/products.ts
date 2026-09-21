// THE PRODUCT VOCABULARY, and the one function that states each product's
// facts (MESITA-1869).
//
// Pure, and deliberately so: every card the catalogue draws comes out of here,
// so "what is this product called, what does it do, and is it on" is asserted
// by a test instead of read off a screenshot. `ProductCatalog.tsx` owns the
// LOOK (mark, tint, chip); this owns the TRUTH.
//
// ── WHAT EACH ONE'S STATE IS READ FROM ───────────────────────────────────
//
//   Mesita Profile       ALWAYS FREE. Pato: *"remember that profile is
//                        free."* Every place has a profile the moment it
//                        exists — there is no column to flip and no price, so
//                        it is the one card with no off state and no verb but
//                        Manage.
//   Mesita Visits        guest checks at the bill. Partner-gated, and the
//                        subscription IS the state — so it is ALWAYS ON for a
//                        partner, the Profile pattern, never an on/off card
//                        (MESITA-1882). Visits is not a capability; it is the
//                        container Rewards, Payments and Credits attach to.
//   Mesita Rewards       `visit_rewards`, per place. Partner-gated, because
//                        Conservative and Aggressive are what the Membership
//                        prices. THE CARD'S STATE IS THE DIAL'S: a Rewards
//                        card at 0% reads "Not on here yet", which is what it
//                        is. MESITA-1882's bug was the opposite — Enabled at
//                        Zero — and MESITA-1884 feared this state because back
//                        then it was VISITS' card, where "Not enabled" would
//                        have accused a working checkout.
//   Mesita Orders        `pickup_orders_enabled` OR `delivery_orders_enabled`,
//                        per place. One card, because an operator thinks
//                        "orders" and the two columns are its two shapes.
//   Mesita Reservations  `reservations_enabled`, per place.
//   Mesita Payments      `place_profiles.mesita_pay_enabled`, on top of
//                        Partner. Its switch lives with the Stripe account it
//                        needs, at `products/pay`, which is why it is the one
//                        card whose verb stays on this page's own sub-step.
//                        The NOUN is Payments since MESITA-1900 and the KEY is
//                        still `pay`; see `lib/product-keys.ts`.
//   Mesita Credits       `credits_enabled`, per place. Partner-gated too —
//                        Accept Prepays is in PARTNER_PERKS — so a
//                        non-partner reads Locked, not Not enabled.
//
// ── AND NINE OF THE SIXTEEN READ NOTHING, BECAUSE THEY DO NOT EXIST ──────
//
// Website, Customers, Ads, Terminal, POS, Capital, WhatsApp Bot, Phone Bot and
// Intelligence are `soon`. Pato dictated the suite on 2026-09-16 — *"Put all
// this shit into the suite"*, then *"maybe include POS, but for the future"* —
// and wrote "(Soon)" beside only three of them. The rest get it anyway, and
// that is the one place this file does not take the list literally: not one of
// them has a table, a migration or an Edge Function, and SoonStrip's law is
// that an unbuilt engine shows Soon, never knobs and never a fake number.
//
// A green chip on a WhatsApp bot that cannot answer anything is the most
// expensive lie this screen could tell: an owner reads it as "already handled"
// and stops picking up the phone. So seven cards are live and nine say Soon,
// and that ratio is the point of the screen rather than a defect in it — the
// catalogue is a price list before it is a control panel.
//
// MESITA TERMINAL IS BACK (MESITA-1949), after MESITA-1900 dropped it. What
// does NOT come back is its rail row and `products/terminal`: MESITA-1900's
// objection was that it was "the one row whose address was a SoonStrip", and a
// card is not a row. Most of the suite is catalogue-only for the same
// reason — see `RAIL_ROWS` and the subsequence assertion in `products.test.ts`.
//
// ── THE TWO RULES THIS FILE EXISTS TO HOLD ────────────────────────────────
//
// A NULL PLACE READ PRINTS NOTHING. `place: null` means the read failed, and
// every card drops its note rather than printing "Off". Off is the most
// believable fabrication on a catalogue screen, and a fabricated state is what
// SoonStrip's law forbids outright.
//
// A BLURB NAMES THE GUEST, NOT THE COLUMN (MESITA-1949). Every one of these
// used to be a single clause written from the switch it flips — "Receive
// pickup and delivery orders with checkout", "Accept card payments for visits
// and orders". A dozen of those in a grid is one grey paragraph a dozen times:
// each opens with a verb Mesita does, none says who is better off, and an
// operator meeting the catalogue for the first time cannot tell Orders from
// Visits or Credits from Payments without opening both. So each carries the
// one fact that separates it from its neighbour — orders are PREPAID, a visit
// settles the same on cash or card, credits can only be spent here,
// reservations are held by somebody else's provider. Still one sentence, still
// ending in a period, both pinned below.
//
// PARTNER-GATED BEATS OFF. A product the place cannot reach yet reads
// `locked` with the prerequisite as its note — never `off` with an Enable
// button that would walk an operator to a switch they cannot move. That is
// the ladder grammar Capabilities already uses (offerings.ts), in a grid.
//
// ── THE COUNT BECAME A STATE (MESITA-1892) ────────────────────────────────
//
// Every per-place card used to print an aggregate — "On at 2 of 5 places" —
// because the catalogue was the ORGANIZATION's and an organization held
// several. There is no holder: the catalogue is one place's, so the fact a
// card states is whether the product is on HERE. Same rule underneath, one
// row instead of a fold: a read that failed still prints nothing.
import type { ConsolePlace } from "@/lib/api/console";
import type { PlaceTab } from "@/lib/place-tabs";
import type { ProductCard } from "@/components/console/ProductCatalog";
// THE KEY COMES FROM THE VOCABULARY, NOT FROM THE GRID (MESITA-1900). It used
// to come from `ProductCatalog.tsx`, which held a second copy of the list;
// `lib/product-keys.ts` is the only copy now and the component re-exports it.
import type { ProductKey } from "@/lib/product-keys";

export type { ProductCard, ProductKey };

/** What a place must have ON for a per-place product to count. Null for the
 *  products that are not per-place at all. */
type PlacePredicate = (p: ConsolePlace) => boolean;

type ProductSpec = {
  key: ProductKey;
  name: string;
  blurb: string;
  /** The VIEW this product is turned on in, when it has one.
   *
   *  NULL IS THE COMMON CASE NOW, and it is why this field exists at all.
   *  `PLACE_TABS` ⊇ `PRODUCT_KEYS` used to hold, so a card reached its view
   *  with `key as PlaceTab` — a cast that was true by CONSTRUCTION while the
   *  suite was seven views plus Customers, and one that silently survives
   *  every product added without a view. Most of the suite has none
   *  (MESITA-1949), so the view is written down per product and the cast is
   *  gone. Without this, seven new keys render verbs pointing at
   *  `/places/<id>/undefined` with every check green. */
  tab: PlaceTab | null;
  /** Mesita Partner unlocks it. */
  needsPartner: boolean;
  /** The per-place column(s) behind it, or null when the product is not a
   *  per-place switch (Profile, Visits, Payments). */
  atPlace: PlacePredicate | null;
  /** NOT BUILT, and the sentence that says so. A `soon` spec outranks every
   *  other branch below — no gate, no count, no verb — because a product that
   *  does not exist cannot be locked, off, or enabled. It used to be a
   *  hardcoded `key === "terminal"`, which is fine for one and a lie waiting
   *  for the second (MESITA-1884 brought Customers, and MESITA-1900 retired
   *  Terminal — the field outlived the product it was written for). */
  soon: string | null;
};

const SPECS: readonly ProductSpec[] = [
  {
    key: "profile",
    name: "Mesita Profile",
    blurb:
      "Your public page on Mesita — the photos, the menu, the hours and the reviews a guest reads before they pick you.",
    tab: "profile",
    needsPartner: false,
    atPlace: null,
    soon: null,
  },
  {
    key: "website",
    name: "Website",
    blurb:
      "A real site on your own domain, built from the profile you already keep here instead of from scratch.",
    tab: null,
    needsPartner: false,
    atPlace: null,
    soon: "Built from your Mesita profile. Nothing is live yet.",
  },
  {
    key: "customers",
    name: "Guest Catalog",
    blurb:
      "Subscribe to the catalog of everyone who has eaten here: who came back, how often, and what they spend a month.",
    tab: null,
    needsPartner: false,
    atPlace: null,
    // A SUBSCRIPTION, NOT A PURCHASE, AND NO LONGER "ALWAYS FREE".
    //
    // This note said "Always free. Nothing is live yet." on Pato's original
    // *"Costumers (Free)"*. He replaced the model on 2026-09-16: *"you don't
    // buy the data forever, you subscribe to a catalog of customers and you
    // can track their activity, visits per month, spent per month"*. Free was
    // a price for a product that no longer works that way, and this card was
    // the ONLY place in this console that stated any price for Customers —
    // `/places/<id>/customers` is a bare SoonStrip that claims nothing. A
    // catalogue card is where a venue learns what something costs, so leaving
    // "free" there is how one finds out otherwise at the till.
    soon: "A subscription, not a purchase. Nothing is live yet.",
  },
  {
    key: "ads",
    name: "Omnichannel Ads",
    blurb:
      "Reach the people who have not found you yet — Facebook, Instagram and Google, run from here instead of three dashboards.",
    tab: null,
    needsPartner: false,
    atPlace: null,
    soon: "Facebook, Instagram and Google. Nothing is connected yet.",
  },
  {
    key: "visits",
    name: "Member Visits",
    // ONE SENTENCE FOR BOTH HALVES (MESITA-2035), in the order they happen:
    // the bill closes, then a slice goes back. This is the mock's sentence,
    // word for word — the two consoles said this product's name two different
    // ways from MESITA-1949 until now, and one of them was going to be quoted
    // at an operator. The old pair said them separately and the second
    // ("you set the rungs, and you set the price") was the DIAL's own
    // sentence, which belongs on the dial, which is where Rewards' view is.
    blurb:
      "Close the bill at the table and give a slice of it back — cash or card settles the same way, and you switch on what earns it.",
    tab: "visits",
    needsPartner: true,
    // PARTNER-GATED, NOT `visitRewards` — the merged card may not read off the
    // dial. `atPlace: (p) => p.visitRewards === true` was the Rewards card's
    // predicate, and inheriting it here would print "Off" for a place whose
    // visits work fine: a card stating a fact that is not true. The card says
    // the product is available; the dial says how much comes back.
    atPlace: null,
    soon: null,
  },
  {
    key: "orders",
    name: "Online Orders",
    blurb:
      "Pickup and delivery, paid the moment the order is placed — a no-show costs the guest, never your kitchen.",
    tab: "orders",
    needsPartner: false,
    atPlace: (p) => p.pickupOrders === true || p.deliveryOrders === true,
    soon: null,
  },
  {
    key: "reservations",
    name: "Reservations",
    blurb:
      "The table bookings your own provider already holds, read here beside everything else this place does.",
    tab: "reservations",
    needsPartner: false,
    atPlace: (p) => p.reservations === true,
    soon: null,
  },
  {
    key: "pay",
    name: "Online Payments",
    // NO TAB, on purpose: the Stripe account is the sub-step `products/pay`,
    // not a view beside Visits and Orders. `payHref` below is its address.
    blurb:
      "This place’s own Stripe account, so a guest can pay by card at the table and the money lands with you.",
    tab: null,
    needsPartner: true,
    atPlace: null,
    soon: null,
  },
  {
    key: "terminal",
    name: "Physical Terminal",
    // BACK AFTER MESITA-1900 REMOVED IT, and still Soon for the same reason it
    // went: there is no hardware. The old blurb ("Take in-person payments with
    // Mesita hardware") named the box; this one names why a place that already
    // has Payments would want one.
    blurb:
      "A card reader on your counter for the guests who will never open their phone, on the same bill as everyone else.",
    tab: null,
    needsPartner: false,
    atPlace: null,
    soon: "Mesita hardware is not available yet.",
  },
  {
    key: "pos",
    name: "Point of Sale",
    // *"maybe include POS, but for the future"* (Pato, 2026-09-16). FOR THE
    // FUTURE IS A REAL DISTINCTION and the note carries it: everything else
    // here is unbuilt, but POS is the only one he put behind the others, and a
    // card reading exactly like Terminal's would lose that.
    //
    // THE BLURB HAS TO SAY WHAT IT IS NOT. A place that already has Visits and
    // Terminal can reasonably ask what a third counter product is for, so this
    // one names the half Mesita does not do today: the items, and the ticket to
    // the kitchen. Visits closes a bill; POS is what put the bill together.
    blurb:
      "The till itself — items rung up, the ticket to the kitchen, and the bill Visits closes, on one system.",
    tab: null,
    needsPartner: false,
    atPlace: null,
    soon: "The furthest out of everything here. Nothing is live yet.",
  },
  {
    key: "credits",
    name: "Prepaid Credits",
    blurb:
      "Branded money a guest buys once and can only spend here — paid up front, redeemed against a visit or an order.",
    tab: "credits",
    needsPartner: true,
    atPlace: (p) => p.credits === true,
    soon: null,
  },
  {
    key: "capital",
    name: "Mesita Capital",
    // THE LANDING PAGE'S OWN WORDS (MESITA-1929), on purpose: the pitch an
    // owner read before signing up is the pitch they meet inside. "Not a loan"
    // is load-bearing — Mesita buys inventory forward, it does not lend, and a
    // console that implies otherwise contradicts its own marketing site.
    //
    // MESITA-1949 took the second clause from `web-landing`'s own paragraph
    // ("Mesita pre-buys a restaurant's future meals at a deep discount and
    // resells that inventory to guests. The place gets cash now...") rather
    // than writing a new one: the mechanism is the reason the product is not a
    // loan, and a card that states only the cash states the half an owner
    // already believes.
    blurb:
      "Mesita pre-buys your future meals at a discount and resells them to guests — you take the cash now.",
    tab: "capital",
    needsPartner: false,
    atPlace: null,
    soon: "An advance sale of food, never a loan. Nothing is live yet.",
  },
  {
    key: "line",
    name: "Mesita Host",
    // IT ANSWERS A NUMBER, NOT AN APP, and the blurb has to say that or the
    // card reads as a WhatsApp widget. The two things it replaced were named
    // for their channels ("Mesita WhatsApp Bot", "Mesita Phone Bot"), which is
    // what made them look like two products; one line, two ways in.
    blurb:
      "Answers your number — a call or a WhatsApp — with the hours, the menu and the booking, so the floor never stops to pick up.",
    tab: null,
    needsPartner: false,
    atPlace: null,
    soon: "Nothing is answering yet.",
  },
  {
    key: "intelligence",
    name: "Market Intelligence",
    blurb:
      "What to change and why: who to bring back, what to charge, and where this place is quietly losing guests.",
    tab: null,
    needsPartner: false,
    atPlace: null,
    // IT READS THE OTHERS, and that is the honest prerequisite to state. An
    // advice engine over a place with no visits, no orders and no customer
    // catalog has nothing to be right about.
    soon: "Reads what your other products record. Nothing is live yet.",
  },
];

/** The catalogue's order — Pato's, read left to right, top to bottom.
 *
 *  THE RAIL IS A SUBSET OF IT NOW, NOT A COPY (MESITA-1949). `products.test.ts`
 *  used to assert the two were EQUAL element for element, because MESITA-1928
 *  proved they drift: it moved Rewards under Visits in the rail and left the
 *  catalogue printing it beside Payments, so for one commit the console gave
 *  two answers to "where does Rewards belong".
 *
 *  Most of the suite is catalogue-only, so equality is gone and the drift it
 *  caught is not: the assertion is a SUBSEQUENCE now. Every rail product is a
 *  real product AND the rail's relative order is this one, so moving Rewards in
 *  one list and not the other still fails — what no longer fails is naming a
 *  product the rail has no row for, which is the whole shape of an unbuilt
 *  product. */
export const PRODUCT_ORDER: readonly ProductKey[] = SPECS.map((s) => s.key);

// ── `PRODUCT_VIEW` IS DELETED, AND THE ROOMS ARE WHY (MESITA-1885) ────────
//
// It was a hand-written `Record<ProductKey, PlaceTab>`, and it had to be: six
// products pointed at two shared pages, so the mapping was a real decision
// nothing could derive. Orders, Reservations and Credits all landed on
// `capabilities` — one screen, three verbs, and the operator left to find
// which row was theirs.
//
// Pato put all eight products in the rail, which forced those rooms apart:
// `ZONE_ROWS` is keyed by product now and each product has a view of its own.
// So the map collapsed into the identity, and an identity map written out by
// hand is a second place for a spelling to drift.
//
// WHAT REPLACED IT WAS A CONSTRUCTION, AND MESITA-1949 MADE IT A FIELD AGAIN.
// `PLACE_TABS` and `PRODUCT_KEYS` agreed on all seven per-place products, so
// `placeHref(key as PlaceTab)` was true by coincidence and checked by a test.
// Most products have no view at all now, so the coincidence is
// over and `spec.tab` says it outright.
//
// THAT IS NOT THE HAND-WRITTEN MAP COMING BACK. `PRODUCT_VIEW` was a TOTAL
// `Record<ProductKey, PlaceTab>` — every product forced to name a view, so a
// spelling could drift in two files at once. `tab` is a property of the
// product beside its own name and blurb, it is allowed to be null, and the
// branches below simply do not render a verb without one. The failure it
// prevents is the one the cast could not: a product with no view rendering a
// button to `/places/<id>/undefined`.

// ── THE TWO FACTS ARE TWO CARDS AGAIN (MESITA-1900) ───────────────────────
//
// MESITA-1884 made Rewards a SENTENCE inside Visits — `rewardsClause`, a note
// reading "Rewards are on." or "No rewards set yet." — on Pato's *"should i
// separate visits and rewards into two?? i don't think so."* Pato's 2026-09-16
// list separates them, and the clause is deleted rather than kept beside the
// card: a fact stated in two places is the drift every comment on this page is
// about.
//
// THE TRAP MESITA-1884 NAMED IS STILL REAL, AND THE SPLIT IS WHAT DISARMS IT.
// The trap was: give VISITS' card the dial's state and a partner whose
// checkout works perfectly reads "Not enabled" because the discount happens to
// be 0%. That was true while one card carried both facts. Two cards, two
// states, neither borrowed — Visits' state is the container's (on for every
// partner, there is no column) and Rewards' is `visitRewards`, where "Not on
// here yet" is the dial's own truth and accuses nothing.
//
// A FAILED READ STILL PRINTS NOTHING. Rewards goes through the same `atPlace`
// branch as Orders, Reservations and Credits, which drops the note rather than
// claiming a switch is off.

export function buildProductCards(input: {
  partnered: boolean;
  mesitaPayEnabled: boolean;
  /** THE PLACE this catalogue is about, or null when the read FAILED. Null is
   *  the only absence there is now (MESITA-1892): the catalogue lives at
   *  `/places/<id>/products`, so a page that renders at all has a place, and
   *  the caller with none never reaches here — the flat `/products` answers
   *  with `NoPlaceYet` instead of forwarding nowhere. */
  place: ConsolePlace | null;
  /** Where a card's verb lands, given the VIEW that product is configured on
   *  — which, since MESITA-1885, is the view of the same name. It replaced a
   *  flat `placeHome` that sent every per-place product to Profile, a screen
   *  holding none of their switches (MESITA-1879). */
  placeHref: (view: PlaceTab) => string;
  /** Mesita Pay's own sub-step, under this same page. */
  payHref: string;
}): ProductCard[] {
  const { partnered, mesitaPayEnabled, place, placeHref, payHref } = input;
  /** A verb, but only where there is somewhere to send it. A spec with no tab
   *  in a branch that wants one would otherwise render a button pointing at
   *  `/places/<id>/undefined` — which is what `key as PlaceTab` did silently,
   *  and what every check would have passed. */
  const viewAction = (spec: ProductSpec, label: string) =>
    spec.tab ? { label, href: placeHref(spec.tab) } : null;

  return SPECS.map((spec): ProductCard => {
    // SOON FIRST, and it outranks everything below: nothing further down
    // applies to a product that does not exist. A `soon` card cannot be
    // locked (there is no subscription that would deliver it), cannot be off
    // (there is no switch), and must never be counted.
    if (spec.soon) {
      return {
        key: spec.key,
        name: spec.name,
        blurb: spec.blurb,
        state: "soon",
        note: spec.soon,
        action: null,
      };
    }

    // Profile: always free, always on, and the only card that says so.
    if (spec.key === "profile") {
      return {
        key: spec.key,
        name: spec.name,
        blurb: spec.blurb,
        state: "free",
        note: "Always free. Every place has one.",
        action: viewAction(spec, "Manage"),
      };
    }

    if (spec.needsPartner && !partnered) {
      return {
        key: spec.key,
        name: spec.name,
        blurb: spec.blurb,
        state: "locked",
        note: "Needs Mesita Partner.",
        action: null,
      };
    }

    // Mesita Payments: the one card whose verb stays on this page's own
    // sub-step, because the switch and the Stripe account it needs are one
    // subject and live together at `products/pay` — the KEY that address is
    // spelled with is `pay` and stays `pay` (lib/product-keys.ts).
    if (spec.key === "pay") {
      return {
        key: spec.key,
        name: spec.name,
        blurb: spec.blurb,
        state: mesitaPayEnabled ? "enabled" : "off",
        note: mesitaPayEnabled
          ? "On here. Guests can pay by card."
          : "Set up this place's Stripe account first.",
        action: { label: mesitaPayEnabled ? "Manage" : "Set up", href: payHref },
      };
    }

    // The per-place three: the state is this place's own column, and a failed
    // read drops the note instead of claiming the switch is off.
    if (spec.atPlace) {
      const enabled = place !== null && spec.atPlace(place);
      return {
        key: spec.key,
        name: spec.name,
        blurb: spec.blurb,
        state: enabled ? "enabled" : "off",
        note: place ? (enabled ? "On here." : "Not on here yet.") : null,
        action: viewAction(spec, enabled ? "Manage" : "Enable"),
      };
    }

    // WHAT IS LEFT IS VISITS, AND ONLY VISITS.
    //
    // Visits keeps no count because it has nothing to count: there is no
    // `visits_enabled` column (two tests assert its absence) and no ladder
    // rung. The subscription IS the state, so this is the Profile shape —
    // always on, one verb, no off — and the note says which subscription
    // rather than implying a switch the place does not have.
    //
    // IT IS ONE SENTENCE AGAIN (MESITA-1900). The rewards clause that rode
    // here since MESITA-1884 is Rewards' own card now, and a note that
    // reported another product's dial would be the second place that fact
    // lives.
    return {
      key: spec.key,
      name: spec.name,
      blurb: spec.blurb,
      state: "enabled",
      note: "Included with Mesita Partner.",
      action: viewAction(spec, "Manage"),
    };
  });
}
