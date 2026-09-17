// What a product's STATE is — pure, and the catalogue's only source of truth.
//
// Snapshot of `apps/web-business/src/lib/products.ts`. A card states a fact the
// console READ: partner-gated products read Locked and carry NO verb, a
// per-place product prints whether it is on HERE, and an unbuilt one is Soon.
//
// ── WHAT A BLURB OWES (MESITA-1946) ────────────────────────────────────────
//
// Pato: *"add better descriptions"*. The blurbs used to be one clause each,
// written from the COLUMN they flip — "Receive pickup and delivery orders with
// checkout", "Accept card payments for visits and orders". Set a dozen of those
// in a grid and they are one grey paragraph a dozen times: every card opens
// with a verb Mesita does, none of them says who is better off, and an operator
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
// ── MOST OF THE SUITE DOES NOT EXIST YET ───────────────────────────────────
//
// Pato, 2026-09-16, with the whole list: *"Put all this shit into the suite"*,
// then *"maybe include POS, but for the future"*. Seven products arrive with
// that — Website, Ads, Terminal, POS, WhatsApp Bot, Phone Bot and Intelligence
// — and NOT ONE of them is built. Neither were Customers and Capital, which is
// why `soon` already outranks every other branch below.
//
// He wrote "(Soon)" beside three of them. The rest get it too, and that is the
// one place this file does not take his list literally: there is no table, no
// migration and no Edge Function behind any of them, and SoonStrip's law is
// that an unbuilt engine shows Soon, never knobs and never a fake number. A
// green chip on a WhatsApp bot that cannot answer anything is the single most
// expensive lie this screen could tell — an owner reads it as "already
// handled" and stops picking up the phone.
//
// SO ONLY SEVEN CARDS ARE LIVE: Profile, Visits, Rewards, Orders,
// Reservations, Payments and Credits. That ratio is the point of the screen,
// not a defect in it — the catalogue is a price list before it is a control
// panel, and an operator has to be able to read the whole suite before they
// can want any of it.
//
// THIS IS THE DRIFT THE PACKAGE ALLOWS, and it runs in the mock's direction:
// `web-business` still has its nine products and the old clauses until
// somebody re-snapshots it by hand.
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
  /** The VIEW this product is turned on in, when it has one.
   *
   *  NULL IS THE COMMON CASE NOW, and it is why this field exists at all.
   *  `PLACE_TABS` ⊇ `PRODUCT_KEYS` used to hold, so the catalogue could reach
   *  a product's view with `key as PlaceTab` — a cast that was true by
   *  coincidence and silently survives every product added without one. Most
   *  of the suite has no view now: Customers is a page, Payments is the
   *  sub-step `products/pay`, and every Soon product but Capital has nothing
   *  to open at all. So the tab is written down per product, and the cast is
   *  gone. */
  tab: PlaceTab | null;
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
    tab: "profile",
    needsPartner: false,
    atPlace: null,
    soon: null,
  },
  {
    key: "website",
    name: "Mesita Website",
    blurb:
      "A real site on your own domain, built from the profile you already keep here instead of from scratch.",
    tab: null,
    needsPartner: false,
    atPlace: null,
    soon: "Built from your Mesita profile. Nothing is live yet.",
  },
  {
    key: "customers",
    name: "Mesita Customers",
    blurb:
      "Subscribe to the catalog of everyone who has eaten here: who came back, how often, and what they spend a month.",
    tab: null,
    needsPartner: false,
    atPlace: null,
    // A SUBSCRIPTION, NOT A PURCHASE (MESITA-1941). This card said "Always
    // free" while the page under it sold a contact at a time; both were the
    // old model, and a catalogue card that prices a product differently from
    // its own page is how a venue finds out at the till.
    soon: "A subscription, not a purchase. Nothing is live yet.",
  },
  {
    key: "ads",
    name: "Mesita Ads",
    blurb:
      "Reach the people who have not found you yet — Facebook, Instagram and Google, run from here instead of three dashboards.",
    tab: null,
    needsPartner: false,
    atPlace: null,
    soon: "Facebook, Instagram and Google. Nothing is connected yet.",
  },
  {
    key: "visits",
    name: "Mesita Visit Rewards",
    // ONE SENTENCE FOR BOTH HALVES (MESITA-1953), in the order they happen:
    // the bill closes, then a slice goes back. The old pair said them
    // separately and the second one ("you set the rungs, you set the price")
    // was the dial's own sentence — it belongs on the dial, which is where
    // Rewards' view still is.
    blurb:
      "Close the bill at the table and give a slice of it back — cash or card settles the same way, and you set what comes back.",
    tab: "visits",
    needsPartner: true,
    // PARTNER-GATED, NOT `visitRewards`. Visits is included with the
    // Membership and has no per-place switch; only the rewards half has one.
    // Reading the merged card off that toggle would print "Off" for a place
    // whose visits work fine — a card stating a fact that is not true, which
    // is the one thing this grid may not do. The card says the product is
    // available; the dial says how much comes back.
    atPlace: null,
    soon: null,
  },
  {
    key: "orders",
    name: "Mesita Orders",
    blurb:
      "Pickup and delivery, paid the moment the order is placed — a no-show costs the guest, never your kitchen.",
    tab: "orders",
    needsPartner: false,
    atPlace: (p) => p.pickupOrders || p.deliveryOrders,
    soon: null,
  },
  {
    key: "reservations",
    name: "Mesita Reservations",
    blurb:
      "The table bookings your own provider already holds, read here beside everything else this place does.",
    tab: "reservations",
    needsPartner: false,
    atPlace: (p) => p.reservations,
    soon: null,
  },
  {
    key: "pay",
    name: "Mesita Payments",
    // NO TAB, on purpose: this place's Stripe account is the sub-step
    // `products/pay`, not a view beside Visits and Orders.
    blurb:
      "This place’s own Stripe account, so a guest can pay by card at the table and the money lands with you.",
    tab: null,
    needsPartner: true,
    atPlace: null,
    soon: null,
  },
  {
    key: "terminal",
    name: "Mesita Terminal",
    // BACK AFTER MESITA-1900 TOOK IT OUT, on Pato's 2026-09-16 list, and still
    // Soon for the same reason it left: there is no hardware. The old blurb
    // ("Take in-person payments with Mesita hardware") named the box; this one
    // names why a place that already has Payments would want one.
    blurb:
      "A card reader on your counter for the guests who will never open their phone, on the same bill as everyone else.",
    tab: null,
    needsPartner: false,
    atPlace: null,
    soon: "Mesita hardware is not available yet.",
  },
  {
    key: "pos",
    name: "Mesita POS",
    // *"maybe include POS, but for the future"* (Pato, 2026-09-16). FOR THE
    // FUTURE IS A REAL DISTINCTION and the note carries it: everything else
    // here is unbuilt, but POS is the only one he put behind the others, and a
    // card that reads exactly like Terminal's would lose that.
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
    name: "Mesita Credits",
    blurb:
      "Branded money a guest buys once and can only spend here — paid up front, redeemed against a visit or an order.",
    tab: "credits",
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
    tab: "capital",
    needsPartner: false,
    atPlace: null,
    soon: "An advance sale of food, never a loan. Nothing is live yet.",
  },
  {
    key: "whatsapp",
    name: "Mesita WhatsApp Bot",
    blurb:
      "Answers the hours, the menu and the booking on WhatsApp, so nobody on the floor has to stop and type.",
    tab: null,
    needsPartner: false,
    atPlace: null,
    soon: "Nothing is answering yet.",
  },
  {
    key: "phone",
    name: "Mesita Phone Bot",
    blurb:
      "Picks up when the floor is full and takes the booking, instead of letting the line ring out.",
    tab: null,
    needsPartner: false,
    atPlace: null,
    soon: "Nothing is picking up yet.",
  },
  {
    key: "intelligence",
    name: "Mesita Intelligence",
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
  /** A verb, but only where there is somewhere to send it. A spec with no tab
   *  in a branch that wants one would otherwise render a button to `/places/
   *  <id>/undefined`. */
  const viewAction = (spec: ProductSpec, label: string) =>
    spec.tab ? { label, href: placeHref(spec.tab) } : null;
  return SPECS.map((spec): ProductCard => {
    if (spec.soon) {
      return { ...base(spec), state: "soon", note: spec.soon, action: null };
    }
    if (spec.key === "profile") {
      return {
        ...base(spec),
        state: "free",
        note: "Always free. Every place has one.",
        action: viewAction(spec, "Manage"),
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
        action: viewAction(spec, enabled ? "Manage" : "Enable"),
      };
    }
    return {
      ...base(spec),
      state: "enabled",
      note: "Included with Mesita Partner.",
      action: viewAction(spec, "Manage"),
    };
  });
}

function base(spec: ProductSpec) {
  return { key: spec.key, name: spec.name, blurb: spec.blurb };
}
