// WHAT A RUNG MAY NOT DO TO ITS NEIGHBOURS (MESITA-2019).
//
// `minPlan` reads like a free choice per product, and for most of the
// catalogue it is. Three entries are not: Online Orders, Prepaid Credits and
// Member Visits all move a guest's money, and the thing that moves it is
// Online Payments. Pato named it when the packing put Orders on Mesita Pro and
// left Payments above it: *"online orders cannot work without online
// payments."*
//
// IT SHIPS GREEN EITHER WAY, which is the whole reason this file exists. A
// place on a rung with Orders and without Payments gets a catalogue card that
// says On, a view that renders, and an order button that cannot charge
// anybody — no type error, no failing assertion, nothing to see until a guest
// tries to pay. The dependency is a fact about the products, so it is pinned
// against the products.
//
// IT IS AN INEQUALITY, NOT AN EQUALITY. Payments may sit BELOW its dependants
// — that is just a cheaper rung carrying the rail — and it does today: Orders
// and Payments are both Mesita Pro while Credits and Member Visits are Ultra.
// Pinning them equal would fail the moment either one moved for a reason that
// has nothing to do with this.
import { describe, expect, it } from "vitest";
import { SPECS } from "./products";
import { PRODUCT_LABEL } from "./product-keys";
import { PLAN_LADDER, PLAN_RANK, type PlanTier } from "@/mock/types";

const rung = (key: string): PlanTier => SPECS.find((s) => s.key === key)!.minPlan;

describe("the rails a product needs", () => {
  it.each(["orders", "credits", "visits"])(
    "%s never sits below Online Payments",
    (key) => {
      expect(PLAN_RANK[rung(key)]).toBeGreaterThanOrEqual(PLAN_RANK[rung("pay")]);
    },
  );
});

describe("the ladder", () => {
  it("is three rungs, cheapest first", () => {
    expect(PLAN_LADDER).toEqual(["free", "pro", "ultra"]);
  });

  it("puts every product on a rung the ladder has", () => {
    for (const spec of SPECS) expect(PLAN_LADDER).toContain(spec.minPlan);
  });
});

// ── PATO'S OWN LIST (MESITA-2025, superseding MESITA-2021) ─────────────────
//
// 2026-09-20, dictating the twelve perks as one numbered run — the second time
// in a day, and this time two things moved:
//
//   FREE   1 Mesita Profile · 2 Online Reputation · 3 Digital Menu
//   PRO    4 Express Website · 5 Online Payments · 6 Online Orders ·
//          7 Online Reservations
//   ULTRA  8 Partner Badge · 9 Member Visits · 10 Prepaid Credits ·
//          11 Answering Agent · 12 Developers Platform
//
// THAT IS WHY IT IS PINNED. MESITA-2021's version matched the file exactly and
// held for four hours: the packing is right on any given day by nothing
// stronger than the last person having typed it correctly, and `PlanComparison`
// derives its three columns from `SPECS` — so a `minPlan` edited for a reason
// that has nothing to do with this list silently re-prices the ladder Pato read
// out, with every gate green and the screen still rendering.
//
// THE ASSERTIONS BELOW ARE NOT HIS NUMBERING, and the one difference is Online
// Payments. He calls it 5th, above Orders and Reservations; the columns render
// in `PRODUCT_KEYS` order, which is his own 2026-09-16 dictation drawn as four
// contiguous bands, and Payments heads "The money" there. Honouring both orders
// means a second hand-typed sequence beside the one MESITA-1883 killed, so what
// is pinned is the MEMBERSHIP of each rung — his, to the letter — in the order
// the screen actually prints. A product arriving on or leaving a rung fails
// here either way, which is the failure this file exists for.
//
// IT IS PINNED BY NAME, not by key, and by the whole set rather than
// product-by-product. By NAME because the name is what he dictated and what
// the column prints — the `partner` key spelled "Mesita Partner" would pass a
// key-keyed test while the screen says something he did not ask for. By SET
// because the failure this catches is a product LEAVING a rung as much as one
// arriving: an `it.each` over twelve products cannot see a thirteenth.
//
// SOON PRODUCTS ARE NOT IN IT, on `addedBy`'s rule: an unbuilt product has no
// engine to switch on, so it is not a perk of any rung and it is not on his
// list. The eight of them keep a `minPlan` for the day they ship, and the
// ladder test above is what holds it to a rung that exists.
describe("the rungs Pato dictated", () => {
  const live = (tier: PlanTier) =>
    SPECS.filter((s) => !s.soon && s.minPlan === tier).map((s) => s.name);

  it("puts the whole listing on Free", () => {
    expect(live("free")).toEqual([
      "Mesita Profile",
      "Online Reputation",
      "Digital Menu",
    ]);
  });

  // MEMBER VISITS LANDS SECOND, NOT LAST (MESITA-2038). The list is
  // PRODUCT_KEYS order, where `visits` heads the "Serving the guest" band, so
  // moving its `minPlan` to "pro" inserts it between Express Website and Online
  // Orders. Appending it here instead would fail, and would read as the
  // derivation being broken rather than the expectation being wrong.
  it("puts the selling surface on Mesita Pro", () => {
    expect(live("pro")).toEqual([
      "Express Website",
      "Member Visits",
      "Online Orders",
      "Online Reservations",
      "Online Payments",
    ]);
  });

  // Member Visits left this rung with MESITA-2038: three of its four levers
  // settle at the till with no payment rail, so they are Pro's. What stayed at
  // Ultra is the Instagram story lever, which is verified AFTER the bill closes
  // and therefore needs the top-up vehicle Prepaid Credits provides — that
  // gating lives on the lever in `lib/rewards.ts`, not on the card.
  it("puts what brings a guest back on Mesita Ultra", () => {
    expect(live("ultra")).toEqual([
      "Partner Badge",
      "Prepaid Credits",
      "Answering Agent",
      "Developers Platform",
    ]);
  });

  // THE CATALOGUE AND THE RAIL MUST SAY THE SAME WORD. `PlanComparison`
  // prints `PRODUCT_LABEL[key]` while every assertion above reads `spec.name`,
  // so the two maps disagreeing would let this file pass on a screen that
  // reads differently — which is the exact failure `product-keys.ts` records
  // as having happened three times unnoticed.
  it("calls each product one thing", () => {
    for (const spec of SPECS) expect(PRODUCT_LABEL[spec.key]).toBe(spec.name);
  });
});
