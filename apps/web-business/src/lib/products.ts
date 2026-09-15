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
//   Mesita Visits        guest checks at the bill. Partner-gated, no per-place
//                        column of its own: the subscription IS the state.
//   Mesita Orders        `pickup_orders_enabled` OR `delivery_orders_enabled`,
//                        per place. One card, because an operator thinks
//                        "orders" and the two columns are its two shapes.
//   Mesita Reservations  `reservations_enabled`, per place.
//   Mesita Rewards       visit discounts and cashback. Partner-gated; the
//                        strategy itself is per place, on Rewards.
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
};

const SPECS: readonly ProductSpec[] = [
  {
    key: "profile",
    name: "Mesita Profile",
    blurb: "Manage your places, menus, photos and reviews.",
    needsPartner: false,
    atPlace: null,
  },
  {
    key: "visits",
    name: "Mesita Visits",
    blurb: "Close in-person bills with a simple visit checkout.",
    needsPartner: true,
    atPlace: null,
  },
  {
    key: "orders",
    name: "Mesita Orders",
    blurb: "Receive pickup and delivery orders with checkout.",
    needsPartner: false,
    atPlace: (p) => p.pickupOrders === true || p.deliveryOrders === true,
  },
  {
    key: "reservations",
    name: "Mesita Reservations",
    blurb: "Manage table bookings with your preferred provider.",
    needsPartner: false,
    atPlace: (p) => p.reservations === true,
  },
  {
    key: "rewards",
    name: "Mesita Rewards",
    blurb: "Offer visit discounts and cashback to your guests.",
    needsPartner: true,
    atPlace: null,
  },
  {
    key: "pay",
    name: "Mesita Pay",
    blurb: "Accept card payments for visits and orders.",
    needsPartner: true,
    atPlace: null,
  },
  {
    key: "credits",
    name: "Mesita Credits",
    blurb: "Sell and accept branded credits for visits and orders.",
    needsPartner: true,
    atPlace: (p) => p.credits === true,
  },
  {
    key: "terminal",
    name: "Mesita Terminal",
    blurb: "Take in-person payments with Mesita hardware.",
    needsPartner: false,
    atPlace: null,
  },
];

/** The catalogue's order — the mock's, read left to right, top to bottom. */
export const PRODUCT_ORDER: readonly ProductKey[] = SPECS.map((s) => s.key);

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

export function buildProductCards(input: {
  partnered: boolean;
  mesitaPayEnabled: boolean;
  /** Null means the read FAILED. An empty array means the organization holds
   *  no place — two different facts, and a card says two different things. */
  places: readonly ConsolePlace[] | null;
  /** Where a per-place product is turned on: the place, the list, or Add. */
  placeHome: string;
  /** The organization holds NO place, so `placeHome` is the Add ceremony.
   *  The verb has to say so: "Enable" on a button that opens Add place is a
   *  promise the next screen does not keep. */
  noPlaces: boolean;
  /** Mesita Pay's own box, at the foot of this same page. */
  payHref: string;
}): ProductCard[] {
  const { partnered, mesitaPayEnabled, places, placeHome, payHref, noPlaces } =
    input;
  const total = places?.length ?? 0;
  /** Every verb that lands on a place says what the next screen actually is. */
  const verb = (word: string) => (noPlaces ? "Add a place" : word);

  return SPECS.map((spec): ProductCard => {
    // Terminal first: nothing below applies to a product that does not exist.
    if (spec.key === "terminal") {
      return {
        key: spec.key,
        name: spec.name,
        blurb: spec.blurb,
        state: "soon",
        note: "Mesita hardware is not available yet.",
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
        action: { label: verb("Manage"), href: placeHome },
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
          href: placeHome,
        },
      };
    }

    // What is left is partner-gated and has no column of its own: Visits and
    // Rewards. The subscription turned them on; the place chooses how far.
    return {
      key: spec.key,
      name: spec.name,
      blurb: spec.blurb,
      state: "enabled",
      note: "Included with Mesita Partner. Each place sets its own.",
      action: { label: verb("Manage"), href: placeHome },
    };
  });
}
