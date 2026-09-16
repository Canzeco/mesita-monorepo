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
//                        container Rewards, Pay and Credits attach to, which
//                        is why it has no column, no rail row and no ladder
//                        rung anywhere else in this console either.
//                        REWARDS IS NOW ITS SECOND SENTENCE (MESITA-1884) —
//                        see `rewardsClause` for why that is a note and never
//                        a state.
//   Mesita Orders        `pickup_orders_enabled` OR `delivery_orders_enabled`,
//                        per place. One card, because an operator thinks
//                        "orders" and the two columns are its two shapes.
//   Mesita Reservations  `reservations_enabled`, per place.
//   Mesita Pay           `place_profiles.mesita_pay_enabled`, on top of
//                        Partner. Its switch lives with the Stripe account it
//                        needs, at `products/pay`, which is why it is the one
//                        card whose verb stays on this page's own sub-step.
//   Mesita Credits       `credits_enabled`, per place. Partner-gated too —
//                        Accept Prepays is in PARTNER_PERKS — so a
//                        non-partner reads Locked, not Not enabled.
//   Mesita Terminal      hardware. NOT BUILT: Soon, no count, no verb.
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
import type { ProductCard, ProductKey } from "@/components/console/ProductCatalog";

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
   *  per-place switch (Profile, Pay, Terminal). */
  atPlace: PlacePredicate | null;
  /** NOT BUILT, and the sentence that says so. A `soon` spec outranks every
   *  other branch below — no gate, no count, no verb — because a product that
   *  does not exist cannot be locked, off, or enabled. It used to be a
   *  hardcoded `key === "terminal"`, which is fine for one and a lie waiting
   *  for the second (MESITA-1884 brought Customers). */
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
    name: "Mesita Pay",
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
    key: "terminal",
    name: "Mesita Terminal",
    blurb: "Take in-person payments with Mesita hardware.",
    needsPartner: false,
    atPlace: null,
    soon: "Mesita hardware is not available yet.",
  },
];

/** The catalogue's order — the mock's, read left to right, top to bottom. */
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
// `PRODUCT_KEYS` agree on all six per-place products, and
// `console-routes.test.ts` asserts that set equality in BOTH directions —
// so `placeHref(key as PlaceTab)` is checked by a test rather than trusted.
// The two that are not place views (Customers, Terminal) never ask: they are
// `soon`, they carry no verb, and `productRowHref` in lib/console-routes is
// the one function that knows their addresses.

// ── REWARDS IS A SENTENCE INSIDE VISITS, NEVER A STATE (MESITA-1884) ──────
//
// Pato: *"should i separate visits and rewards into two?? i don't think so."*
// He is right, and the merge has exactly one trap in it.
//
// THE TRAP: give the merged card the DIAL's state and it lies the other way.
// MESITA-1882 fixed a Rewards card that claimed Enabled at Zero. Fold Rewards
// into Visits by taking `visitRewards` as the card's state, and a partner
// whose visit checkout works perfectly — guests scan, the bill closes, money
// moves — reads **"Not enabled"** because the discount happens to be 0%. That
// is a fresh lie pointing the opposite way, on the same screen, about the same
// two facts.
//
// So the two facts stay two. Visits' STATE is the container's (on for every
// partner, there is no column), and the dial goes in the second sentence,
// where "no rewards set yet" is information and not an accusation that
// checkout is broken.
//
// It obeys the same no-fabrication rule as every note on this page: a failed
// read drops the clause rather than claiming nothing is set.
function rewardsClause(place: ConsolePlace | null): string {
  if (!place) return "";
  return place.visitRewards === true
    ? "Rewards are on."
    : "No rewards set yet.";
}

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
  // place view — the two that do not are `soon` and return above, carrying no
  // verb at all.
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

    // Mesita Pay: the one card whose verb stays on this page's own sub-step,
    // because the switch and the Stripe account it needs are one subject and
    // live together at `products/pay`.
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
    // `visits_enabled` column (two tests assert its absence), no rail row and
    // no ladder rung. The subscription IS the state, so this is the Profile
    // shape — always on, one verb, no off — and the note says which
    // subscription rather than implying a switch the place does not have.
    return {
      key: spec.key,
      name: spec.name,
      blurb: spec.blurb,
      state: "enabled",
      note: `Included with Mesita Partner. ${rewardsClause(place)}`.trim(),
      action: { label: "Manage", href: viewHref(spec.key) },
    };
  });
}
