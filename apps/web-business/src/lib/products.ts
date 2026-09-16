// THE PRODUCT VOCABULARY, and the one function that states each product's
// facts (MESITA-1869).
//
// Pure, and deliberately so: every card the catalogue draws comes out of here,
// so "what is this product called, what does it do, and is it on" is asserted
// by a test instead of read off a screenshot. `ProductCatalog.tsx` owns the
// LOOK (mark, tint, chip); this owns the TRUTH.
//
// ── THE EIGHT, AND WHAT EACH ONE'S STATE IS READ FROM ─────────────────────
//
//   Mesita Profile       ALWAYS FREE. Pato: *"remember that profile is
//                        free."* Every place has a profile the moment it
//                        exists — there is no column to flip and no price, so
//                        it is the one card with no off state and no verb but
//                        Manage.
//   Mesita Customers     who keeps coming back. It WILL be free, exactly like
//                        Profile — Pato wrote it "Costumers (Free)" — and it
//                        is `soon` anyway, because the engine is not built
//                        (`/places/<id>/customers` is a SoonStrip page). A
//                        price is not a reason to paint a green chip on an
//                        empty page, so the chip says the harder word and the
//                        note carries the price. No verb: Customers has its
//                        own rail row, so the door already exists.
//   Mesita Visits        guest checks at the bill. Partner-gated, and the
//                        subscription IS the state — so it is ALWAYS ON for a
//                        partner, the Profile pattern, never an on/off card
//                        (MESITA-1882). Visits is not a capability; it is the
//                        container Rewards, Payments and Credits attach to,
//                        which is why it has no column, no ladder rung and no
//                        second sentence: `rewardsClause` went with Rewards
//                        when Rewards became a card again (MESITA-1900).
//   Mesita Rewards       `visit_rewards`, per place. Partner-gated, because
//                        Conservative and Aggressive are what the Membership
//                        prices. THE CARD'S STATE IS THE DIAL'S, and that is
//                        only honest now that the dial has a card of its own:
//                        a Rewards card at 0% reads "Not on here yet", which
//                        is what it is. MESITA-1882's bug was the opposite —
//                        Enabled at Zero — and MESITA-1884 feared this state
//                        because back then it was VISITS' card, where "Not
//                        enabled" would have accused a working checkout.
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
// MESITA TERMINAL IS GONE (MESITA-1900). Pato's list drops it. It was the one
// card with no engine, no column and no switch, and `soon` was the whole of
// its spec — so nothing about it is worth keeping behind a flag.
//
// ── THE TWO RULES THIS FILE EXISTS TO HOLD ────────────────────────────────
//
// A NULL PLACE READ PRINTS NOTHING. `place: null` means the read failed, and
// every card drops its note rather than printing "Off". Off is the most
// believable fabrication on a catalogue screen, and a fabricated state is what
// SoonStrip's law forbids outright.
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
    blurb: "Manage your places, menus, photos and reviews.",
    needsPartner: false,
    atPlace: null,
    soon: null,
  },
  {
    key: "customers",
    name: "Mesita Customers",
    blurb: "See who keeps coming back, and what they spend.",
    needsPartner: false,
    atPlace: null,
    // FREE AND UNBUILT ARE BOTH TRUE, and the chip may only say one of them.
    // It says the harder one. The price goes in the note, where it costs an
    // operator nothing to learn it early.
    soon: "Always free. Nothing is live yet.",
  },
  {
    key: "visits",
    name: "Mesita Visits",
    blurb: "Close in-person bills with a simple visit checkout.",
    needsPartner: true,
    atPlace: null,
    soon: null,
  },
  {
    key: "rewards",
    name: "Mesita Rewards",
    blurb: "Give guests a reason to come back, priced by you.",
    needsPartner: true,
    atPlace: (p) => p.visitRewards === true,
    soon: null,
  },
  {
    key: "orders",
    name: "Mesita Orders",
    blurb: "Receive pickup and delivery orders with checkout.",
    needsPartner: false,
    atPlace: (p) => p.pickupOrders === true || p.deliveryOrders === true,
    soon: null,
  },
  {
    key: "reservations",
    name: "Mesita Reservations",
    blurb: "Manage table bookings with your preferred provider.",
    needsPartner: false,
    atPlace: (p) => p.reservations === true,
    soon: null,
  },
  {
    key: "pay",
    name: "Mesita Payments",
    blurb: "Accept card payments for visits and orders.",
    needsPartner: true,
    atPlace: null,
    soon: null,
  },
  {
    key: "credits",
    name: "Mesita Credits",
    blurb: "Sell and accept branded credits for visits and orders.",
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
    blurb: "Take cash now against meals you have not served yet.",
    needsPartner: false,
    atPlace: null,
    soon: "An advance sale of food, never a loan. Nothing is live yet.",
  },
];

/** The catalogue's order — the mock's, read left to right, top to bottom.
 *
 *  IT MUST MATCH THE RAIL'S, and `products.test.ts` asserts that rather than
 *  trusting it. The two are different arrays — `SPECS` carries card copy,
 *  `RAIL_ROWS` carries rows — and MESITA-1928 proved they drift: it moved
 *  Rewards under Visits in the rail and left the catalogue printing it beside
 *  Payments, so for one commit the console gave two answers to "where does
 *  Rewards belong". A card and a row for one product in two places is the same
 *  bug as a product with two icons. */
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
// WHAT REPLACED IT IS A CONSTRUCTION, NOT A CONVENTION. `PLACE_TABS` and
// `PRODUCT_KEYS` agree on all seven per-place products — Rewards joined them
// in MESITA-1900 — and `console-routes.test.ts` asserts that set equality in
// BOTH directions, so `placeHref(key as PlaceTab)` is checked by a test rather
// than trusted. The ONE that is not a place view is Customers: it is `soon`,
// it carries no verb, and `productRowHref` in lib/console-routes is the one
// function that knows its address.

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
  // A product's own view, by its own name. Every card that reaches this has a
  // place view — the one that does not (Customers) is `soon` and returns
  // above, carrying no verb at all.
  const viewHref = (key: ProductKey) => placeHref(key as PlaceTab);

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
        action: { label: "Manage", href: viewHref(spec.key) },
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
        action: {
          label: enabled ? "Manage" : "Enable",
          href: viewHref(spec.key),
        },
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
      action: { label: "Manage", href: viewHref(spec.key) },
    };
  });
}
