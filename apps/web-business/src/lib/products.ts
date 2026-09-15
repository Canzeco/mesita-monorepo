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
//                        (`/orgs/<id>/customers` is a SoonStrip page). A price
//                        is not a reason to paint a green chip on an empty
//                        page, so the chip says the harder word and the note
//                        carries the price. No verb: Customers has its own
//                        rail row, so the door already exists.
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
//   Mesita Pay           the ORG switch `mesita_pay_enabled`, on top of
//                        Partner. The one product turned on at this level.
//   Mesita Credits       `credits_enabled`, per place. Partner-gated too —
//                        Accept Prepays is in PARTNER_PERKS — so a
//                        non-partner reads Locked, not Not enabled.
//   Mesita Terminal      hardware. NOT BUILT: Soon, no count, no verb.
//
// ── THE TWO RULES THIS FILE EXISTS TO HOLD ────────────────────────────────
//
// A NULL PLACES READ PRINTS NO NUMBER. `places: null` means the read failed,
// and every per-place card drops its note rather than printing "On at 0 of 0".
// Zero is the most believable fabrication on a catalogue screen, and a
// fabricated number is what SoonStrip's law forbids outright.
//
// PARTNER-GATED BEATS OFF. A product the organization cannot reach yet reads
// `locked` with the prerequisite as its note — never `off` with an Enable
// button that would walk an operator to a switch they cannot move. That is
// the ladder grammar Capabilities already uses (offerings.ts), in a grid.
import type { ConsolePlace } from "@/lib/api/organizations";
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

/** "On at 2 of 5 places", or null when the places could not be read. Singular
 *  where it matters: "1 place" reads as a sentence, "1 places" reads as a bug
 *  and is the first thing anyone notices on a screen like this. */
function placeNote(on: number, total: number): string {
  const places = total === 1 ? "1 place" : `${total} places`;
  if (total === 0) return "No places yet.";
  if (on === 0) return `Off at all ${places}.`;
  if (on === total) return `On at ${on === 1 ? "your one place" : `all ${places}`}.`;
  return `On at ${on} of ${places}.`;
}

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
// It obeys the same no-fabrication rule as every count on this page: a failed
// read and an organization with no places both drop the clause rather than
// print a zero.
function rewardsClause(places: readonly ConsolePlace[] | null): string {
  if (!places || places.length === 0) return "Every place has one.";
  const on = places.filter((p) => p.visitRewards === true).length;
  if (on === 0) return "No rewards set yet.";
  if (on < places.length) return `Rewards on at ${on} of ${places.length} places.`;
  return places.length === 1
    ? "Rewards on at your one place."
    : `Rewards on at all ${places.length} places.`;
}

export function buildProductCards(input: {
  partnered: boolean;
  mesitaPayEnabled: boolean;
  /** Null means the read FAILED. An empty array means the organization holds
   *  no place — two different facts, and a card says two different things. */
  places: readonly ConsolePlace[] | null;
  /** Where a card's verb lands, given the VIEW that product is configured on
   *  — which, since MESITA-1885, is the view of the same name. The caller
   *  decides what a view means when there is no single place to name: the Add
   *  ceremony with none, the list with several, so this module never has to
   *  know which. It replaced a flat `placeHome` that sent every per-place
   *  product to Profile, a screen holding none of their switches
   *  (MESITA-1879). */
  placeHref: (view: PlaceTab) => string;
  /** The organization holds NO place, so `placeHref` returns the Add
   *  ceremony. The verb has to say so: "Enable" on a button that opens Add
   *  place is a promise the next screen does not keep. */
  noPlaces: boolean;
  /** Mesita Pay's own box, at the foot of this same page. */
  payHref: string;
}): ProductCard[] {
  const { partnered, mesitaPayEnabled, places, placeHref, payHref, noPlaces } =
    input;
  /** Every per-place verb lands on the view that actually holds its switch. */
  // A product's own view, by its own name. Every card that reaches this has a
  // place view — the two that do not are `soon` and return above, carrying no
  // verb at all.
  const viewHref = (key: ProductKey) => placeHref(key as PlaceTab);
  const total = places?.length ?? 0;
  /** Every verb that lands on a place says what the next screen actually is. */
  const verb = (word: string) => (noPlaces ? "Add a place" : word);

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
        action: { label: verb("Manage"), href: viewHref(spec.key) },
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

    // Mesita Pay: the one ORG-level switch, so its verb stays on this page.
    if (spec.key === "pay") {
      return {
        key: spec.key,
        name: spec.name,
        blurb: spec.blurb,
        state: mesitaPayEnabled ? "enabled" : "off",
        note: mesitaPayEnabled
          ? "On for the organization. Each place turns it on too."
          : "Set up the organization's Stripe account first.",
        action: { label: mesitaPayEnabled ? "Manage" : "Set up", href: payHref },
      };
    }

    // The per-place three: the state is the COUNT, and no count means no
    // claim — a failed read drops the note instead of printing a zero.
    if (spec.atPlace) {
      const on = places ? places.filter(spec.atPlace).length : 0;
      const enabled = places !== null && on > 0;
      return {
        key: spec.key,
        name: spec.name,
        blurb: spec.blurb,
        state: enabled ? "enabled" : "off",
        note: places ? placeNote(on, total) : null,
        action: {
          label: verb(enabled ? "Manage" : "Enable"),
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
      note: `Included with Mesita Partner. ${rewardsClause(places)}`,
      action: { label: verb("Manage"), href: viewHref(spec.key) },
    };
  });
}
