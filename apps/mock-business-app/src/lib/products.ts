// What a product's STATE is — pure, and the catalogue's only source of truth.
//
// Snapshot of `apps/web-business/src/lib/products.ts`. A card states a fact the
// console READ: partner-gated products read Locked and carry NO verb, a
// per-place product prints whether it is on HERE, and Customers is Soon.
//
// ── WHAT A BLURB OWES (MESITA-1946) ────────────────────────────────────────
//
// Pato: *"add better descriptions"*. The nine below used to be one clause each,
// written from the COLUMN they flip — "Receive pickup and delivery orders with
// checkout", "Accept card payments for visits and orders". Set nine of those in
// a grid and they are one grey paragraph nine times: every card opens with a
// verb Mesita does, none of them says who is better off, and an operator
// meeting the catalogue for the first time cannot tell Orders from Visits or
// Credits from Payments without opening both.
//
// So a blurb names the GUEST and the venue, and carries the one fact that
// distinguishes this product from its neighbour — orders are PREPAID, a visit
// settles the same whether the guest paid cash or card, credits can only be
// spent here, reservations are held by somebody else's provider. It is still
// one sentence, and it still ends in a period: `web-business` pins that shape
// in `products.test.ts`, and this file is that file's snapshot.
//
// THIS IS THE DRIFT THE PACKAGE ALLOWS, and it runs in the mock's direction:
// `web-business` still carries the old clauses until somebody re-snapshots it
// by hand.
import type { PlaceTab } from "@/lib/place-tabs";
import type { ProductKey } from "@/lib/product-keys";
import type { MockPlace } from "@/mock/types";

export type ProductState = "free" | "enabled" | "off" | "locked" | "soon";

export type ProductCard = {
  key: ProductKey;
  name: string;
  blurb: string;
  state: ProductState;
  note: string | null;
  action: { label: string; href: string } | null;
};

type PlacePredicate = (p: MockPlace) => boolean;

type ProductSpec = {
  key: ProductKey;
  name: string;
  blurb: string;
  needsPartner: boolean;
  atPlace: PlacePredicate | null;
  soon: string | null;
};

const SPECS: readonly ProductSpec[] = [
  {
    key: "profile",
    name: "Mesita Profile",
    blurb:
      "Your public page on Mesita — the photos, the menu, the hours and the reviews a guest reads before they pick you.",
    needsPartner: false,
    atPlace: null,
    soon: null,
  },
  {
    key: "customers",
    name: "Mesita Customers",
    blurb:
      "Subscribe to the catalog of everyone who has eaten here: who came back, how often, and what they spend a month.",
    needsPartner: false,
    atPlace: null,
    // A SUBSCRIPTION, NOT A PURCHASE (MESITA-1941). This card said "Always
    // free" while the page under it sold a contact at a time; both were the
    // old model, and a catalogue card that prices a product differently from
    // its own page is how a venue finds out at the till.
    soon: "A subscription, not a purchase. Nothing is live yet.",
  },
  {
    key: "visits",
    name: "Mesita Visits",
    blurb:
      "Close the bill at the table, and keep every visit on the record — cash or card, it settles the same way.",
    needsPartner: true,
    atPlace: null,
    soon: null,
  },
  {
    key: "rewards",
    name: "Mesita Rewards",
    blurb:
      "Give a slice of the bill back to the guests who keep showing up — you set the rungs, and you set the price.",
    needsPartner: true,
    atPlace: (p) => p.visitRewards,
    soon: null,
  },
  {
    key: "orders",
    name: "Mesita Orders",
    blurb:
      "Pickup and delivery, paid the moment the order is placed — a no-show costs the guest, never your kitchen.",
    needsPartner: false,
    atPlace: (p) => p.pickupOrders || p.deliveryOrders,
    soon: null,
  },
  {
    key: "reservations",
    name: "Mesita Reservations",
    blurb:
      "The table bookings your own provider already holds, read here beside everything else this place does.",
    needsPartner: false,
    atPlace: (p) => p.reservations,
    soon: null,
  },
  {
    key: "pay",
    name: "Mesita Payments",
    blurb:
      "This place’s own Stripe account, so a guest can pay by card at the table and the money lands with you.",
    needsPartner: true,
    atPlace: null,
    soon: null,
  },
  {
    key: "credits",
    name: "Mesita Credits",
    blurb:
      "Branded money a guest buys once and can only spend here — paid up front, redeemed against a visit or an order.",
    needsPartner: true,
    atPlace: (p) => p.credits,
    soon: null,
  },
  {
    key: "capital",
    name: "Mesita Capital",
    // THE LANDING PAGE'S OWN WORDS, on purpose: the pitch an owner read before
    // signing up is the pitch they meet inside. "Not a loan" is load-bearing —
    // Mesita buys inventory forward, it does not lend, so the verb here is
    // always BUY and the word never appears.
    //
    // MESITA-1946 took the second clause from `web-landing`'s own paragraph
    // ("Mesita pre-buys a restaurant's future meals at a deep discount and
    // resells that inventory to guests. The place gets cash now...") rather
    // than writing a new one: the mechanism is the reason the product is not a
    // loan, and a card that states only the cash states the half an owner
    // already believes.
    blurb:
      "Mesita pre-buys your future meals at a discount and resells them to guests — you take the cash now.",
    needsPartner: false,
    atPlace: null,
    soon: "An advance sale of food, never a loan. Nothing is live yet.",
  },
];

export const PRODUCT_ORDER: readonly ProductKey[] = SPECS.map((s) => s.key);

export function buildProductCards(input: {
  partnered: boolean;
  mesitaPayEnabled: boolean;
  /** NULL MEANS THE READ FAILED. An empty portfolio is a different fact, and a
   *  card must not print a count it did not read. */
  place: MockPlace | null;
  placeHref: (view: PlaceTab) => string;
  payHref: string;
}): ProductCard[] {
  const { partnered, mesitaPayEnabled, place, placeHref, payHref } = input;
  const viewHref = (key: ProductKey) => placeHref(key as PlaceTab);
  return SPECS.map((spec): ProductCard => {
    if (spec.soon) {
      return { ...base(spec), state: "soon", note: spec.soon, action: null };
    }
    if (spec.key === "profile") {
      return {
        ...base(spec),
        state: "free",
        note: "Always free. Every place has one.",
        action: { label: "Manage", href: viewHref(spec.key) },
      };
    }
    // LOCKED CARRIES NO VERB. A button on a product the caller cannot have is
    // an invitation to a 403.
    if (spec.needsPartner && !partnered) {
      return {
        ...base(spec),
        state: "locked",
        note: "Needs Mesita Partner.",
        action: null,
      };
    }
    if (spec.key === "pay") {
      return {
        ...base(spec),
        state: mesitaPayEnabled ? "enabled" : "off",
        note: mesitaPayEnabled
          ? "On here. Guests can pay by card."
          : "Set up this place's Stripe account first.",
        action: { label: mesitaPayEnabled ? "Manage" : "Set up", href: payHref },
      };
    }
    if (spec.atPlace) {
      const enabled = place !== null && spec.atPlace(place);
      return {
        ...base(spec),
        state: enabled ? "enabled" : "off",
        note: place ? (enabled ? "On here." : "Not on here yet.") : null,
        action: {
          label: enabled ? "Manage" : "Enable",
          href: viewHref(spec.key),
        },
      };
    }
    return {
      ...base(spec),
      state: "enabled",
      note: "Included with Mesita Partner.",
      action: { label: "Manage", href: viewHref(spec.key) },
    };
  });
}

function base(spec: ProductSpec) {
  return { key: spec.key, name: spec.name, blurb: spec.blurb };
}
